const { validationResult } = require('express-validator');
const { PurchaseOrder, PurchaseOrderItem } = require('../models/PurchaseOrder');
const { executeQuery, pool } = require('../config/database');
const { createStockReportEntry } = require('../middleware/stockTracking');

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getPurchaseOrders = async (req, res, next) => {
  try {
    const { 
      supplierId, 
      scopeType, 
      scopeId, 
      status, 
      orderDateFrom, 
      orderDateTo, 
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    // Build conditions object for filtering
    const conditions = {};
    if (supplierId) conditions.supplierId = supplierId;
    if (scopeType) conditions.scopeType = scopeType;
    if (scopeId) conditions.scopeId = scopeId;
    if (status) conditions.status = status;
    if (orderDateFrom) conditions.orderDateFrom = orderDateFrom;
    if (orderDateTo) conditions.orderDateTo = orderDateTo;
    if (search) conditions.search = search;

    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      conditions.scopeType = 'WAREHOUSE';
      conditions.scopeId = req.user.warehouseId;
    } else if (req.user.role === 'CASHIER') {
      conditions.scopeType = 'BRANCH';
      conditions.scopeId = req.user.branchId;
    }
    // Admins can see all purchase orders (no additional filtering)

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const options = {
      sort: '-created_at',
      limit: parseInt(limit),
      skip: skip
    };

    // Get purchase orders
    const purchaseOrders = await PurchaseOrder.find(conditions, options);
    const totalCount = await PurchaseOrder.count(conditions);

    res.json({
      success: true,
      count: purchaseOrders.length,
      total: totalCount,
      page: parseInt(page),
      pages: Math.ceil(totalCount / parseInt(limit)),
      data: purchaseOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase orders',
      error: error.message
    });
  }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getPurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const purchaseOrder = await PurchaseOrder.findById(id);
    
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (purchaseOrder.scopeType !== 'WAREHOUSE' || purchaseOrder.scopeId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only view purchase orders for your warehouse'
        });
      }
    } else if (req.user.role === 'CASHIER') {
      if (purchaseOrder.scopeType !== 'BRANCH' || purchaseOrder.scopeId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only view purchase orders for your branch'
        });
      }
    }

    res.json({
      success: true,
      data: purchaseOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving purchase order',
      error: error.message
    });
  }
};

// @desc    Create new purchase order
// @route   POST /api/purchase-orders
// @access  Private (Admin, Warehouse Keeper, Cashier)
const createPurchaseOrder = async (req, res, next) => {
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
      supplierId,
      scopeType,
      scopeId,
      orderDate,
      expectedDelivery,
      notes,
      items
    } = req.body;

    // Validate required fields
    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID and items are required'
      });
    }

    // Set scope based on user role if not provided
    let finalScopeType = scopeType;
    let finalScopeId = scopeId;

    if (req.user.role === 'WAREHOUSE_KEEPER') {
      finalScopeType = 'WAREHOUSE';
      finalScopeId = req.user.warehouseId;
    } else if (req.user.role === 'CASHIER') {
      finalScopeType = 'BRANCH';
      finalScopeId = req.user.branchId;
    }

    // Generate order number
    const orderNumber = await PurchaseOrder.generateOrderNumber(finalScopeType, finalScopeId);

    // Calculate total amount
    const totalAmount = items.reduce((total, item) => {
      return total + (item.quantityOrdered * item.unitPrice);
    }, 0);

    // Create purchase order
    const purchaseOrderData = {
      orderNumber,
      supplierId,
      scopeType: finalScopeType,
      scopeId: finalScopeId,
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      expectedDelivery,
      status: 'PENDING',
      totalAmount,
      notes,
      createdBy: req.user.id
    };

    const purchaseOrder = await PurchaseOrder.create(purchaseOrderData);

    // Create purchase order items
    for (const item of items) {
      await PurchaseOrderItem.create({
        purchaseOrderId: purchaseOrder.id,
        inventoryItemId: item.inventoryItemId || null,
        itemName: item.itemName,
        itemSku: item.itemSku || null,
        itemCategory: item.itemCategory || 'General',
        itemDescription: item.itemDescription || null,
        quantityOrdered: item.quantityOrdered,
        unitPrice: item.unitPrice,
        totalPrice: item.quantityOrdered * item.unitPrice,
        notes: item.notes || null
      });
    }

    // Get the complete purchase order with items
    const completeOrder = await PurchaseOrder.findById(purchaseOrder.id);

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: completeOrder
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase order',
      error: error.message
    });
  }
};

