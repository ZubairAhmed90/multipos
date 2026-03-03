const { validationResult } = require('express-validator');
const InventoryItem = require('../models/InventoryItem');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const { executeQuery, pool } = require('../config/database');
const { createStockReportEntry, createAdjustmentTransaction } = require('../middleware/stockTracking');

// Helper to normalise date strings to YYYY-MM-DD
const normalizeDateInput = (value) => {
  if (!value && value !== 0) return null;

  if (value instanceof Date) {
    return !isNaN(value.getTime()) ? value.toISOString().split('T')[0] : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Already ISO formatted
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Attempt to parse using Date constructor
    const directDate = new Date(trimmed);
    if (!isNaN(directDate.getTime())) {
      return directDate.toISOString().split('T')[0];
    }

    // Handle DD/MM/YYYY or MM/DD/YYYY variations
    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (match) {
      let [ , part1, part2, part3 ] = match;
      let day;
      let month;
      let year = parseInt(part3, 10);

      // Determine if format is DD/MM or MM/DD
      const first = parseInt(part1, 10);
      const second = parseInt(part2, 10);

      if (first > 12 && second <= 12) {
        // Clearly DD/MM
        day = first;
        month = second;
      } else if (second > 12 && first <= 12) {
        // Clearly MM/DD
        month = first;
        day = second;
      } else {
        // Ambiguous, fallback to MM/DD (default for many locales)
        month = first;
        day = second;
      }

      if (year < 100) {
        year += year >= 70 ? 1900 : 2000; // simple two-digit year handling
      }

      const composed = new Date(year, month - 1, day);
      if (!isNaN(composed.getTime())) {
        return composed.toISOString().split('T')[0];
      }
    }
  }

  return null;
};

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getInventoryItems = async (req, res, next) => {
  try {
    console.log('[InventoryController] getInventoryItems called for user:', {
      role: req.user.role,
      branchId: req.user.branchId,
      warehouseId: req.user.warehouseId
    });
    
    const { scopeType, scopeId, category, includeCrossBranch = false, supplierId, search } = req.query;

    // Pagination defaults (allow "all" to fetch entire dataset)
    const isLimitAll = typeof req.query.limit === 'string' && req.query.limit.toLowerCase() === 'all';
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (isLimitAll) {
      limit = 1000000; // effectively "no limit" while still preventing runaway queries
      page = 1;
    }
    if (!Number.isFinite(limit) || limit < 1) limit = 25;
    if (!isLimitAll && limit > 1000000) limit = 1000000;
    const offset = isLimitAll ? 0 : (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    
    // Admin can see everything; ignore scope filters to prevent accidental narrowing
if (req.user.role === 'ADMIN') {
  // Admin can filter by scope if query params provided (e.g. simulation mode)
  if (scopeType) {
    whereConditions.push('i.scope_type = ?');
    params.push(scopeType);
  }
  if (scopeId) {
    whereConditions.push('i.scope_id = ?');
    params.push(scopeId);
  }
} else {
  // Non-admin users have scope restrictions
  const userBranchId = req.user.branch_id || req.user.branchId;
  const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
  
  if (req.user.role === 'WAREHOUSE_KEEPER') {
    if (userWarehouseId) {
      whereConditions.push('i.scope_type = ? AND i.scope_id = ?');
      params.push('WAREHOUSE', userWarehouseId);
    } else {
      whereConditions.push('1 = 0');
    }
  } else if (req.user.role === 'CASHIER') {
    if (userBranchId) {
      whereConditions.push('i.scope_type = ? AND i.scope_id = ?');
      params.push('BRANCH', userBranchId);
    } else {
      whereConditions.push('1 = 0');
    }
    if (scopeType === 'BRANCH' && scopeId) {
      whereConditions.push('i.scope_id = ?');
      params.push(scopeId);
    }
  }
}
    
    // Filter by category if provided
    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    // Filter by supplier if provided
    if (supplierId) {
      whereConditions.push('i.supplier_id = ?');
      params.push(supplierId);
    }

    // Text search
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      whereConditions.push('(i.name LIKE ? OR i.category LIKE ? OR i.description LIKE ? OR i.barcode LIKE ? OR i.sku LIKE ?)');
      params.push(like, like, like, like, like);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    console.log('[InventoryController] Final query conditions:', {
      whereClause,
      params,
      userRole: req.user.role,
      branchId: req.user.branchId,
      warehouseId: req.user.warehouseId
    });
    
    // Debug: Test the aggregation query directly for cashiers/warehouse keepers
    if ((req.user.role === 'CASHIER' && req.user.branchId) || (req.user.role === 'WAREHOUSE_KEEPER' && req.user.warehouseId)) {
      const testScopeType = req.user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE';
      const testScopeId = req.user.role === 'CASHIER' ? req.user.branchId : req.user.warehouseId;
      
      const [testAggregation] = await pool.execute(`
        SELECT 
          sr.inventory_item_id,
          SUM(CASE WHEN sr.transaction_type = 'RETURN' THEN sr.quantity_change ELSE 0 END) as total_returned
        FROM stock_reports sr
        INNER JOIN inventory_items ii ON sr.inventory_item_id = ii.id
        WHERE sr.transaction_type = 'RETURN'
          AND ii.scope_type = ?
          AND ii.scope_id = ?
        GROUP BY sr.inventory_item_id
        LIMIT 5
      `, [testScopeType, testScopeId]);
      console.log('[InventoryController] Test aggregation query results:', testAggregation);
    }
    
    // Total count for pagination
    const countRows = await executeQuery(`
      SELECT COUNT(*) as count
      FROM inventory_items i
      ${whereClause}
    `, params);
    const total = countRows?.[0]?.count || 0;

    const inventoryItems = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name,
        c.name as supplier_name,
        c.contact_person as supplier_contact,
        c.phone as supplier_phone,
        c.email as supplier_email,
        COALESCE(sr.total_purchased, 0) as total_purchased,
        COALESCE(sr.total_sold, 0) as total_sold,
        COALESCE(sr.total_returned, 0) as total_returned,
        COALESCE(sr.total_restocked, 0) as total_restocked,
        COALESCE(sr.total_adjusted, 0) as total_adjusted,
        COALESCE(pr.pending_returns, 0) as pending_returns
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      LEFT JOIN companies c ON i.supplier_id = c.id
      LEFT JOIN (
        SELECT 
          sr.inventory_item_id,
          SUM(CASE WHEN sr.transaction_type = 'PURCHASE' THEN sr.quantity_change ELSE 0 END) as total_purchased,
          SUM(CASE WHEN sr.transaction_type = 'SALE' THEN ABS(sr.quantity_change) ELSE 0 END) as total_sold,
          SUM(CASE WHEN sr.transaction_type = 'RETURN' THEN sr.quantity_change ELSE 0 END) as total_returned,
          SUM(CASE WHEN sr.transaction_type = 'RESTOCK' THEN sr.quantity_change ELSE 0 END) as total_restocked,
          SUM(CASE WHEN sr.transaction_type = 'ADJUSTMENT' THEN sr.quantity_change ELSE 0 END) as total_adjusted
        FROM stock_reports sr
        WHERE sr.inventory_item_id IS NOT NULL
        GROUP BY sr.inventory_item_id
      ) sr ON i.id = sr.inventory_item_id
      LEFT JOIN (
        SELECT 
          sri.inventory_item_id,
          SUM(sri.remaining_quantity) AS pending_returns
        FROM sales_return_items sri
        WHERE sri.remaining_quantity > 0
        GROUP BY sri.inventory_item_id
      ) pr ON i.id = pr.inventory_item_id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    console.log(`[InventoryController] Raw database results:`, inventoryItems.length);
    
    // Debug: Check return data for cashiers/warehouse keepers
    if (inventoryItems.length > 0 && (req.user.role === 'CASHIER' || req.user.role === 'WAREHOUSE_KEEPER')) {
      const sampleItems = inventoryItems.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name,
        scopeType: item.scope_type,
        scopeId: item.scope_id,
        total_returned: item.total_returned,
        pending_returns: item.pending_returns,
        total_purchased: item.total_purchased,
        total_sold: item.total_sold,
        // Check raw values
        total_returned_raw: item.total_returned,
        pending_returns_raw: item.pending_returns,
        total_returned_type: typeof item.total_returned,
        pending_returns_type: typeof item.pending_returns
      }));
      console.log('[InventoryController] Sample items for non-admin user (RAW DB VALUES):', JSON.stringify(sampleItems, null, 2));
      
      // Check if any items have returns
      const itemsWithReturns = inventoryItems.filter(item => 
        (parseFloat(item.total_returned) || 0) > 0 || (parseFloat(item.pending_returns) || 0) > 0
      );
      console.log('[InventoryController] Items with returns > 0:', itemsWithReturns.length);
      if (itemsWithReturns.length > 0) {
        console.log('[InventoryController] Sample items WITH returns:', itemsWithReturns.slice(0, 3).map(item => ({
          id: item.id,
          name: item.name,
          total_returned: item.total_returned,
          pending_returns: item.pending_returns
        })));
      }
      
      // Check if there are any returns in stock_reports for these items
      if (sampleItems.length > 0) {
        const itemIds = sampleItems.map(item => item.id);
        const [returnCheck] = await pool.execute(`
          SELECT inventory_item_id, transaction_type, SUM(quantity_change) as total
          FROM stock_reports
          WHERE inventory_item_id IN (${itemIds.map(() => '?').join(',')})
            AND transaction_type = 'RETURN'
          GROUP BY inventory_item_id, transaction_type
        `, itemIds);
        console.log('[InventoryController] Returns found in stock_reports for sample items:', JSON.stringify(returnCheck, null, 2));
        
        // Check what the aggregation subquery would return (simulating the exact query)
        const [aggregationCheck] = await pool.execute(`
          SELECT 
            sr.inventory_item_id,
            SUM(CASE WHEN sr.transaction_type = 'RETURN' THEN sr.quantity_change ELSE 0 END) as total_returned
          FROM stock_reports sr
          WHERE sr.inventory_item_id IN (${itemIds.map(() => '?').join(',')})
            AND sr.inventory_item_id IS NOT NULL
          GROUP BY sr.inventory_item_id
        `, itemIds);
        console.log('[InventoryController] Aggregation subquery simulation results:', JSON.stringify(aggregationCheck, null, 2));
        
        // Check pending returns
        const [pendingCheck] = await pool.execute(`
          SELECT inventory_item_id, SUM(remaining_quantity) as total
          FROM sales_return_items
          WHERE inventory_item_id IN (${itemIds.map(() => '?').join(',')})
            AND remaining_quantity > 0
          GROUP BY inventory_item_id
        `, itemIds);
        console.log('[InventoryController] Pending returns found for sample items:', JSON.stringify(pendingCheck, null, 2));
        
        // Check one specific item in detail (the first one)
        if (itemIds.length > 0) {
          const [detailCheck] = await pool.execute(`
            SELECT 
              sr.id,
              sr.inventory_item_id,
              sr.transaction_type,
              sr.quantity_change,
              sr.scope_type,
              sr.scope_id,
              sr.created_at,
              ii.id as item_id,
              ii.scope_type as item_scope_type,
              ii.scope_id as item_scope_id,
              ii.name as item_name
            FROM stock_reports sr
            LEFT JOIN inventory_items ii ON sr.inventory_item_id = ii.id
            WHERE sr.inventory_item_id = ?
              AND sr.transaction_type = 'RETURN'
            ORDER BY sr.created_at DESC
            LIMIT 5
          `, [itemIds[0]]);
          console.log('[InventoryController] Detailed return records for first item:', JSON.stringify(detailCheck, null, 2));
          
          // Also check ALL returns for this item (no transaction_type filter)
          const [allTransactions] = await pool.execute(`
            SELECT 
              sr.id,
              sr.inventory_item_id,
              sr.transaction_type,
              sr.quantity_change,
              sr.scope_type,
              sr.scope_id,
              sr.created_at
            FROM stock_reports sr
            WHERE sr.inventory_item_id = ?
            ORDER BY sr.created_at DESC
            LIMIT 10
          `, [itemIds[0]]);
          console.log('[InventoryController] ALL transactions for first item:', JSON.stringify(allTransactions, null, 2));
        }
      }
    }
    
    // Transform field names to match frontend expectations
    const transformedItems = inventoryItems.map(item => {
      const rawSold = parseFloat(item.total_sold) || 0;
      const rawReturned = parseFloat(item.total_returned) || 0;
      const rawRestocked = parseFloat(item.total_restocked) || 0;
      const rawPending = parseFloat(item.pending_returns) || 0;

      // Net values for UI:
      // - totalSold: sold minus returns
      // - totalReturned: outstanding returns (pending to restock)
      // Prefer pending returns (remaining_quantity) as the source of truth for outstanding returns
      // If pending is known (0 or more), use it; only fall back when pending is unavailable
      const pendingKnown = Number.isFinite(rawPending);
      const outstandingReturns = pendingKnown
        ? Math.max(rawPending, 0)
        : Math.max(rawReturned - rawRestocked, 0);
      const netSold = Math.max(rawSold - rawReturned, 0);

      // Current stock: use live DB value; returns do not change stock until restock
      const rawCurrentStock = parseFloat(item.current_stock) || 0;
      const displayCurrentStock = rawCurrentStock;

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        description: item.description,
        category: item.category,
        unit: item.unit,
        costPrice: item.cost_price,
        sellingPrice: item.selling_price,
        currentStock: displayCurrentStock,
        minStockLevel: item.min_stock_level,
        maxStockLevel: item.max_stock_level,
        scopeType: item.scope_type,
        scopeId: item.scope_id,
        createdBy: item.created_by,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        branchName: item.branch_name,
        warehouseName: item.warehouse_name,
        totalPurchased: parseFloat(item.total_purchased) || 0,
        totalSold: netSold,
        totalReturned: outstandingReturns,
        totalRestocked: rawRestocked,
        pendingReturns: rawPending,
        totalAdjusted: parseFloat(item.total_adjusted) || 0,
        supplierId: item.supplier_id,
        supplierName: item.supplier_name,
        supplierContact: item.supplier_contact,
        supplierPhone: item.supplier_phone,
        supplierEmail: item.supplier_email,
        purchaseDate: item.purchase_date,
        purchasePrice: parseFloat(item.purchase_price) || null
      };
    });
    
    res.json({
      success: true,
      count: transformedItems.length,
      total,
      page,
      limit,
      data: transformedItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory items',
      error: error.message
    });
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const inventoryItem = await InventoryItem.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check access permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'WAREHOUSE_KEEPER' && 
          (inventoryItem.scopeType !== 'WAREHOUSE' || parseInt(inventoryItem.scopeId) !== parseInt(req.user.warehouseId))) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      if (req.user.role === 'CASHIER' && inventoryItem.scopeType !== 'BRANCH') {
        return res.status(403).json({
          success: false,
          message: 'Access denied - Cashiers can only access branch inventory'
        });
      }
    }
    
    res.json({
      success: true,
      data: inventoryItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory item',
      error: error.message
    });
  }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Private (Admin, Warehouse Keeper)
