const { validationResult } = require('express-validator');
const Transfer = require('../models/Transfer');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const { pool } = require('../config/database');

// @desc    Create new transfer (integrated with branch/warehouse settings)
// @route   POST /api/transfers
// @access  Private (Admin, Cashier, Warehouse Keeper with permissions)
const createTransfer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      transferType, fromScopeType, fromScopeId, toScopeType, toScopeId, items, notes
    } = req.body;

    // Convert scope format to database format
    let fromWarehouseId = null, toWarehouseId = null, fromBranchId = null, toBranchId = null;
    
    if (fromScopeType === 'WAREHOUSE') {
      fromWarehouseId = fromScopeId;
    } else if (fromScopeType === 'BRANCH') {
      fromBranchId = fromScopeId;
    }
    
    if (toScopeType === 'WAREHOUSE') {
      toWarehouseId = toScopeId;
    } else if (toScopeType === 'BRANCH') {
      toBranchId = toScopeId;
    }

    // Role-based validation and permission checks
    if (req.user.role === 'CASHIER') {
      // Cashiers can only create branch transfers
      if (transferType !== 'BRANCH_TO_BRANCH') {
        return res.status(400).json({
          success: false,
          message: 'Cashiers can only create branch transfers'
        });
      }
      
      // Check if branch transfers are allowed for this specific branch
      const branch = await Branch.findById(fromBranchId);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Source branch not found'
        });
      }
      
      if (!branch.allowBranchTransfers) {
        return res.status(403).json({
          success: false,
          message: 'Branch transfers are disabled for this branch'
        });
      }
      
      // Check if branch-to-branch transfers are allowed
      if (toBranchId && !branch.allowBranchToBranchTransfers) {
        return res.status(403).json({
          success: false,
          message: 'Branch-to-branch transfers are disabled for this branch'
        });
      }
      
      // Validate cashier can only transfer from their branch
      if (fromBranchId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'You can only transfer from your own branch'
        });
      }
      
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only create warehouse transfers
      if (transferType !== 'WAREHOUSE_TO_WAREHOUSE') {
        return res.status(400).json({
          success: false,
          message: 'Warehouse keepers can only create warehouse transfers'
        });
      }
      
      // Check if warehouse transfers are allowed for this specific warehouse
      const warehouse = await Warehouse.findById(fromWarehouseId);
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'Source warehouse not found'
        });
      }
      
      if (!warehouse.allowWarehouseTransfers) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse transfers are disabled for this warehouse'
        });
      }
      
      // Check if warehouse-to-warehouse transfers are allowed
      if (toWarehouseId && !warehouse.allowWarehouseToWarehouseTransfers) {
        return res.status(403).json({
          success: false,
          message: 'Warehouse-to-warehouse transfers are disabled for this warehouse'
        });
      }
      
      // Validate warehouse keeper can only transfer from their warehouse
      if (fromWarehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'You can only transfer from your own warehouse'
        });
      }
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer must contain at least one item'
      });
    }

    // Check inventory availability based on transfer type
    for (const item of items) {
      let scopeType, scopeId;
      
      if (transferType === 'WAREHOUSE_TO_WAREHOUSE') {
        scopeType = 'WAREHOUSE';
        scopeId = fromWarehouseId;
      } else if (transferType === 'BRANCH_TO_BRANCH') {
        scopeType = 'BRANCH';
        scopeId = fromBranchId;
      } else {
        // For mixed transfers, use the from scope
        scopeType = fromScopeType;
        scopeId = fromScopeId;
      }
      
      const [inventory] = await pool.execute(`
        SELECT current_stock FROM inventory_items 
        WHERE id = ? AND scope_type = ? AND scope_id = ?
      `, [item.inventoryItemId, scopeType, scopeId]);

      if (inventory.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Item with ID ${item.inventoryItemId} not found in source location`
        });
      }

      if (inventory[0].current_stock < item.quantityRequested) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item ${item.inventoryItemId}. Available: ${inventory[0].current_stock}, Requested: ${item.quantityRequested}`
        });
      }
    }

    // Create transfer with correct field names
    const transferData = {
      transferType,
      fromWarehouseId,
      toWarehouseId,
      fromBranchId,
      toBranchId,
      createdBy: req.user.id,
      items: items.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantityRequested
      })),
      notes
    };
    
    console.log('🔍 Creating transfer with data:', transferData);

    // Start transaction for inventory updates
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Create transfer record using the same connection
      const transfer = await Transfer.create(transferData, connection);
      
      // Immediately update inventory to reserve stock
      for (const item of items) {
        let scopeType, scopeId;
        
        if (transferType === 'WAREHOUSE_TO_WAREHOUSE') {
          scopeType = 'WAREHOUSE';
          scopeId = fromWarehouseId;
        } else if (transferType === 'BRANCH_TO_BRANCH') {
          scopeType = 'BRANCH';
          scopeId = fromBranchId;
        } else {
          // For mixed transfers, use the from scope
          scopeType = fromScopeType;
          scopeId = fromScopeId;
        }
        
        // Reduce inventory at source location
        const [updateResult] = await connection.execute(`
          UPDATE inventory_items 
          SET current_stock = current_stock - ?
          WHERE id = ? AND scope_type = ? AND scope_id = ?
        `, [item.quantityRequested, item.inventoryItemId, scopeType, scopeId]);
        
        if (updateResult.affectedRows === 0) {
          throw new Error(`Failed to update inventory for item ${item.inventoryItemId}`);
        }
        
        // Create stock movement record for audit trail
        try {
          await connection.execute(`
            INSERT INTO stock_movements (
              movement_type, inventory_item_id, quantity, 
              reference_type, reference_id, 
              from_scope_type, from_scope_id,
              created_by, created_at
            ) VALUES (?, ?, ?, 'TRANSFER', ?, ?, ?, ?, NOW())
          `, [
            'TRANSFER_OUT', 
            item.inventoryItemId, 
            item.quantityRequested,
            transfer.id,
            scopeType, 
            scopeId,
            req.user.id
          ]);
        } catch (movementError) {
          console.warn('Could not create stock movement record:', movementError.message);
          // Continue without failing the transfer
        }
      }
      
      await connection.commit();
      
      console.log('✅ Transfer created successfully:', {
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        status: transfer.status,
        itemsCount: transfer.items?.length || 0
      });
      
      res.status(201).json({
        success: true,
        message: 'Transfer created successfully and inventory updated',
        data: transfer
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('[TransferController] Error creating transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transfer',
      error: error.message
    });
  }
};

