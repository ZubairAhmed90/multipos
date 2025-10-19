const { validationResult } = require('express-validator');
const InventoryItem = require('../models/InventoryItem');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const { executeQuery, pool } = require('../config/database');
const { createStockReportEntry, createAdjustmentTransaction } = require('../middleware/stockTracking');

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
    
    const { scopeType, scopeId, category, includeCrossBranch = false } = req.query;
    let whereConditions = [];
    let params = [];
    
    // Admin can see everything
    if (req.user.role === 'ADMIN') {
      if (scopeType && scopeId) {
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push(scopeType, scopeId);
      }
    } else {
      // Non-admin users have scope restrictions
      if (req.user.role === 'WAREHOUSE_KEEPER') {
        // Warehouse keepers can ONLY see their assigned warehouse inventory
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push('WAREHOUSE', req.user.warehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Cashiers can see their assigned branch inventory
      // Use branch ID directly for filtering (inventory items store numeric IDs)
      console.log('[InventoryController] Cashier branch filtering:', {
        branchId: req.user.branchId,
        role: req.user.role
      });
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', req.user.branchId);
      
      // If specific branch requested, filter to that branch
      if (scopeType === 'BRANCH' && scopeId) {
        whereConditions.push('scope_id = ?');
        params.push(scopeId);
      }
    }
    }
    
    // Filter by category if provided
    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    console.log('[InventoryController] Final query conditions:', {
      whereClause,
      params,
      userRole: req.user.role
    });
    
    const inventoryItems = await executeQuery(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name,
        COALESCE(sr.total_purchased, 0) as total_purchased,
        COALESCE(sr.total_sold, 0) as total_sold,
        COALESCE(sr.total_returned, 0) as total_returned,
        COALESCE(sr.total_adjusted, 0) as total_adjusted
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      LEFT JOIN (
        SELECT 
          inventory_item_id,
          SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as total_purchased,
          SUM(CASE WHEN transaction_type = 'SALE' THEN ABS(quantity_change) ELSE 0 END) as total_sold,
          SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as total_returned,
          SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as total_adjusted
        FROM stock_reports 
        GROUP BY inventory_item_id
      ) sr ON i.id = sr.inventory_item_id
      ${whereClause}
      ORDER BY i.created_at DESC
    `, params);
    
    // Transform field names to match frontend expectations
    const transformedItems = inventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
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
      warehouseName: item.warehouse_name,
      totalPurchased: parseFloat(item.total_purchased) || 0,
      totalSold: parseFloat(item.total_sold) || 0,
      totalReturned: parseFloat(item.total_returned) || 0,
      totalAdjusted: parseFloat(item.total_adjusted) || 0
    }));
    
    res.json({
      success: true,
      count: transformedItems.length,
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
      scopeId
    } = req.body;

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

    const inventoryItem = await InventoryItem.create({
      sku: finalSku,
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
      scopeId: scopeId, // Store branch/warehouse ID instead of name
      createdBy: req.user.id
    });

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
    res.status(500).json({
      success: false,
      message: 'Error creating inventory item',
      error: error.message
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
      if (newStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock'
        });
      }
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
      if (newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock'
        });
      }
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
    let whereConditions = ['scope_type = ?'];
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
  getCrossBranchInventory
};