const createInventoryItem = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const {
      sku,
      barcode,
      name,
      description,
      category,
      unit,
      costPrice,
      sellingPrice,
      minStockLevel,
      maxStockLevel,
      currentStock,
      scopeType,
      scopeId,
      supplierId,
      supplierName,
      purchaseDate,
      purchasePrice
    } = req.body;

    // Debug: log incoming payload and validation results
    console.log('[InventoryController] createInventoryItem called. validation errors:', validationResult(req).array());
    console.log('[InventoryController] createInventoryItem payload:', JSON.stringify(req.body));

    // Normalise numeric fields to avoid unexpected types or undefined values
    const numericFields = {
      costPrice: 'float',
      sellingPrice: 'float',
      currentStock: 'int',
      minStockLevel: 'int',
      maxStockLevel: 'int',
      purchasePrice: 'float'
    };

    const normalizedBody = { ...req.body };
    Object.entries(numericFields).forEach(([field, type]) => {
      if (Object.prototype.hasOwnProperty.call(normalizedBody, field)) {
        const val = normalizedBody[field];
        if (val === null || val === '' || typeof val === 'undefined') {
          normalizedBody[field] = null;
        } else {
          const parsed = type === 'int' ? parseInt(val, 10) : parseFloat(val);
          normalizedBody[field] = Number.isNaN(parsed) ? null : parsed;
        }
      } else {
        // Ensure optional numeric fields are explicit null when missing
        normalizedBody[field] = null;
      }
    });

    // Some DB schemas don't allow NULL for min/max stock; default to 0 to avoid SQL errors
    if (normalizedBody.minStockLevel === null) {
      console.warn('[InventoryController] minStockLevel missing/null - defaulting to 0 to satisfy DB constraints');
      normalizedBody.minStockLevel = 0;
    }
    if (normalizedBody.maxStockLevel === null) {
      console.warn('[InventoryController] maxStockLevel missing/null - defaulting to 0 to satisfy DB constraints');
      normalizedBody.maxStockLevel = 0;
    }

    // Check permissions - cashiers are now allowed to create inventory items
    // Permission checking is handled by middleware (checkCashierInventoryPermission)

    // Warehouse keepers can only create items for their assigned warehouse
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (scopeType !== 'WAREHOUSE' || parseInt(scopeId) !== parseInt(req.user.warehouseId)) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse keepers can only create items for their assigned warehouse'
        });
      }
    }

    // Get branch/warehouse name for scope_id
    let scopeName = '';
    if (scopeType === 'BRANCH' && scopeId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [scopeId]);
      scopeName = branches[0]?.name || scopeId;
    } else if (scopeType === 'WAREHOUSE' && scopeId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [scopeId]);
      scopeName = warehouses[0]?.name || scopeId;
    } else {
      scopeName = scopeId || '';
    }

    // Generate SKU from name if not provided
    let finalSku = sku;
    if (!finalSku || finalSku.trim() === '') {
      // Generate SKU from product name
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      finalSku = `${cleanName}-${timestamp}`;
    }

    // Check if SKU already exists within the same scope (branch/warehouse)
    if (finalSku && finalSku.trim() !== '') {
      const existingItem = await InventoryItem.findBySkuInScope(finalSku, scopeType, scopeName);
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: `SKU '${finalSku}' already exists in this ${scopeType.toLowerCase()}`
        });
      }
    }