// @desc    Complete transfer and update inventory
// @route   PUT /api/transfers/:id/complete
// @access  Private (Admin, Warehouse Keeper)
const completeTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Get transfer details
    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }

    if (transfer.status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Transfer must be approved before completion'
      });
    }

    // Start transaction for inventory updates
    await pool.execute('START TRANSACTION');

    try {
      // Process each item in the transfer
      for (const item of transfer.items) {
        // Note: Inventory was already reduced at source when transfer was created
        // Now we just need to add it to the destination
        
        // Determine destination scope based on transfer type
        let destinationScopeType, destinationScopeId;
        
        if (transfer.transfer_type === 'WAREHOUSE_TO_WAREHOUSE') {
          destinationScopeType = 'WAREHOUSE';
          destinationScopeId = transfer.to_warehouse_id;
        } else if (transfer.transfer_type === 'BRANCH_TO_BRANCH') {
          destinationScopeType = 'BRANCH';
          destinationScopeId = transfer.to_branch_id;
        } else {
          throw new Error('Unsupported transfer type for completion');
        }

        // Check if item exists at destination
        const [existingItem] = await pool.execute(`
          SELECT id, current_stock FROM inventory_items 
          WHERE sku = (SELECT sku FROM inventory_items WHERE id = ?) 
          AND scope_type = ? AND scope_id = ?
        `, [item.inventory_item_id, destinationScopeType, destinationScopeId]);

        if (existingItem.length > 0) {
          // Update existing item at destination
          await pool.execute(`
            UPDATE inventory_items 
            SET current_stock = current_stock + ?
            WHERE id = ?
          `, [item.quantity, existingItem[0].id]);
        } else {
          // Create new item at destination (copy from source)
          const [sourceItem] = await pool.execute(`
            SELECT * FROM inventory_items WHERE id = ?
          `, [item.inventory_item_id]);

          if (sourceItem.length > 0) {
            await pool.execute(`
              INSERT INTO inventory_items (
                sku, name, description, category, unit, cost_price, selling_price,
                min_stock_level, max_stock_level, current_stock, scope_type, scope_id, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              sourceItem[0].sku,
              sourceItem[0].name,
              sourceItem[0].description,
              sourceItem[0].category,
              sourceItem[0].unit,
              sourceItem[0].cost_price,
              sourceItem[0].selling_price,
              sourceItem[0].min_stock_level,
              sourceItem[0].max_stock_level,
              item.quantity, // Initial stock at destination
              destinationScopeType,
              destinationScopeId,
              req.user.id
            ]);
          }
        }

        // Log stock movement for source (outbound)
        await pool.execute(`
          INSERT INTO stock_movements (
            inventory_item_id, movement_type, quantity, reference_type, reference_id,
            from_scope_type, from_scope_id, to_scope_type, to_scope_id,
            notes, created_by
          ) VALUES (?, 'TRANSFER_OUT', ?, 'TRANSFER', ?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?)
        `, [
          item.inventory_item_id,
          -item.quantity, // Negative for outbound
          transfer.id,
          transfer.from_warehouse_id,
          destinationScopeType,
          destinationScopeId,
          `Transfer to ${destinationScopeType === 'WAREHOUSE' ? 'Warehouse' : 'Branch'} - ${notes || 'Transfer completed'}`,
          req.user.id
        ]);

        // Log stock movement for destination (inbound)
        const [destinationItem] = await pool.execute(`
          SELECT id FROM inventory_items 
          WHERE sku = (SELECT sku FROM inventory_items WHERE id = ?) 
          AND scope_type = ? AND scope_id = ?
        `, [item.inventory_item_id, destinationScopeType, destinationScopeId]);

        if (destinationItem.length > 0) {
          await pool.execute(`
            INSERT INTO stock_movements (
              inventory_item_id, movement_type, quantity, reference_type, reference_id,
              from_scope_type, from_scope_id, to_scope_type, to_scope_id,
              notes, created_by
            ) VALUES (?, 'TRANSFER_IN', ?, 'TRANSFER', ?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?)
          `, [
            destinationItem[0].id,
            item.quantity, // Positive for inbound
            transfer.id,
            transfer.from_warehouse_id,
            destinationScopeType,
            destinationScopeId,
            `Transfer from Warehouse - ${notes || 'Transfer completed'}`,
            req.user.id
          ]);
        }
      }

      // Update transfer status to completed
      await pool.execute(`
        UPDATE transfers 
        SET status = 'COMPLETED', approved_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [req.user.id, id]);

      await pool.execute('COMMIT');

      // Get updated transfer details
      const updatedTransfer = await Transfer.findById(id);

      res.json({
        success: true,
        message: 'Transfer completed successfully and inventory updated',
        data: updatedTransfer
      });

    } catch (error) {
      await pool.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('[TransferController] Error completing transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing transfer',
      error: error.message
    });
  }
};

// @desc    Get transfer logs for admin
// @route   GET /api/transfers/logs
// @access  Private (Admin only)
const getTransferLogs = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view transfer logs'
      });
    }

    const {
      startDate, endDate, status, fromWarehouseId, toWarehouseId, toBranchId,
      page = 1, limit = 50
    } = req.query;

    let whereConditions = [];
    let params = [];

    if (startDate) {
      whereConditions.push('DATE(t.created_at) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push('DATE(t.created_at) <= ?');
      params.push(endDate);
    }
    if (status) {
      whereConditions.push('t.status = ?');
      params.push(status);
    }
    if (fromWarehouseId) {
      whereConditions.push('t.from_warehouse_id = ?');
      params.push(fromWarehouseId);
    }
    if (toWarehouseId) {
      whereConditions.push('t.to_warehouse_id = ?');
      params.push(toWarehouseId);
    }
    if (toBranchId) {
      whereConditions.push('t.to_branch_id = ?');
      params.push(toBranchId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Get transfer logs with details
    const [logs] = await pool.execute(`
      SELECT 
        t.*,
        u1.username as created_by_name,
        u2.username as approved_by_name,
        w1.name as from_warehouse_name,
        w2.name as to_warehouse_name,
        b.name as to_branch_name,
        COUNT(ti.id) as item_count,
        SUM(ti.quantity) as total_quantity
      FROM transfers t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.approved_by = u2.id
      LEFT JOIN warehouses w1 ON t.from_warehouse_id = w1.id
      LEFT JOIN warehouses w2 ON t.to_warehouse_id = w2.id
      LEFT JOIN branches b ON t.to_branch_id = b.id
      LEFT JOIN transfer_items ti ON t.id = ti.transfer_id
      ${whereClause}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get total count
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM transfers t ${whereClause}
    `, params);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfer logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer logs',
      error: error.message
    });
  }
};

