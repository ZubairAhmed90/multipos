const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { createStockReportEntry } = require('../middleware/stockTracking');
const { cleanupFile } = require('../middleware/upload');

// @desc    Import inventory data from Excel file
// @route   POST /api/inventory/import-excel
// @access  Private (Admin, Warehouse Keeper)
const importInventoryFromExcel = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const { scopeType, scopeId } = req.body;

    // Validate required parameters
    if (!scopeType || !scopeId) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: 'scopeType and scopeId are required'
      });
    }

    // Validate scopeType
    if (!['BRANCH', 'WAREHOUSE'].includes(scopeType)) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: 'scopeType must be either BRANCH or WAREHOUSE'
      });
    }

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use first row as headers
      defval: '' // Default value for empty cells
    });

    if (jsonData.length < 2) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: 'Excel file must contain at least a header row and one data row'
      });
    }

    // Extract headers and data
    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);

    // Expected column mapping
    const expectedColumns = {
      'name': ['name', 'item_name', 'product_name', 'item name', 'product name'],
      'code': ['code', 'item_code', 'product_code', 'sku', 'item code', 'product code'],
      'category': ['category', 'item_category', 'product_category', 'item category', 'product category'],
      'description': ['description', 'item_description', 'product_description', 'item description', 'product description'],
      'current_stock': ['current_stock', 'stock', 'quantity', 'qty', 'current stock', 'available stock'],
      'min_stock_level': ['min_stock_level', 'min_stock', 'minimum_stock', 'min stock', 'minimum stock', 'reorder_level'],
      'max_stock_level': ['max_stock_level', 'max_stock', 'maximum_stock', 'max stock', 'maximum stock'],
      'unit_price': ['unit_price', 'price', 'cost', 'unit price', 'selling_price', 'selling price'],
      'cost_price': ['cost_price', 'cost', 'purchase_price', 'cost price', 'purchase price'],
      'unit': ['unit', 'unit_of_measure', 'uom', 'unit of measure', 'measurement_unit']
    };

    // Map headers to expected fields
    const headerMapping = {};
    headers.forEach((header, index) => {
      if (header) {
        const normalizedHeader = header.toString().toLowerCase().trim();
        Object.keys(expectedColumns).forEach(field => {
          if (expectedColumns[field].includes(normalizedHeader)) {
            headerMapping[field] = index;
          }
        });
      }
    });

    // Validate required fields
    const requiredFields = ['name', 'code', 'current_stock'];
    const missingFields = requiredFields.filter(field => headerMapping[field] === undefined);
    
    if (missingFields.length > 0) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingFields.join(', ')}`,
        expectedColumns: Object.keys(expectedColumns),
        foundColumns: headers
      });
    }

    // Process data rows
    const inventoryItems = [];
    const errors = [];
    const warnings = [];

    dataRows.forEach((row, rowIndex) => {
      try {
        // Skip empty rows
        if (row.every(cell => !cell || cell.toString().trim() === '')) {
          return;
        }

        const item = {
          name: row[headerMapping.name]?.toString().trim() || '',
          code: row[headerMapping.code]?.toString().trim() || '',
          category: row[headerMapping.category]?.toString().trim() || 'General',
          description: row[headerMapping.description]?.toString().trim() || '',
          current_stock: parseFloat(row[headerMapping.current_stock]) || 0,
          min_stock_level: parseFloat(row[headerMapping.min_stock_level]) || 0,
          max_stock_level: parseFloat(row[headerMapping.max_stock_level]) || 0,
          unit_price: parseFloat(row[headerMapping.unit_price]) || 0,
          cost_price: parseFloat(row[headerMapping.cost_price]) || 0,
          unit: row[headerMapping.unit]?.toString().trim() || 'pcs',
          scope_type: scopeType,
          scope_id: scopeId, // Use scopeId as numeric ID (branch/warehouse ID)
          status: 'ACTIVE',
          created_at: new Date(),
          updated_at: new Date()
        };

        // Validate item data
        if (!item.name) {
          errors.push(`Row ${rowIndex + 2}: Name is required`);
          return;
        }

        // SKU/Code is now optional - no validation needed

        if (item.current_stock < 0) {
          warnings.push(`Row ${rowIndex + 2}: Negative stock value for ${item.name}`);
        }

        if (item.unit_price < 0) {
          warnings.push(`Row ${rowIndex + 2}: Negative unit price for ${item.name}`);
        }

        inventoryItems.push(item);
      } catch (error) {
        errors.push(`Row ${rowIndex + 2}: ${error.message}`);
      }
    });

    // If there are critical errors, return them
    if (errors.length > 0) {
      cleanupFile(filePath);
      return res.status(400).json({
        success: false,
        message: 'Validation errors found in Excel file',
        errors: errors,
        warnings: warnings
      });
    }

    // Insert inventory items into database
    const insertedItems = [];
    const duplicateItems = [];
    const failedItems = [];

    for (const item of inventoryItems) {
      try {
        // Generate SKU from name if code is empty (for duplicate check)
        let checkSku = item.code;
        if (!checkSku || checkSku.trim() === '') {
          // Generate SKU from product name
          const cleanName = item.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const timestamp = Date.now().toString().slice(-6);
          checkSku = `${cleanName}-${timestamp}`;
        }

        // Check if item already exists (using sku field instead of code)
        const [existing] = await pool.execute(
          'SELECT id FROM inventory_items WHERE sku = ? AND scope_type = ? AND scope_id = ?',
          [checkSku, item.scope_type, item.scope_id]
        );

        if (existing.length > 0) {
          duplicateItems.push({
            name: item.name,
            code: item.code,
            reason: 'Item with this SKU already exists'
          });
          continue;
        }

        // Generate SKU from name if code is empty
        let finalSku = item.code;
        if (!finalSku || finalSku.trim() === '') {
          // Generate SKU from product name
          const cleanName = item.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const timestamp = Date.now().toString().slice(-6);
          finalSku = `${cleanName}-${timestamp}`;
        }

        // Insert new item
        const [result] = await pool.execute(`
          INSERT INTO inventory_items (
            name, sku, category, description, current_stock, min_stock_level, 
            max_stock_level, selling_price, cost_price, unit, scope_type, scope_id, 
            created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.name, finalSku, item.category, item.description, item.current_stock,
          item.min_stock_level, item.max_stock_level, item.unit_price, item.cost_price,
          item.unit, item.scope_type, item.scope_id, req.user.id, item.created_at, item.updated_at
        ]);

        // Create stock report entry for initial inventory creation
        if (item.current_stock > 0) {
          try {
            await createStockReportEntry({
              inventoryItemId: result.insertId,
              transactionType: 'PURCHASE', // Initial stock is treated as a purchase
              quantityChange: item.current_stock,
              previousQuantity: 0,
              newQuantity: item.current_stock,
              unitPrice: item.cost_price || 0,
              totalValue: (item.cost_price || 0) * item.current_stock,
              userId: req.user.id,
              userName: req.user.name || req.user.username,
              userRole: req.user.role,
              adjustmentReason: 'Initial inventory creation via Excel import'
            });
            console.log(`[ExcelImportController] Created stock report entry for: ${item.name}`);
          } catch (stockError) {
            console.error('[ExcelImportController] Error creating stock report entry:', stockError);
            // Don't fail the import if stock tracking fails
          }
        }

        insertedItems.push({
          id: result.insertId,
          name: item.name,
          code: item.code
        });
      } catch (error) {
        failedItems.push({
          name: item.name,
          code: item.code,
          reason: error.message
        });
      }
    }

    // Cleanup uploaded file
    cleanupFile(filePath);

    // Return results
    res.json({
      success: true,
      message: 'Excel import completed',
      summary: {
        totalRows: dataRows.length,
        processedItems: inventoryItems.length,
        insertedItems: insertedItems.length,
        duplicateItems: duplicateItems.length,
        failedItems: failedItems.length,
        warnings: warnings.length
      },
      insertedItems: insertedItems,
      duplicateItems: duplicateItems,
      failedItems: failedItems,
      warnings: warnings
    });

  } catch (error) {
    // Cleanup file on error
    if (req.file) {
      cleanupFile(req.file.path);
    }
    
    console.error('Excel import error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing Excel file',
      error: error.message
    });
  }
};