// @desc    Update purchase order status
// @route   PUT /api/purchase-orders/:id/status
// @access  Private (Admin, Warehouse Keeper, Cashier)
const updatePurchaseOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, actualDelivery, notes } = req.body;

    // Validate status
    const validStatuses = ['PENDING', 'APPROVED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    // Get the purchase order first to check permissions
    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (purchaseOrder.scopeType !== 'WAREHOUSE' || purchaseOrder.scopeId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only update purchase orders for your warehouse'
        });
      }
    } else if (req.user.role === 'CASHIER') {
      if (purchaseOrder.scopeType !== 'BRANCH' || purchaseOrder.scopeId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only update purchase orders for your branch'
        });
      }
    }

    // Update status
    const updatedOrder = await PurchaseOrder.updateStatus(id, status, actualDelivery);

    // If status is APPROVED, DELIVERED, or COMPLETED, update inventory
    if (status === 'APPROVED' || status === 'DELIVERED' || status === 'COMPLETED') {
      // When marking as COMPLETED, set quantityReceived to quantityOrdered if not already set
      if (status === 'COMPLETED') {
        const orderItems = await PurchaseOrderItem.findByOrderId(id);
        for (const item of orderItems) {
          // If quantityReceived is null or 0, set it to quantityOrdered
          if (!item.quantityReceived || item.quantityReceived === 0) {
            await executeQuery(
              'UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?',
              [item.quantityOrdered, item.id]
            );
            console.log(`[PurchaseOrder] Set quantityReceived=${item.quantityOrdered} for item ${item.id} (${item.itemName})`);
          }
        }
      }
      
      console.log(`[PurchaseOrder] Updating inventory for purchase order ${id} with status ${status}`);
      await updateInventoryFromPurchaseOrder(id);
    }

    res.json({
      success: true,
      message: 'Purchase order status updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating purchase order status',
      error: error.message
    });
  }
};

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private (Admin, Warehouse Keeper, Cashier)
const deletePurchaseOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the purchase order first to check permissions
    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      if (purchaseOrder.scopeType !== 'WAREHOUSE' || purchaseOrder.scopeId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only delete purchase orders for your warehouse'
        });
      }
    } else if (req.user.role === 'CASHIER') {
      if (purchaseOrder.scopeType !== 'BRANCH' || purchaseOrder.scopeId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only delete purchase orders for your branch'
        });
      }
    }

    // Only allow deletion of PENDING orders
    if (purchaseOrder.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending purchase orders can be deleted'
      });
    }

    // Delete purchase order (items will be deleted by CASCADE)
    await executeQuery('DELETE FROM purchase_orders WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting purchase order',
      error: error.message
    });
  }
};