// @desc    Get stock movements for transfers
// @route   GET /api/transfers/:id/movements
// @access  Private (Admin, Warehouse Keeper)
const getTransferMovements = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [movements] = await pool.execute(`
      SELECT 
        sm.*,
        ii.name as item_name,
        ii.sku,
        w1.name as from_warehouse_name,
        w2.name as to_warehouse_name,
        b.name as to_branch_name,
        u.username as created_by_name
      FROM stock_movements sm
      LEFT JOIN inventory_items ii ON sm.inventory_item_id = ii.id
      LEFT JOIN warehouses w1 ON sm.from_scope_type = 'WAREHOUSE' AND sm.from_scope_id = w1.id
      LEFT JOIN warehouses w2 ON sm.to_scope_type = 'WAREHOUSE' AND sm.to_scope_id = w2.id
      LEFT JOIN branches b ON sm.to_scope_type = 'BRANCH' AND sm.to_scope_id = b.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.reference_type = 'TRANSFER' AND sm.reference_id = ?
      ORDER BY sm.created_at DESC
    `, [id]);

    res.json({
      success: true,
      data: movements
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfer movements:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer movements',
      error: error.message
    });
  }
};

// @desc    Validate transfer type based on business rules
const validateTransferType = (fromWarehouseId, toWarehouseId, toBranchId) => {
  // Check if we have a valid destination
  if (!toWarehouseId && !toBranchId) {
    return {
      valid: false,
      message: 'Transfer must have either a destination warehouse or branch'
    };
  }

  // Check if we have both destinations (should not happen)
  if (toWarehouseId && toBranchId) {
    return {
      valid: false,
      message: 'Transfer cannot have both destination warehouse and branch'
    };
  }

  // Business Rules:
  // 1. Branch can only transfer to other branches
  // 2. Warehouse can only transfer to other warehouses
  
  // For now, we only support warehouse-to-warehouse transfers
  // Branch transfers will be implemented separately
  if (toBranchId) {
    return {
      valid: false,
      message: 'Branch transfers are not supported yet. Only warehouse-to-warehouse transfers are allowed.'
    };
  }

  // Warehouse-to-warehouse transfer is valid
  if (toWarehouseId) {
    return {
      valid: true,
      message: 'Warehouse-to-warehouse transfer is valid'
    };
  }

  return {
    valid: false,
    message: 'Invalid transfer configuration'
  };
};

