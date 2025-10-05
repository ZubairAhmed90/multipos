const { validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const SalesReturn = require('../models/SalesReturn');
const HeldBill = require('../models/HeldBill');
const InventoryItem = require('../models/InventoryItem');
const BranchLedger = require('../models/BranchLedger');
const { pool } = require('../config/database');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private (Admin, Cashier)
const createSale = async (req, res, next) => {
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { items, scopeType, scopeId, paymentMethod, customerInfo, notes, subtotal, tax, discount, total, paymentStatus, status, paymentAmount, creditAmount, creditStatus } = req.body;


    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Use provided totals or calculate them from items
    let finalSubtotal = parseFloat(subtotal) || 0;
    let finalTax = parseFloat(tax) || 0;
    let finalDiscount = parseFloat(discount) || 0;
    let finalTotal = parseFloat(total) || 0;

    // If totals are not provided, calculate them from items
    if (subtotal === undefined || subtotal === null || subtotal === '' || tax === undefined || tax === null || tax === '' || total === undefined || total === null || total === '') {
      let calculatedSubtotal = 0;
      let calculatedDiscount = 0;

      // Validate inventory items and calculate totals
      for (const item of items) {
        const inventoryItem = await InventoryItem.findById(item.inventoryItemId);
        
        if (!inventoryItem) {
          return res.status(404).json({
            success: false,
            message: `Inventory item with ID ${item.inventoryItemId} not found`
          });
        }

        // Check if item belongs to the correct scope
        if (inventoryItem.scopeType !== scopeType || inventoryItem.scopeId.toString() !== scopeId.toString()) {
          return res.status(400).json({
            success: false,
            message: `Item ${inventoryItem.name} does not belong to the specified scope`
          });
        }

        // Check stock availability
        if (inventoryItem.currentStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.currentStock}`
          });
        }

        const itemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
        calculatedSubtotal += itemTotal;
        calculatedDiscount += item.discount || 0;
      }

      // Calculate tax (assuming 10% tax rate)
      const taxRate = 0.10;
      const calculatedTax = calculatedSubtotal * taxRate;
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      finalSubtotal = calculatedSubtotal;
      finalTax = calculatedTax;
      finalDiscount = calculatedDiscount;
      finalTotal = calculatedTotal;
    }

    // Generate invoice number
    const invoiceNo = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Extract customer name and phone from customerInfo
    const customerName = customerInfo?.name || '';
    const customerPhone = customerInfo?.phone || '';
    
    // Calculate payment amounts
    const finalPaymentAmount = paymentAmount !== undefined ? parseFloat(paymentAmount) : finalTotal;
    const finalCreditAmount = creditAmount !== undefined ? parseFloat(creditAmount) : 0;
    const finalCreditStatus = creditStatus || (finalCreditAmount > 0 ? 'PENDING' : 'NONE');
    const finalPaymentStatus = paymentStatus || (finalCreditAmount > 0 ? 'PARTIAL' : 'COMPLETED');
    
    
    // Create sale
    const saleData = {
      invoiceNo,
      scopeType,
      scopeId,
      userId: req.user.id,
      shiftId: req.body.shiftId || req.currentShift?.id || null,
      subtotal: finalSubtotal,
      tax: finalTax,
      discount: finalDiscount,
      total: finalTotal,
      paymentMethod,
      paymentStatus: finalPaymentStatus,
      customerInfo: customerInfo ? JSON.stringify(customerInfo) : null,
      customerName,
      customerPhone,
      paymentAmount: finalPaymentAmount,
      creditAmount: finalCreditAmount,
      creditStatus: finalCreditStatus,
      creditDueDate: finalCreditAmount > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null, // 30 days from now
      notes,
      status: status || 'COMPLETED',
      items: items.map(item => ({
        inventoryItemId: item.inventoryItemId,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total: (item.unitPrice * item.quantity) - (item.discount || 0)
      }))
    };


    const sale = await Sale.create(saleData);

    // Update inventory stock
    for (const item of items) {
      await InventoryItem.updateStock(item.inventoryItemId, -item.quantity);
    }

    // Update branch ledger if applicable
    if (scopeType === 'BRANCH') {
      await BranchLedger.addTransaction(scopeId, {
        type: 'SALE',
        amount: finalTotal,
        description: `Sale ${invoiceNo}`,
        referenceId: sale.id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating sale',
      error: error.message
    });
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private (Admin, Cashier)
const getSales = async (req, res, next) => {
  try {
    const { scopeType, scopeId, startDate, endDate, paymentMethod, status, retailerId, customerPhone, creditStatus } = req.query;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can always view sales (read-only access)
      if (req.user.branchId) {
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push('BRANCH', req.user.branchId);
      } else {
        whereConditions.push('scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // For testing: Show all warehouse sales, not just current warehouse
      whereConditions.push('scope_type = ?');
      params.push('WAREHOUSE');
      // whereConditions.push('scope_type = ? AND scope_id = ?');
      // params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'ADMIN') {
      // Admin can filter by scopeType and/or scopeId
      if (scopeType && scopeType !== 'all') {
        whereConditions.push('scope_type = ?');
        params.push(scopeType);
      }
      if (scopeId && scopeId !== 'all') {
        whereConditions.push('scope_id = ?');
        params.push(scopeId);
      }
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    if (paymentMethod) {
      whereConditions.push('payment_method = ?');
      params.push(paymentMethod);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (retailerId && retailerId !== 'all') {
      whereConditions.push('JSON_EXTRACT(customer_info, "$.id") = ?');
      params.push(retailerId);
    }

    if (customerPhone) {
      whereConditions.push('customer_phone = ?');
      params.push(customerPhone);
    }

    if (creditStatus) {
      whereConditions.push('credit_status = ?');
      params.push(creditStatus);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';


    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        u.email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);


    

    // Format sales data using Sale model to properly parse customer_info
    const formattedSales = sales.map(sale => {
      const saleData = {
        ...sale,
        customerInfo: sale.customer_info ? JSON.parse(sale.customer_info) : null
      };
      
      return saleData;
    });

    res.json({
      success: true,
      count: formattedSales.length,
      data: formattedSales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales',
      error: error.message
    });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private (Admin, Cashier)
const getSale = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'CASHIER' && 
          (sale.scopeType !== 'BRANCH' || sale.scopeId !== req.user.branchId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      if (req.user.role === 'WAREHOUSE_KEEPER' && 
          (sale.scopeType !== 'WAREHOUSE' || sale.scopeId !== req.user.warehouseId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get sale items
    const saleItems = await Sale.getSaleItems(id);

    res.json({
      success: true,
      data: {
        ...sale,
        items: saleItems
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sale',
      error: error.message
    });
  }
};

// @desc    Update sale
// @route   PUT /api/sales/:id
// @access  Private (Admin, Cashier)
const updateSale = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'CASHIER' && 
          (sale.scopeType !== 'BRANCH' || sale.scopeId !== req.user.branchId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Check if cashier has permission to edit sales
      if (req.user.role === 'CASHIER') {
        const Branch = require('../models/Branch');
        const branchSettings = await Branch.getSettings(sale.scopeId);
        if (!branchSettings?.allowCashierSalesEdit) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to edit sales. Contact your administrator.'
          });
        }
      }
    }

    // Only allow certain fields to be updated
    const allowedUpdates = [
      'subtotal', 'tax', 'discount', 'total', 
      'paymentMethod', 'paymentStatus', 'status', 'notes',
      'customerName', 'customerEmail', 'customerPhone', 'customerAddress'
    ];
    const filteredUpdates = {};
    const customerFields = ['customerName', 'customerEmail', 'customerPhone', 'customerAddress'];
    let customerInfo = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        if (customerFields.includes(key)) {
          // Map customer fields to customerInfo object
          const customerKey = key.replace('customer', '').toLowerCase();
          customerInfo[customerKey] = updateData[key];
        } else {
          filteredUpdates[key] = updateData[key];
        }
      }
    });
    
    // Add customerInfo if any customer fields were provided
    if (Object.keys(customerInfo).length > 0) {
      filteredUpdates.customerInfo = customerInfo;
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedSale = await Sale.update(id, filteredUpdates);

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: updatedSale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating sale',
      error: error.message
    });
  }
};

// @desc    Delete sale
// @route   DELETE /api/sales/:id
// @access  Private (Admin)
const deleteSale = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'CASHIER') {
        // Get sale to check scope and user
        const [saleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
        if (saleRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: 'Sale not found'
          });
        }
        
        const sale = saleRows[0];
        
        // Check if cashier can only delete their own sales
        if (sale.user_id !== req.user.id) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            message: 'You can only delete your own sales'
          });
        }
        
        // Check if cashier has permission to delete sales
        const Branch = require('../models/Branch');
        const branchSettings = await Branch.getSettings(sale.scope_id);
        if (!branchSettings?.allowCashierSalesDelete) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to delete sales. Contact your administrator.'
          });
        }
      } else {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await connection.beginTransaction();

    // Get sale and sale items in the same transaction (if not already fetched)
    let saleRows;
    if (req.user.role === 'ADMIN') {
      [saleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
      if (saleRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }
    }

    const [saleItemRows] = await connection.execute('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    
    // Restore inventory stock
    for (const item of saleItemRows) {
      await connection.execute(
        'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
        [item.quantity, item.inventory_item_id]
      );
    }

    // Delete sale items first (due to foreign key constraints)
    await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);

    // Delete the sale
    const [deleteResult] = await connection.execute('DELETE FROM sales WHERE id = ?', [id]);
    
    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sale not found or already deleted'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      success: false,
      message: 'Error deleting sale',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// @desc    Create sales return
// @route   POST /api/sales/returns
// @access  Private (Admin, Cashier)
const createSalesReturn = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { saleId, items, reason, notes } = req.body;

    // Validate original sale
    const originalSale = await Sale.findById(saleId);
    if (!originalSale) {
      return res.status(404).json({
        success: false,
        message: 'Original sale not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'CASHIER' && 
          (originalSale.scopeType !== 'BRANCH' || originalSale.scopeId !== req.user.branchId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      if (req.user.role === 'WAREHOUSE_KEEPER' && 
          (originalSale.scopeType !== 'WAREHOUSE' || originalSale.scopeId !== req.user.warehouseId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Calculate return totals
    let totalRefund = 0;
    for (const item of items) {
      totalRefund += item.refundAmount;
    }

    // Create sales return
    const returnData = {
      originalSaleId: saleId,
      userId: req.user.id,
      reason,
      notes,
      totalRefund,
      items: items.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        refundAmount: item.refundAmount
      }))
    };

    const salesReturn = await SalesReturn.create(returnData);

    // Restore inventory stock
    for (const item of items) {
      await InventoryItem.updateStock(item.inventoryItemId, item.quantity);
    }

    res.status(201).json({
      success: true,
      message: 'Sales return created successfully',
      data: salesReturn
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating sales return',
      error: error.message
    });
  }
};

// @desc    Get sales returns
// @route   GET /api/sales/returns
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getSalesReturns = async (req, res, next) => {
  try {
    const { scopeType, scopeId, startDate, endDate } = req.query;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can always view sales returns (read-only access)
      if (req.user.branchId) {
        whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
        params.push('BRANCH', req.user.branchId);
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    } else if (scopeType && scopeId) {
      whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
      params.push(scopeType, scopeId);
    }

    if (startDate) {
      whereConditions.push('sr.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('sr.created_at <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [returns] = await pool.execute(`
      SELECT 
        sr.*,
        s.invoice_no,
        u.username,
        u.email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY sr.created_at DESC
    `, params);

    res.json({
      success: true,
      count: returns.length,
      data: returns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales returns',
      error: error.message
    });
  }
};

// @desc    Get sales history for a specific company
// @route   GET /api/sales/company/:companyId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getCompanySalesHistory = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;
    
    let whereConditions = ['JSON_EXTRACT(customer_info, "$.id") = ?'];
    let params = [companyId];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get sales history
    const [sales] = await pool.execute(`
      SELECT 
        s.id,
        s.invoice_no,
        s.subtotal,
        s.tax,
        s.discount,
        s.total,
        s.payment_method,
        s.payment_status,
        s.status,
        s.customer_info,
        s.notes,
        s.created_at,
        s.updated_at,
        u.username as created_by,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    // Get sales items for each sale
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      const [items] = await pool.execute(`
        SELECT 
          si.*,
          ii.name as item_name,
          ii.sku,
          ii.unit_price
        FROM sale_items si
        LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
        WHERE si.sale_id = ?
        ORDER BY si.id
      `, [sale.id]);

      return {
        ...sale,
        items: items.map(item => ({
          id: item.id,
          inventoryItemId: item.inventory_item_id,
          itemName: item.item_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price) || 0,
          total: parseFloat(item.total) || 0
        }))
      };
    }));

    // Calculate summary statistics
    const totalSales = salesWithItems.length;
    const totalAmount = salesWithItems.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    const paymentMethods = [...new Set(salesWithItems.map(sale => sale.payment_method))];
    const paymentStatuses = [...new Set(salesWithItems.map(sale => sale.payment_status))];

    res.json({
      success: true,
      message: 'Company sales history retrieved successfully',
      data: {
        company: salesWithItems[0]?.customer_info || {},
        summary: {
          totalSales,
          totalAmount,
          paymentMethods,
          paymentStatuses
        },
        sales: salesWithItems
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving company sales history',
      error: error.message
    });
  }
};