// Find this section in createInventoryItem, just before the InventoryItem.create() call:
const rawItemData = {
  sku: finalSku,
  barcode: normalizedBody.barcode ?? null,
  name,
  description: description ?? null,
  category: category || 'General',
  unit: unit || 'piece',
  costPrice: normalizedBody.costPrice ?? 0,
  sellingPrice: normalizedBody.sellingPrice ?? 0,
  minStockLevel: normalizedBody.minStockLevel ?? 0,
  maxStockLevel: normalizedBody.maxStockLevel ?? 0,
  currentStock: normalizedBody.currentStock ?? 0,
  scopeType: scopeType ?? null,        // ← was: scopeType (undefined when missing)
  scopeId: scopeId ?? null,            // ← was: scopeId (undefined when missing)
  createdBy: req.user.id,
  supplierId: supplierId ?? null,
  supplierName: supplierName ?? null,
  purchaseDate: purchaseDate ?? null,
  purchasePrice: normalizedBody.purchasePrice ?? null
};    // Defensive: convert any undefined values to null before creating DB record
    const undefinedFields = Object.entries(rawItemData).filter(([k, v]) => typeof v === 'undefined').map(([k]) => k);
    if (undefinedFields.length) {
      console.warn('[InventoryController] Fields with undefined values before create:', undefinedFields);
    }
    const safeItemData = Object.fromEntries(Object.entries(rawItemData).map(([k, v]) => [k, typeof v === 'undefined' ? null : v]));

    const inventoryItem = await InventoryItem.create(safeItemData);

    // Create stock report entry for initial inventory creation
    if (currentStock > 0) {
      try {
        await createStockReportEntry({
          inventoryItemId: inventoryItem.id,
          transactionType: 'PURCHASE', // Initial stock is treated as a purchase
          quantityChange: currentStock,
          previousQuantity: 0,
          newQuantity: currentStock,
          unitPrice: costPrice || 0,
          totalValue: (costPrice || 0) * currentStock,
          userId: req.user.id,
          userName: req.user.name || req.user.username,
          userRole: req.user.role,
          adjustmentReason: 'Initial inventory creation'
        });
        console.log(`[InventoryController] Created stock report entry for initial inventory: ${inventoryItem.name}`);
      } catch (stockError) {
        console.error('[InventoryController] Error creating stock report entry:', stockError);
        // Don't fail the inventory creation if stock tracking fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: inventoryItem
    });
  } catch (error) {
    // Enhanced logging to help trace where the error originates
    console.error('[InventoryController] Error creating inventory item:', error && error.message ? error.message : error);
    if (error && error.stack) console.error(error.stack);
    console.error('[InventoryController] request validation result (on error):', validationResult(req).array());

    res.status(500).json({
      success: false,
      message: 'Error creating inventory item',
      error: error && error.message ? error.message : String(error)
    });
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private (Admin, Warehouse Keeper)
const updateInventoryItem = async (req, res, next) => {
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

    const inventoryItem = await InventoryItem.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check permissions - cashiers are now allowed to update inventory items
    // Permission checking is handled by middleware (checkCashierInventoryPermission)

    // Warehouse keepers can only update items in their assigned warehouse
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for comparison (inventory items store numeric IDs)
      if (inventoryItem.scopeType !== 'WAREHOUSE' || inventoryItem.scopeId != req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if SKU is being changed and if it already exists within the same scope - only if SKU is provided
    if (updateData.sku && updateData.sku.trim() !== '' && updateData.sku !== inventoryItem.sku) {
      const existingItem = await InventoryItem.findBySkuInScope(updateData.sku, inventoryItem.scopeType, inventoryItem.scopeId);
      if (existingItem) {
        return res.status(400).json({
          success: false,
          message: `SKU '${updateData.sku}' already exists in this ${inventoryItem.scopeType.toLowerCase()}`
        });
      }
    }

    // Normalise numeric fields
    const numericFields = {
      costPrice: 'float',
      sellingPrice: 'float',
      currentStock: 'int',
      minStockLevel: 'int',
      maxStockLevel: 'int',
      purchasePrice: 'float'
    };

    Object.entries(numericFields).forEach(([field, type]) => {
      if (Object.prototype.hasOwnProperty.call(updateData, field) && updateData[field] !== null && updateData[field] !== '') {
        const parsed = type === 'int' ? parseInt(updateData[field], 10) : parseFloat(updateData[field]);
        if (!Number.isNaN(parsed)) {
          updateData[field] = parsed;
        } else {
          delete updateData[field];
        }
      }
    });

    if (Object.prototype.hasOwnProperty.call(updateData, 'purchaseDate')) {
      const normalizedDate = normalizeDateInput(updateData.purchaseDate);
      updateData.purchaseDate = normalizedDate;
    }

    const updatedItem = await InventoryItem.update(id, updateData);

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating inventory item',
      error: error.message
    });
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Private (Admin only)
const deleteInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inventoryItem = await InventoryItem.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Only admin can delete inventory items
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete inventory items'
      });
    }

    await InventoryItem.delete(id);

    res.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting inventory item',
      error: error.message
    });
  }
};