// @desc    Check transfer permission based on user role and location settings
const checkTransferPermission = async (user, fromWarehouseId, toWarehouseId, toBranchId) => {
  try {
    // Admin can do anything
    if (user.role === 'ADMIN') return true;

    // Get source warehouse settings
    const [warehouseRows] = await pool.execute(
      'SELECT * FROM warehouses WHERE id = ?',
      [fromWarehouseId]
    );

    if (warehouseRows.length === 0) return false;
    const warehouse = warehouseRows[0];

    // Check warehouse transfer settings
    if (!warehouse.allow_warehouse_transfers) return false;

    // Check specific transfer type permissions
    if (toWarehouseId && !warehouse.allow_warehouse_to_warehouse_transfers) return false;
    
    // Branch transfers are not supported yet
    if (toBranchId) return false;

    // Check if user belongs to this warehouse
    if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId !== fromWarehouseId) {
      return false;
    }

    // Only warehouse keepers and admins can create warehouse transfers
    if (user.role === 'CASHIER') {
      return false; // Cashiers cannot create warehouse transfers
    }

    return true;
  } catch (error) {
    console.error('Error checking transfer permission:', error);
    return false;
  }
};

// @desc    Get all transfers with filtering
// @route   GET /api/transfers
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getTransfers = async (req, res) => {
  console.log('🚀 getTransfers function called!')
  try {
    const {
      fromWarehouseId, toWarehouseId, toBranchId, status,
      startDate, endDate, search, page, limit, sortBy, sortOrder,
      cashierBranchId, warehouseKeeperWarehouseId
    } = req.query;

    // Build filters based on user role
    const filters = {};
    const options = { page: parseInt(page) || 1, limit: parseInt(limit) || 50 };

    console.log('🔍 getTransfers - User role:', req.user.role, 'Query params:', req.query);
    
    // Apply role-based filtering using ACTUAL database schema
    // Use explicit parameters if provided, otherwise fall back to user role
    if (cashierBranchId) {
      // Frontend explicitly requested cashier filtering
      filters.cashierBranchId = parseInt(cashierBranchId);
      console.log('🔍 Applied cashierBranchId filter:', filters.cashierBranchId);
    } else if (req.user.role === 'CASHIER') {
      // Fall back to user's branch for cashiers
      filters.cashierBranchId = req.user.branchId;
      console.log('🔍 Applied CASHIER role filter:', filters.cashierBranchId);
    }
    
    if (warehouseKeeperWarehouseId) {
      // Frontend explicitly requested warehouse keeper filtering
      filters.warehouseKeeperWarehouseId = parseInt(warehouseKeeperWarehouseId);
      console.log('🔍 Applied warehouseKeeperWarehouseId filter:', filters.warehouseKeeperWarehouseId);
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Fall back to user's warehouse for warehouse keepers
      filters.warehouseKeeperWarehouseId = req.user.warehouseId;
      console.log('🔍 Applied WAREHOUSE_KEEPER role filter:', filters.warehouseKeeperWarehouseId);
    }
    
    console.log('🔍 Final filters:', filters);
    // Admin can see all transfers (no additional filtering)

    // Apply query filters using ACTUAL database schema
    if (fromWarehouseId) filters.fromWarehouseId = fromWarehouseId;
    if (toWarehouseId) filters.toWarehouseId = toWarehouseId;
    if (toBranchId) filters.toBranchId = toBranchId;
    if (status && status !== 'all') filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (search) filters.search = search;
    if (sortBy) options.sortBy = sortBy;
    if (sortOrder) options.sortOrder = sortOrder;

    // Test query - get all transfers without any filtering
    console.log('🔍 Testing simple query - getting all transfers...')
    const testResult = await Transfer.find({}, { page: 1, limit: 10 });
    console.log('🔍 Test query result:', testResult);

    const result = await Transfer.find(filters, options);

    res.json({
      success: true,
      data: result.transfers,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfers',
      error: error.message
    });
  }
};

