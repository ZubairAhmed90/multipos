const { validationResult } = require('express-validator');
const { PurchaseOrder, PurchaseOrderItem } = require('../models/PurchaseOrder');
const { executeQuery, pool } = require('../config/database');

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
    const validStatuses = ['PENDING', 'ORDERED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
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

    // If status is DELIVERED or COMPLETED, update inventory
    if (status === 'DELIVERED' || status === 'COMPLETED') {
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
    
    for (const item of orderItems) {
      if (item.inventoryItemId) {
        // Update existing inventory item
        await executeQuery(
          'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
          [item.quantityReceived, item.inventoryItemId]
        );
      } else {
        // Create new inventory item if it doesn't exist
        const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);
        
        await executeQuery(`
          INSERT INTO inventory_items (
            name, sku, description, category, unit, cost_price, selling_price, 
            min_stock_level, max_stock_level, current_stock, scope_type, scope_id, 
            supplier_id, supplier_name, purchase_date, purchase_price, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          item.itemName,
          item.itemSku || `ITEM-${Date.now()}`,
          item.itemDescription || 'Purchased item',
          'General',
          'PIECE',
          item.unitPrice,
          item.unitPrice * 1.2, // 20% markup
          0,
          1000,
          item.quantityReceived,
          purchaseOrder.scopeType,
          purchaseOrder.scopeId,
          purchaseOrder.supplierId,
          purchaseOrder.supplierName,
          purchaseOrder.orderDate,
          item.unitPrice,
          purchaseOrder.createdBy
        ]);
      }

      // Create stock movement record
      await executeQuery(`
        INSERT INTO stock_movements (
          inventory_item_id, movement_type, quantity, reference_type, reference_id,
          to_scope_type, to_scope_id, notes, created_by, created_at
        ) VALUES (?, 'PURCHASE', ?, 'PURCHASE_ORDER', ?, ?, ?, ?, ?, NOW())
      `, [
        item.inventoryItemId,
        item.quantityReceived,
        purchaseOrderId,
        purchaseOrder.scopeType,
        purchaseOrder.scopeId,
        `Purchase order delivery: ${purchaseOrder.orderNumber}`,
        purchaseOrder.createdBy
      ]);
    }
  } catch (error) {
    console.error('Error updating inventory from purchase order:', error);
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