// @desc    Update stock levels
// @route   PUT /api/inventory/:id/stock
// @access  Private (Admin, Warehouse Keeper)
const updateStock = async (req, res, next) => {
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
    const { currentStock, operation, quantity } = req.body;

    const inventoryItem = await InventoryItem.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check permissions
    if (req.user.role === 'CASHIER') {
      return res.status(403).json({
        success: false,
        message: 'Cashiers cannot update stock levels'
      });
    }

    // Warehouse keepers can only update items in their assigned warehouse
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for comparison (inventory items store numeric IDs)
      if (inventoryItem.scopeType !== 'WAREHOUSE' || inventoryItem.scopeId != req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    let newStock = inventoryItem.currentStock;

    if (operation === 'ADD') {
      newStock += quantity;
    } else if (operation === 'SUBTRACT') {
      newStock -= quantity;
      // Allow negative quantities for sales operations
      // Only prevent negative for manual adjustments
    } else if (operation === 'SET') {
      newStock = currentStock;
    }

    const updatedItem = await InventoryItem.update(id, { currentStock: newStock });

    // Create transaction record for stock adjustment
    await createAdjustmentTransaction(
      id,
      inventoryItem.currentStock,
      newStock,
      req.user.id,
      req.user.name,
      req.user.role,
      `Stock ${operation.toLowerCase()} by ${req.user.name}`
    );

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: error.message
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getLowStockItems = async (req, res, next) => {
  try {
    let whereConditions = [];
    let params = [];
    
    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Use branch ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
    }
    
    whereConditions.push('current_stock <= min_stock_level');
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const lowStockItems = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      ${whereClause}
      ORDER BY (i.current_stock - i.min_stock_level) ASC
    `, params);
    
    // Transform field names to match frontend expectations
    const transformedItems = lowStockItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      currentStock: item.current_stock,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      branchName: item.branch_name,
      warehouseName: item.warehouse_name
    }));
    
    res.json({
      success: true,
      count: transformedItems.length,
      data: transformedItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving low stock items',
      error: error.message
    });
  }
};

// @desc    Update inventory quantity
// @route   PATCH /api/inventory/:id/quantity
// @access  Private (Admin, Warehouse Keeper, Cashier with permission)
const updateQuantity = async (req, res, next) => {
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
    const { quantity, operation } = req.body;

    const inventoryItem = await InventoryItem.findById(id);
    if (!inventoryItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }

    // Check permissions
    if (req.user.role === 'CASHIER') {
      // Get branch name for comparison
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
      const branchName = branches[0]?.name || req.user.branchId;
      
      if (inventoryItem.scopeType !== 'BRANCH' || inventoryItem.scopeId !== branchName) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    let newQuantity = inventoryItem.currentStock;

    if (operation === 'ADD') {
      newQuantity += quantity;
    } else if (operation === 'SUBTRACT') {
      newQuantity -= quantity;
      // Allow negative quantities for sales operations
      // Only prevent negative for manual adjustments
    } else if (operation === 'SET') {
      newQuantity = quantity;
    }

    const updatedItem = await InventoryItem.update(id, { currentStock: newQuantity });

    // Create transaction record for quantity adjustment
    await createAdjustmentTransaction(
      id,
      inventoryItem.currentStock,
      newQuantity,
      req.user.id,
      req.user.name,
      req.user.role,
      `Quantity ${operation.toLowerCase()} by ${req.user.name}`
    );

    res.json({
      success: true,
      message: 'Quantity updated successfully',
      data: updatedItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating quantity',
      error: error.message
    });
  }
};

// @desc    Get inventory summary
// @route   GET /api/inventory/summary
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getSummary = async (req, res, next) => {
  try {
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Use branch ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total items count
    const totalCount = await executeQuery(`
      SELECT COUNT(*) as count FROM inventory_items ${whereClause}
    `, params);

    // Get low stock count
    const lowStockCount = await executeQuery(`
      SELECT COUNT(*) as count FROM inventory_items 
      ${whereClause} AND current_stock <= min_stock_level
    `, params);

    // Get out of stock count
    const outOfStockCount = await executeQuery(`
      SELECT COUNT(*) as count FROM inventory_items 
      ${whereClause} AND current_stock = 0
    `, params);

    // Get total value
    const totalValue = await executeQuery(`
      SELECT SUM(current_stock * cost_price) as total_value FROM inventory_items ${whereClause}
    `, params);

    // Get category breakdown
    const categoryBreakdown = await executeQuery(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(current_stock) as total_stock,
        SUM(current_stock * cost_price) as total_value
      FROM inventory_items 
      ${whereClause}
      GROUP BY category
      ORDER BY count DESC
    `, params);

    res.json({
      success: true,
      data: {
        totalItems: totalCount[0].count,
        lowStockItems: lowStockCount[0].count,
        outOfStockItems: outOfStockCount[0].count,
        totalValue: totalValue[0].total_value || 0,
        categoryBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory summary',
      error: error.message
    });
  }
};

// @desc    Get inventory changes since timestamp
// @route   GET /api/inventory/changes/since
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getInventoryChangesSince = async (req, res, next) => {
  try {
    const { since } = req.query;
    
    if (!since) {
      return res.status(400).json({
        success: false,
        message: 'Since timestamp is required'
      });
    }

    let whereConditions = ['updated_at > ?'];
    let params = [since];

    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Use branch ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
    }

    const whereClause = whereConditions.join(' AND ');

    const changes = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      WHERE ${whereClause}
      ORDER BY i.updated_at DESC
    `, params);

    // Transform field names to match frontend expectations
    const transformedChanges = changes.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      currentStock: item.current_stock,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      branchName: item.branch_name,
      warehouseName: item.warehouse_name
    }));

    res.json({
      success: true,
      count: transformedChanges.length,
      data: transformedChanges,
      since: since,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory changes since timestamp',
      error: error.message
    });
  }
};

// @desc    Get latest inventory changes
// @route   GET /api/inventory/changes
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getLatestInventoryChanges = async (req, res, next) => {
  try {
    const { lastUpdate } = req.query;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Use warehouse ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Use branch ID directly for filtering (inventory items store numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
    }

    if (lastUpdate) {
      whereConditions.push('updated_at > ?');
      params.push(lastUpdate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const changes = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      ${whereClause}
      ORDER BY i.updated_at DESC
      LIMIT 50
    `, params);

    // Transform field names to match frontend expectations
    const transformedChanges = changes.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      currentStock: item.current_stock,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      branchName: item.branch_name,
      warehouseName: item.warehouse_name
    }));

    res.json({
      success: true,
      count: transformedChanges.length,
      data: transformedChanges,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving latest inventory changes',
      error: error.message
    });
  }
};