// @desc    Get single transfer by ID
// @route   GET /api/transfers/:id
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 getTransfer - Transfer ID:', id);
    console.log('🔍 getTransfer - User:', req.user);
    
    const transfer = await Transfer.findById(id);
    
    console.log('🔍 getTransfer - Transfer found:', transfer);
    console.log('🔍 getTransfer - Transfer items:', transfer?.items);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Check access permissions
    if (req.user.role === 'CASHIER') {
      // Cashiers can see transfers TO their branch (incoming) OR FROM their branch (outgoing)
      if (transfer.to_branch_id !== req.user.branchId && transfer.from_branch_id !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only view transfers related to your branch'
        });
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can see transfers FROM their warehouse (outgoing) OR TO their warehouse (incoming)
      if (transfer.from_warehouse_id !== req.user.warehouseId && transfer.to_warehouse_id !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - You can only view transfers related to your warehouse'
        });
      }
    }

    res.json({
      success: true,
      data: transfer
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer',
      error: error.message
    });
  }
};

// @desc    Update transfer status
// @route   PUT /api/transfers/:id/status
// @access  Private (Admin, Cashier, Warehouse Keeper)
const updateTransferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Map frontend status values to database status values
    const statusMapping = {
      'PENDING': 'pending',
      'APPROVED': 'approved', 
      'IN_TRANSIT': 'shipped',
      'COMPLETED': 'delivered',
      'REJECTED': 'cancelled',
      'CANCELLED': 'cancelled'
    };
    
    const dbStatus = statusMapping[status];
    if (!dbStatus) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    console.log('🔍 Status update: Frontend status =', status, 'Database status =', dbStatus);

    // Get current transfer
    const transfer = await Transfer.findById(id);
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Check permissions based on status change
    if (status === 'APPROVED' || status === 'REJECTED') {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can approve or reject transfers'
        });
      }
    }

    // Update status using the mapped database status
    const updatedTransfer = await Transfer.updateStatus(id, dbStatus, req.user.id, notes);

    res.json({
      success: true,
      message: `Transfer ${status.toLowerCase()} successfully`,
      data: updatedTransfer
    });

  } catch (error) {
    console.error('[TransferController] Error updating transfer status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transfer status',
      error: error.message
    });
  }
};