// @desc    Get suppliers (companies that can supply items)
// @route   GET /api/purchase-orders/suppliers
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getSuppliers = async (req, res, next) => {
  try {
    const { search, scopeType, scopeId } = req.query;

    let whereConditions = ['status = ?'];
    let params = ['active'];

    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      whereConditions.push('(scope_type = ? OR scope_type = ?)');
      params.push('WAREHOUSE', 'COMPANY');
      whereConditions.push('(scope_id = ? OR scope_id = ?)');
      params.push(req.user.warehouseId, '1');
    } else if (req.user.role === 'CASHIER') {
      whereConditions.push('(scope_type = ? OR scope_type = ?)');
      params.push('BRANCH', 'COMPANY');
      whereConditions.push('(scope_id = ? OR scope_id = ?)');
      params.push(req.user.branchId, '1');
    }

    if (search) {
      whereConditions.push('(name LIKE ? OR contact_person LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const suppliers = await executeQuery(`
      SELECT id, name, code, contact_person, phone, email, address, transaction_type
      FROM companies 
      ${whereClause}
      ORDER BY name ASC
    `, params);

    res.json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving suppliers',
      error: error.message
    });
  }
};

// Helper function to update inventory when purchase order is delivered
const updateInventoryFromPurchaseOrder = async (purchaseOrderId) => {
  try {
    const orderItems = await PurchaseOrderItem.findByOrderId(purchaseOrderId);
    
    // Get purchase order details for linking supplier info
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
    
    if (!purchaseOrder) {
      throw new Error(`Purchase order ${purchaseOrderId} not found`);
    }
    
    // Debug: Log purchase order details
    console.log(`[PurchaseOrder] 🔍 Purchase order details:`, {
      id: purchaseOrder.id,
      orderNumber: purchaseOrder.orderNumber,
      supplierId: purchaseOrder.supplierId,
      supplierName: purchaseOrder.supplierName,
      orderDate: purchaseOrder.orderDate,
      scopeType: purchaseOrder.scopeType,
      scopeId: purchaseOrder.scopeId,
      scopeName: purchaseOrder.scopeName
    });
    
    // Get user info for stock tracking
    // Note: users table may not have 'name' column, use username instead
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [purchaseOrder.createdBy]
    );
    const user = users[0] || { id: purchaseOrder.createdBy, name: 'System', username: 'system', role: 'ADMIN' };
    // Add name property using username if not present
    if (user && !user.name) {
      user.name = user.username || 'System';
    }
    
    console.log(`[PurchaseOrder] Processing ${orderItems.length} items for purchase order ${purchaseOrder.orderNumber}`);
    
    for (const item of orderItems) {
      // Use quantityReceived if it's set and > 0, otherwise use quantityOrdered
      // Handle case where quantityReceived might be 0 explicitly
      const quantityToAdd = (item.quantityReceived != null && item.quantityReceived > 0) 
        ? item.quantityReceived 
        : (item.quantityOrdered || 0);
      
      console.log(`[PurchaseOrder] Processing item: ${item.itemName}, quantityOrdered: ${item.quantityOrdered}, quantityReceived: ${item.quantityReceived}, quantityToAdd: ${quantityToAdd}, unitPrice: ${item.unitPrice}`);
      
      if (quantityToAdd <= 0) {
        console.warn(`[PurchaseOrder] Skipping item ${item.itemName} - quantityToAdd is ${quantityToAdd}`);
        continue;
      }
      
      let inventoryItemId = item.inventoryItemId;
      let previousQuantity = 0;
      let newQuantity = 0;
      
      if (inventoryItemId) {
        // Update existing inventory item - get current stock first
        const [existingItems] = await pool.execute(
          'SELECT id, current_stock FROM inventory_items WHERE id = ?',
          [inventoryItemId]
        );
        
        if (existingItems.length > 0) {
          previousQuantity = parseFloat(existingItems[0].current_stock) || 0;
          newQuantity = previousQuantity + quantityToAdd;
          
          console.log(`[PurchaseOrder] 📝 Updating existing inventory item ${inventoryItemId}:`, {
            previousStock: previousQuantity,
            quantityToAdd,
            newStock: newQuantity,
            supplierId: purchaseOrder.supplierId,
            supplierName: purchaseOrder.supplierName,
            orderDate: purchaseOrder.orderDate,
            unitPrice: item.unitPrice
          });
          
          // Update existing inventory item - update stock AND supplier/purchase info
          await executeQuery(
            `UPDATE inventory_items 
             SET current_stock = current_stock + ?, 
                 supplier_id = ?, 
                 supplier_name = ?, 
                 purchase_date = ?, 
                 purchase_price = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [
              quantityToAdd,
              purchaseOrder.supplierId || null,
              purchaseOrder.supplierName || null,
              purchaseOrder.orderDate || null,
              item.unitPrice || 0,
              inventoryItemId
            ]
          );
          
          console.log(`[PurchaseOrder] ✅ Successfully updated inventory item ${inventoryItemId}`);
        } else {
          console.error(`[PurchaseOrder] ❌ Inventory item ${inventoryItemId} not found!`);
        }
      } else {
        // Check if item with same name AND SKU already exists in this scope
        // Match by BOTH name AND SKU (not OR) to ensure exact match
        const searchSku = item.itemSku;
        const searchName = item.itemName;
        
        // Try to get scope name if scopeId is numeric (for branches/warehouses)
        let scopeName = null;
        if (purchaseOrder.scopeType === 'BRANCH' && !isNaN(purchaseOrder.scopeId)) {
          const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [purchaseOrder.scopeId]);
          if (branches.length > 0) scopeName = branches[0].name;
        } else if (purchaseOrder.scopeType === 'WAREHOUSE' && !isNaN(purchaseOrder.scopeId)) {
          const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [purchaseOrder.scopeId]);
          if (warehouses.length > 0) scopeName = warehouses[0].name;
        }
        
        // Search for existing item - match by BOTH name AND SKU, and scope (ID or name)
        let scopeMatchCondition = '(scope_id = ? OR scope_id = ?)';
        let scopeParams = [String(purchaseOrder.scopeId), purchaseOrder.scopeId];
        
        if (scopeName) {
          scopeMatchCondition = '(scope_id = ? OR scope_id = ? OR scope_id = ?)';
          scopeParams.push(scopeName);
        }
        
        // Build name and SKU matching condition - require BOTH to match
        let nameSkuCondition = '';
        let nameSkuParams = [];
        
        if (searchSku && searchSku.trim() !== '') {
          // If SKU is provided, match by BOTH name AND SKU
          nameSkuCondition = 'name = ? AND sku = ?';
          nameSkuParams = [searchName, searchSku];
        } else {
          // If no SKU, match only by name
          nameSkuCondition = 'name = ? AND (sku IS NULL OR sku = ?)';
          nameSkuParams = [searchName, ''];
        }
        
        console.log(`[PurchaseOrder] 🔍 Searching for existing item: name="${searchName}", SKU="${searchSku || 'N/A'}", scopeType="${purchaseOrder.scopeType}", scopeId="${purchaseOrder.scopeId}", scopeName="${scopeName || 'N/A'}"`);
        console.log(`[PurchaseOrder] 🔍 Search query: WHERE ${nameSkuCondition} AND scope_type = ? AND ${scopeMatchCondition}`);
        
        const [existingItems] = await pool.execute(
          `SELECT id, current_stock FROM inventory_items 
           WHERE ${nameSkuCondition}
           AND scope_type = ? 
           AND ${scopeMatchCondition}
           LIMIT 1`,
          [
            ...nameSkuParams,
            purchaseOrder.scopeType,
            ...scopeParams
          ]
        );
        
        console.log(`[PurchaseOrder] 🔍 Search result: found ${existingItems.length} existing item(s)`);
        
        if (existingItems.length > 0) {
          // Item exists - update it instead of creating new one
          inventoryItemId = existingItems[0].id;
          previousQuantity = parseFloat(existingItems[0].current_stock) || 0;
          newQuantity = previousQuantity + quantityToAdd;
          
          console.log(`[PurchaseOrder] ✅ Found existing item: ${item.itemName} (SKU: ${searchSku || 'N/A'}), ID: ${inventoryItemId}, updating stock from ${previousQuantity} to ${newQuantity}`);
          
          console.log(`[PurchaseOrder] 📝 Updating existing inventory item ${inventoryItemId} (found by search):`, {
            previousStock: previousQuantity,
            quantityToAdd,
            newStock: newQuantity,
            supplierId: purchaseOrder.supplierId,
            supplierName: purchaseOrder.supplierName,
            orderDate: purchaseOrder.orderDate,
            unitPrice: item.unitPrice || 0
          });
          
          await executeQuery(
            `UPDATE inventory_items 
             SET current_stock = current_stock + ?, 
                 supplier_id = ?, 
                 supplier_name = ?, 
                 purchase_date = ?, 
                 purchase_price = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [
              quantityToAdd,
              purchaseOrder.supplierId || null,
              purchaseOrder.supplierName || null,
              purchaseOrder.orderDate || null,
              item.unitPrice || 0, // Allow 0 price
              inventoryItemId
            ]
          );
          
          console.log(`[PurchaseOrder] ✅ Updated existing inventory item ${inventoryItemId}: added ${quantityToAdd}, new stock: ${newQuantity}`);
      } else {
          // Create new inventory item if it truly doesn't exist
          console.log(`[PurchaseOrder] ➕ Creating new inventory item: ${item.itemName} (SKU: ${searchSku || 'N/A'})`);
          
          console.log(`[PurchaseOrder] ➕ Creating new inventory item:`, {
            itemName: item.itemName,
            itemSku: item.itemSku,
            category: item.itemCategory || 'General',
            quantityToAdd,
            scopeType: purchaseOrder.scopeType,
            scopeId: purchaseOrder.scopeId,
            supplierId: purchaseOrder.supplierId,
            supplierName: purchaseOrder.supplierName,
            orderDate: purchaseOrder.orderDate,
            unitPrice: item.unitPrice || 0
          });
          
          const insertResult = await executeQuery(`
          INSERT INTO inventory_items (
            name, sku, description, category, unit, cost_price, selling_price, 
            min_stock_level, max_stock_level, current_stock, scope_type, scope_id, 
            supplier_id, supplier_name, purchase_date, purchase_price, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.itemName,
          item.itemSku || `ITEM-${Date.now()}`,
          item.itemDescription || 'Purchased item',
          item.itemCategory || 'General',
          'PIECE',
          item.unitPrice || 0, // Allow 0 price
          (item.unitPrice || 0) * 1.2, // 20% markup (will be 0 if unitPrice is 0)
          0,
          1000,
          quantityToAdd,
          purchaseOrder.scopeType,
          purchaseOrder.scopeId,
          purchaseOrder.supplierId || null,
          purchaseOrder.supplierName || null,
          purchaseOrder.orderDate || null,
          item.unitPrice || 0, // Allow 0 price
          purchaseOrder.createdBy
        ]);
          
          inventoryItemId = insertResult.insertId || insertResult.lastID;
          previousQuantity = 0;
          newQuantity = quantityToAdd;
          
          console.log(`[PurchaseOrder] ✅ Created new inventory item: ${item.itemName} (ID: ${inventoryItemId}), initial stock: ${quantityToAdd}`);
        }
      }

      // Update purchase_order_items with inventory_item_id if it was missing
      if (inventoryItemId && !item.inventoryItemId) {
        try {
          await executeQuery(
            'UPDATE purchase_order_items SET inventory_item_id = ? WHERE id = ?',
            [inventoryItemId, item.id]
          );
          console.log(`[PurchaseOrder] Updated purchase_order_items.id=${item.id} with inventory_item_id=${inventoryItemId}`);
        } catch (updateError) {
          console.error('[PurchaseOrder] Error updating purchase_order_items:', updateError);
          // Don't fail if this update fails
        }
      }

      // Create stock_reports entry for tracking purchased quantity
      if (inventoryItemId && quantityToAdd > 0) {
        try {
          console.log(`[PurchaseOrder] 📊 Creating stock report entry for item ${inventoryItemId}:`, {
            transactionType: 'PURCHASE',
            quantityChange: quantityToAdd,
            previousQuantity,
            newQuantity,
            unitPrice: item.unitPrice || 0,
            totalValue: (item.unitPrice || 0) * quantityToAdd,
            userId: user.id,
            userName: user.name || user.username,
            userRole: user.role,
            adjustmentReason: `Purchase order: ${purchaseOrder.orderNumber}`
          });
          
          await createStockReportEntry({
            inventoryItemId: inventoryItemId,
            transactionType: 'PURCHASE',
            quantityChange: quantityToAdd,
            previousQuantity: previousQuantity,
            newQuantity: newQuantity,
            unitPrice: item.unitPrice || 0,
            totalValue: (item.unitPrice || 0) * quantityToAdd,
            userId: user.id,
            userName: user.name || user.username,
            userRole: user.role,
            adjustmentReason: `Purchase order: ${purchaseOrder.orderNumber}`
          });
          
          console.log(`[PurchaseOrder] ✅ Successfully created stock report entry for item ${inventoryItemId}, quantity: ${quantityToAdd}, previous: ${previousQuantity}, new: ${newQuantity}`);
        } catch (stockError) {
          console.error('[PurchaseOrder] ❌ Error creating stock report entry:', stockError);
          console.error('[PurchaseOrder] Stock error stack:', stockError.stack);
          // Don't fail the purchase order update if stock tracking fails, but log it
          console.warn('[PurchaseOrder] ⚠️ Continuing despite stock report error - inventory was updated but stock_reports entry failed');
        }
      } else {
        console.warn(`[PurchaseOrder] ⚠️ Skipping stock report entry - inventoryItemId: ${inventoryItemId}, quantityToAdd: ${quantityToAdd}`);
      }
      
      console.log(`[PurchaseOrder] ✅ Completed processing item ${item.itemName}: inventoryItemId=${inventoryItemId}, quantityAdded=${quantityToAdd}`);
    }
    
    console.log(`[PurchaseOrder] ✅ Successfully updated inventory for purchase order ${purchaseOrder.orderNumber}`);
  } catch (error) {
    console.error('[PurchaseOrder] ❌ Error updating inventory from purchase order:', error);
    console.error('[PurchaseOrder] Error stack:', error.stack);
    throw error;
  }
};

module.exports = {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  getSuppliers
};