// @desc    Get cross-branch inventory
// @route   GET /api/inventory/cross-branch
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getCrossBranchInventory = async (req, res, next) => {
  try {
    const { category } = req.query;
    let whereConditions = ['i.scope_type = ?'];
    let params = ['BRANCH'];

    // Only show branches with open account setting
    whereConditions.push('JSON_EXTRACT(b.settings, "$.openAccount") = true');
    
    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }

    const whereClause = whereConditions.join(' AND ');

    const inventoryItems = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        b.code as branch_code,
        b.location as branch_location
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_id = b.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
    `, params);

    // Transform field names to match frontend expectations
    const transformedItems = inventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      currentStock: item.current_stock,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      branchName: item.branch_name,
      branchCode: item.branch_code,
      branchLocation: item.branch_location
    }));

    res.json({
      success: true,
      count: transformedItems.length,
      data: transformedItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving cross-branch inventory',
      error: error.message
    });
  }
};

// @desc    Get cross-warehouse inventory
// @route   GET /api/inventory/cross-warehouse
// @access  Private (Admin, Warehouse Keeper)
const getCrossWarehouseInventory = async (req, res, next) => {
  try {
    const { category } = req.query;
    const whereConditions = ['i.scope_type = ?'];
    const params = ['WAREHOUSE'];

    if (category) {
      whereConditions.push('i.category = ?');
      params.push(category);
    }

    if (req.user.role === 'WAREHOUSE_KEEPER' && req.user.warehouseId) {
      whereConditions.push('i.scope_id <> ?');
      params.push(req.user.warehouseId);
    }

    const whereClause = whereConditions.join(' AND ');

    const inventoryItems = await executeQuery(`
      SELECT 
        i.*,
        w.name AS warehouse_name,
        w.code AS warehouse_code,
        w.location AS warehouse_location
      FROM inventory_items i
      LEFT JOIN warehouses w ON i.scope_id = w.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
    `, params);

    const transformedItems = inventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      costPrice: item.cost_price,
      sellingPrice: item.selling_price,
      currentStock: item.current_stock,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level,
      scopeType: item.scope_type,
      scopeId: item.scope_id,
      createdBy: item.created_by,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      warehouseName: item.warehouse_name,
      warehouseCode: item.warehouse_code,
      warehouseLocation: item.warehouse_location
    }));

    res.json({
      success: true,
      count: transformedItems.length,
      data: transformedItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving cross-warehouse inventory',
      error: error.message
    });
  }
};

module.exports = {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  updateStock,
  getLowStockItems,
  updateQuantity,
  getSummary,
  getLatestInventoryChanges,
  getInventoryChangesSince,
  getCrossBranchInventory,
  getCrossWarehouseInventory
};