// @desc    Get transfer settings for a location
// @route   GET /api/transfers/settings/:type/:id
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getLocationTransferSettings = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === 'warehouse') {
      const warehouse = await Warehouse.findById(id);
      if (!warehouse) {
        return res.status(404).json({
          success: false,
          message: 'Warehouse not found'
        });
      }

      res.json({
        success: true,
        data: {
          allowTransfers: warehouse.allowWarehouseTransfers,
          allowToBranch: warehouse.allowWarehouseToBranchTransfers,
          allowToWarehouse: warehouse.allowWarehouseToWarehouseTransfers,
          requireApproval: warehouse.requireApprovalForWarehouseTransfers,
          maxAmount: warehouse.maxTransferAmount,
          // notificationEmail: warehouse.transferNotificationEmail // Commented out - will be used in future when email system is implemented
          autoApproveSmall: warehouse.autoApproveSmallTransfers,
          smallThreshold: warehouse.smallTransferThreshold
        }
      });
    } else if (type === 'branch') {
      const branch = await Branch.findById(id);
      if (!branch) {
        return res.status(404).json({
          success: false,
          message: 'Branch not found'
        });
      }

      res.json({
        success: true,
        data: {
          allowTransfers: branch.allowBranchTransfers,
          allowToWarehouse: branch.allowBranchToWarehouseTransfers,
          allowToBranch: branch.allowBranchToBranchTransfers,
          requireApproval: branch.requireApprovalForBranchTransfers,
          maxAmount: branch.maxTransferAmount
          // notificationEmail: branch.transferNotificationEmail // Commented out - will be used in future when email system is implemented
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be "warehouse" or "branch"'
      });
    }

  } catch (error) {
    console.error('[TransferController] Error getting transfer settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer settings',
      error: error.message
    });
  }
};

// @desc    Get transfer statistics
// @route   GET /api/transfers/statistics
// @access  Private (Admin, Warehouse Keeper)
const getTransferStatistics = async (req, res) => {
  try {
    const {
      fromWarehouseId, startDate, endDate
    } = req.query;

    // Build filters based on user role
    const filters = {};

    // Apply role-based filtering using ACTUAL database schema
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see statistics for their warehouse
      filters.fromWarehouseId = req.user.warehouseId;
    } else if (fromWarehouseId) {
      // Admin can filter by specific warehouse
      filters.fromWarehouseId = fromWarehouseId;
    }

    // Apply date filters
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const statistics = await Transfer.getStatistics(filters);

    res.json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfer statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer statistics',
      error: error.message
    });
  }
};

// @desc    Get transfer settings
// @route   GET /api/transfers/settings
// @access  Private (Admin)
const getTransferSettings = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can access transfer settings'
      });
    }

    const [settings] = await pool.execute(`
      SELECT setting_key, setting_value, description 
      FROM transfer_settings 
      ORDER BY setting_key
    `);

    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = {
        value: setting.setting_value === 1,
        description: setting.description
      };
    });

    res.json({
      success: true,
      data: settingsObj
    });

  } catch (error) {
    console.error('[TransferController] Error getting transfer settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting transfer settings',
      error: error.message
    });
  }
};

// @desc    Update transfer settings
// @route   PUT /api/transfers/settings
// @access  Private (Admin)
const updateTransferSettings = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update transfer settings'
      });
    }

    const { allowBranchTransfers, allowWarehouseTransfers, requireApproval } = req.body;

    // Update settings
    const updates = [];
    if (allowBranchTransfers !== undefined) {
      updates.push(['allow_branch_transfers', allowBranchTransfers ? 1 : 0]);
    }
    if (allowWarehouseTransfers !== undefined) {
      updates.push(['allow_warehouse_transfers', allowWarehouseTransfers ? 1 : 0]);
    }
    if (requireApproval !== undefined) {
      updates.push(['require_approval', requireApproval ? 1 : 0]);
    }

    for (const [key, value] of updates) {
      await pool.execute(
        'UPDATE transfer_settings SET setting_value = ? WHERE setting_key = ?',
        [value, key]
      );
    }

    res.json({
      success: true,
      message: 'Transfer settings updated successfully'
    });

  } catch (error) {
    console.error('[TransferController] Error updating transfer settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transfer settings',
      error: error.message
    });
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  getTransfer,
  updateTransferStatus,
  getLocationTransferSettings,
  getTransferSettings,
  updateTransferSettings,
  completeTransfer,
  getTransferLogs,
  getTransferMovements,
  getTransferStatistics
};