// @desc    Get Excel template for inventory import
// @route   GET /api/inventory/excel-template
// @access  Private (Admin, Warehouse Keeper)
const getExcelTemplate = async (req, res, next) => {
  try {
    // Create sample data for template
    const sampleData = [
      ['name', 'code', 'category', 'description', 'current_stock', 'min_stock_level', 'max_stock_level', 'unit_price', 'cost_price', 'unit'],
      ['Sample Product 1', 'SP001', 'Electronics', 'Sample electronic product', '100', '10', '500', '25.50', '20.00', 'pcs'],
      ['Sample Product 2', 'SP002', 'Clothing', 'Sample clothing item', '50', '5', '200', '15.75', '12.00', 'pcs'],
      ['Sample Product 3', 'SP003', 'Books', 'Sample book', '75', '5', '300', '12.00', '8.50', 'pcs']
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);

    // Set column widths
    const columnWidths = [
      { wch: 20 }, // name
      { wch: 15 }, // code
      { wch: 15 }, // category
      { wch: 30 }, // description
      { wch: 15 }, // current_stock
      { wch: 15 }, // min_stock_level
      { wch: 15 }, // max_stock_level
      { wch: 15 }, // unit_price
      { wch: 15 }, // cost_price
      { wch: 10 }  // unit
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Template');

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_template.xlsx');
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating Excel template',
      error: error.message
    });
  }
};

module.exports = {
  importInventoryFromExcel,
  getExcelTemplate
};