// @desc    Get invoice details with items
// @route   GET /api/sales/invoice/:invoiceId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getInvoiceDetails = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    
    // Validate invoiceId
    if (!invoiceId || isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }
    
    // Get the sale/invoice details
    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username as created_by_username,
        u.email as created_by_email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      WHERE s.id = ?
    `, [invoiceId]);
    
    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    const sale = sales[0];
    
    // Get sale items
    const [items] = await pool.execute(`
      SELECT 
        si.*,
        ii.name as item_name,
        ii.sku,
        ii.selling_price as catalog_price,
        ii.cost_price,
        ii.category
      FROM sale_items si
      LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `, [invoiceId]);
    
    // Parse customer_info safely
    let customerInfo = null;
    try {
      if (sale.customer_info) {
        customerInfo = JSON.parse(sale.customer_info);
      }
    } catch (parseError) {
      customerInfo = null;
    }
    
    // Format the response
    const invoiceDetails = {
      id: sale.id,
      invoiceNo: sale.invoice_no,
      createdAt: sale.created_at,
      updatedAt: sale.updated_at,
      subtotal: parseFloat(sale.subtotal) || 0,
      tax: parseFloat(sale.tax) || 0,
      discount: parseFloat(sale.discount) || 0,
      total: parseFloat(sale.total) || 0,
      paymentMethod: sale.payment_method,
      paymentStatus: sale.payment_status,
      status: sale.status,
      notes: sale.notes,
      customerInfo: customerInfo,
      scopeType: sale.scope_type,
      scopeId: sale.scope_id,
      branchName: sale.branch_name,
      warehouseName: sale.warehouse_name,
      createdBy: {
        username: sale.created_by_username,
        email: sale.created_by_email
      },
      items: items.map(item => ({
        id: item.id,
        inventoryItemId: item.inventory_item_id,
        itemName: item.item_name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price) || 0,
        catalogPrice: parseFloat(item.catalog_price) || 0,
        costPrice: parseFloat(item.cost_price) || 0,
        discount: parseFloat(item.discount) || 0,
        total: parseFloat(item.total) || 0
      }))
    };
    
    res.json({
      success: true,
      message: 'Invoice details retrieved successfully',
      data: invoiceDetails
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving invoice details',
      error: error.message
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSale,
  updateSale,
  deleteSale,
  createSalesReturn,
  getSalesReturns,
  getCompanySalesHistory,
  getInvoiceDetails
};