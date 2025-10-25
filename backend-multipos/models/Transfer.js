const { pool } = require('../config/database');

class Transfer {
  constructor(data) {
    this.id = data.id;
    this.transferNumber = data.transfer_number;
    this.transferType = data.transfer_type;
    this.fromWarehouseId = data.from_warehouse_id;
    this.toWarehouseId = data.to_warehouse_id;
    this.fromBranchId = data.from_branch_id;
    this.toBranchId = data.to_branch_id;
    this.status = data.status;
    this.totalItems = data.total_items;
    this.createdBy = data.created_by;
    this.approvedBy = data.approved_by;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Generate unique transfer number
  static async generateTransferNumber() {
    try {
      const [result] = await pool.execute(
        'SELECT COUNT(*) as count FROM transfers WHERE DATE(created_at) = CURDATE()'
      );
      const count = result[0].count + 1;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return `TRF-${date}-${count.toString().padStart(3, '0')}`;
    } catch (error) {
      console.error('Error generating transfer number:', error);
      throw error;
    }
  }

  // Create new transfer
  static async create(transferData, connection = null) {
    try {
      const {
        transferType, fromWarehouseId, toWarehouseId, fromBranchId, toBranchId, createdBy, items, notes
      } = transferData;

      // Generate transfer number
      const transferNumber = await this.generateTransferNumber();

      // Use provided connection or create new transaction
      const dbConnection = connection || pool;
      const shouldManageTransaction = !connection;
      
      if (shouldManageTransaction) {
        await dbConnection.execute('START TRANSACTION');
      }

      try {
        // Calculate total items
        const totalItems = items ? items.length : 0;

        // Validate and set transfer type
        let dbTransferType = transferType;
        
        // Handle empty or invalid transfer types
        if (!transferType || transferType === '' || transferType === 'null' || transferType === 'undefined') {
          // Determine transfer type based on from/to locations
          if (fromBranchId && toBranchId) {
            dbTransferType = 'BRANCH';
          } else if (fromWarehouseId && toWarehouseId) {
            dbTransferType = 'WAREHOUSE';
          } else if (fromBranchId && toWarehouseId) {
            dbTransferType = 'BRANCH';
          } else if (fromWarehouseId && toBranchId) {
            dbTransferType = 'WAREHOUSE';
          } else {
            dbTransferType = 'BRANCH'; // Default fallback
          }
        }

        console.log('🔍 Mapping transferType:', transferType, 'to dbTransferType:', dbTransferType);

        // Insert transfer using ACTUAL database schema
        const [result] = await dbConnection.execute(`
          INSERT INTO transfers (
            transfer_number, transfer_type, from_warehouse_id, to_warehouse_id, 
            from_branch_id, to_branch_id, created_by, status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `, [
          transferNumber, dbTransferType, fromWarehouseId, toWarehouseId, 
          fromBranchId, toBranchId, createdBy, notes
        ]);

        console.log('🔍 Transfer INSERT result:', result);
        console.log('🔍 Transfer insertId:', result.insertId);
        
        const transferId = result.insertId;
        
        if (!transferId) {
          throw new Error('Failed to create transfer - no insertId returned');
        }

        // Insert transfer items using ACTUAL database schema
        if (items && items.length > 0) {
          for (const item of items) {
            await dbConnection.execute(`
              INSERT INTO transfer_items (
                transfer_id, inventory_item_id, quantity
              ) VALUES (?, ?, ?)
            `, [
              transferId, item.inventoryItemId, parseInt(item.quantityRequested || item.quantity)
            ]);
          }
        }

        if (shouldManageTransaction) {
          await dbConnection.execute('COMMIT');
        }

        // Return the created transfer
        return await this.findById(transferId);
      } catch (error) {
        if (shouldManageTransaction) {
          await dbConnection.execute('ROLLBACK');
        }
        throw error;
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      throw error;
    }
  }

  // Find transfer by ID with full details
  static async findById(id) {
    try {
      const [transfers] = await pool.execute(`
        SELECT 
          t.*,
          u1.username as created_by_name,
          u2.username as approved_by_name,
          w1.name as from_warehouse_name,
          w2.name as to_warehouse_name,
          b1.name as from_branch_name,
          b2.name as to_branch_name
        FROM transfers t
        LEFT JOIN users u1 ON t.created_by = u1.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        LEFT JOIN warehouses w1 ON t.from_warehouse_id = w1.id
        LEFT JOIN warehouses w2 ON t.to_warehouse_id = w2.id
        LEFT JOIN branches b1 ON t.from_branch_id = b1.id
        LEFT JOIN branches b2 ON t.to_branch_id = b2.id
        WHERE t.id = ?
      `, [id]);

      if (transfers.length === 0) {
        return null;
      }

      const transfer = transfers[0];

      // Get transfer items
      const [items] = await pool.execute(`
        SELECT 
          ti.*,
          ii.name as item_name,
          ii.sku,
          ii.category,
          ii.current_stock
        FROM transfer_items ti
        LEFT JOIN inventory_items ii ON ti.inventory_item_id = ii.id
        WHERE ti.transfer_id = ?
        ORDER BY ti.id
      `, [id]);

      console.log('🔍 Transfer.findById - Transfer ID:', id);
      console.log('🔍 Transfer.findById - Transfer:', transfer);
      console.log('🔍 Transfer.findById - Items count:', items.length);
      console.log('🔍 Transfer.findById - Items:', items);
      
      return {
        ...transfer,
        items: items
      };
    } catch (error) {
      console.error('Error finding transfer by ID:', error);
      throw error;
    }
  }

  // Get transfers with filtering and pagination
  static async find(filters = {}, options = {}) {
    try {
      const {
        fromWarehouseId, toWarehouseId, toBranchId,
        status, createdBy, approvedBy,
        startDate, endDate, search,
        cashierBranchId, warehouseKeeperWarehouseId
      } = filters;

      const { page = 1, limit = 50, sortBy = 'created_at', sortOrder = 'DESC' } = options;

      let whereConditions = [];
      let params = [];

      // Build WHERE conditions using ACTUAL database schema
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
      if (status) {
        whereConditions.push('t.status = ?');
        params.push(status);
      }
      if (createdBy) {
        whereConditions.push('t.created_by = ?');
        params.push(createdBy);
      }
      if (approvedBy) {
        whereConditions.push('t.approved_by = ?');
        params.push(approvedBy);
      }
      if (startDate) {
        whereConditions.push('DATE(t.created_at) >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereConditions.push('DATE(t.created_at) <= ?');
        params.push(endDate);
      }
      if (search) {
        whereConditions.push('(t.transfer_number LIKE ? OR t.notes LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      // Role-based filtering
      if (cashierBranchId) {
        // Cashiers can see transfers FROM their branch (outgoing) OR TO their branch (incoming)
        whereConditions.push('(t.from_branch_id = ? OR t.to_branch_id = ?)');
        params.push(cashierBranchId, cashierBranchId);
      }
      if (warehouseKeeperWarehouseId) {
        // Warehouse keepers can see transfers FROM their warehouse (outgoing) OR TO their warehouse (incoming)
        whereConditions.push('(t.from_warehouse_id = ? OR t.to_warehouse_id = ?)');
        params.push(warehouseKeeperWarehouseId, warehouseKeeperWarehouseId);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;
      
      console.log('🔍 Transfer.find query:', {
        whereClause,
        params,
        limit,
        offset
      });

      // Debug: Let's also run a simple query to see what transfers exist
      console.log('🔍 Running simple query to check existing transfers...');
      const [simpleResult] = await pool.execute('SELECT id, transfer_number, transfer_type, from_branch_id, to_branch_id, status FROM transfers LIMIT 5');
      console.log('🔍 Simple query result:', simpleResult);

      // Get transfers using ACTUAL database schema
      const [transfers] = await pool.execute(`
        SELECT 
          t.*,
          u1.username as created_by_name,
          u2.username as approved_by_name,
          w1.name as from_warehouse_name,
          w2.name as to_warehouse_name,
          b1.name as from_branch_name,
          b2.name as to_branch_name
        FROM transfers t
        LEFT JOIN users u1 ON t.created_by = u1.id
        LEFT JOIN users u2 ON t.approved_by = u2.id
        LEFT JOIN warehouses w1 ON t.from_warehouse_id = w1.id
        LEFT JOIN warehouses w2 ON t.to_warehouse_id = w2.id
        LEFT JOIN branches b1 ON t.from_branch_id = b1.id
        LEFT JOIN branches b2 ON t.to_branch_id = b2.id
        ${whereClause}
        ORDER BY t.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);
      
      console.log('🔍 Transfer.find results:', {
        transfersCount: transfers.length,
        transfers: transfers.map(t => ({
          id: t.id,
          transfer_number: t.transfer_number,
          transfer_type: t.transfer_type,
          from_branch_id: t.from_branch_id,
          to_branch_id: t.to_branch_id,
          status: t.status
        }))
      });

      // Get total count
      const [countResult] = await pool.execute(`
        SELECT COUNT(*) as total
        FROM transfers t
        ${whereClause}
      `, params);

      return {
        transfers: transfers,
        total: countResult[0].total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(countResult[0].total / limit)
      };
    } catch (error) {
      console.error('Error finding transfers:', error);
      throw error;
    }
  }

  // Update transfer status
  static async updateStatus(id, status, userId, notes = null) {
    try {
      await pool.execute('START TRANSACTION');

      try {
        // Get current status
        const [current] = await pool.execute('SELECT status FROM transfers WHERE id = ?', [id]);
        if (current.length === 0) {
          throw new Error('Transfer not found');
        }

        const oldStatus = current[0].status;

        // Update transfer
        const updateFields = ['status = ?'];
        const updateParams = [status];

        if (status === 'approved' || status === 'APPROVED') {
          updateFields.push('approved_by = ?');
          updateParams.push(userId);
          
          // Handle inventory updates when transfer is approved
          await this.updateInventoryOnApproval(id);
        }

        if (status === 'rejected' || status === 'REJECTED') {
          updateFields.push('approved_by = ?');
          updateParams.push(userId);
        }

        if (status === 'delivered' || status === 'COMPLETED') {
          updateFields.push('actual_date = CURDATE()');
        }

        updateParams.push(id);

        await pool.execute(`
          UPDATE transfers 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, updateParams);

        // Log the status change
        await pool.execute(`
          INSERT INTO transfer_logs (transfer_id, action, performed_by, old_status, new_status, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, status.toLowerCase(), userId, oldStatus, status, notes]);

        await pool.execute('COMMIT');

        return await this.findById(id);
      } catch (error) {
        await pool.execute('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error updating transfer status:', error);
      throw error;
    }
  }

  // Check if user has permission to create transfer
  static async checkPermission(userId, fromScopeType, fromScopeId, toScopeType, toScopeId) {
    try {
      // Admin can do anything
      const [user] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
      if (user.length === 0) return false;
      
      if (user[0].role === 'ADMIN') return true;

      // Check specific permissions
      let permissionType;
      if (fromScopeType === 'BRANCH' && toScopeType === 'BRANCH') {
        permissionType = 'BRANCH_TRANSFER';
      } else if (fromScopeType === 'WAREHOUSE' && toScopeType === 'WAREHOUSE') {
        permissionType = 'WAREHOUSE_TRANSFER';
      } else {
        permissionType = 'CROSS_TRANSFER';
      }

      const [permissions] = await pool.execute(`
        SELECT * FROM transfer_permissions 
        WHERE user_id = ? AND permission_type = ? AND scope_type = ? AND scope_id = ? AND is_enabled = TRUE
      `, [userId, permissionType, fromScopeType, fromScopeId]);

      return permissions.length > 0;
    } catch (error) {
      console.error('Error checking transfer permission:', error);
      return false;
    }
  }

  // Get transfer statistics
  static async getStatistics(filters = {}) {
    try {
      const { fromWarehouseId, startDate, endDate } = filters;

      let whereConditions = [];
      let params = [];

      if (fromWarehouseId) {
        whereConditions.push('from_warehouse_id = ?');
        params.push(fromWarehouseId);
      }
      if (startDate) {
        whereConditions.push('DATE(created_at) >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereConditions.push('DATE(created_at) <= ?');
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_transfers,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_transfers,
          SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved_transfers,
          SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_transfers,
          SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_transfers,
          SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_transfers
        FROM transfers
        ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      console.error('Error getting transfer statistics:', error);
      throw error;
    }
  }

  // Update inventory when transfer is approved
  static async updateInventoryOnApproval(transferId) {
    try {
      console.log('🔍 Updating inventory for approved transfer:', transferId);
      
      // Get transfer details
      const [transfers] = await pool.execute(`
        SELECT t.*, ti.*, ii.name as item_name, ii.sku
        FROM transfers t
        JOIN transfer_items ti ON t.id = ti.transfer_id
        JOIN inventory_items ii ON ti.inventory_item_id = ii.id
        WHERE t.id = ?
      `, [transferId]);
      
      if (transfers.length === 0) {
        console.log('❌ No transfer items found for transfer:', transferId);
        return;
      }
      
      console.log('🔍 Transfer items to process:', transfers.length);
      
      for (const item of transfers) {
        console.log('🔍 Processing item:', item.item_name, 'Quantity:', item.quantity);
        
        // Update source inventory (reduce stock)
        if (item.from_branch_id) {
          // Branch to branch transfer - reduce from source branch
          const [sourceInventory] = await pool.execute(`
            SELECT id, current_stock FROM inventory_items 
            WHERE sku = ? AND scope_type = 'BRANCH' AND scope_id = ?
          `, [item.sku, item.from_branch_id]);
          
          if (sourceInventory.length > 0) {
            const newStock = sourceInventory[0].current_stock - item.quantity;
            await pool.execute(`
              UPDATE inventory_items 
              SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [newStock, sourceInventory[0].id]);
            
            console.log('✅ Updated source branch inventory:', {
              sku: item.sku,
              branch_id: item.from_branch_id,
              old_stock: sourceInventory[0].current_stock,
              new_stock: newStock
            });
          }
        }
        
        if (item.from_warehouse_id) {
          // Warehouse to warehouse transfer - reduce from source warehouse
          const [sourceInventory] = await pool.execute(`
            SELECT id, current_stock FROM inventory_items 
            WHERE sku = ? AND scope_type = 'WAREHOUSE' AND scope_id = ?
          `, [item.sku, item.from_warehouse_id]);
          
          if (sourceInventory.length > 0) {
            const newStock = sourceInventory[0].current_stock - item.quantity;
            await pool.execute(`
              UPDATE inventory_items 
              SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [newStock, sourceInventory[0].id]);
            
            console.log('✅ Updated source warehouse inventory:', {
              sku: item.sku,
              warehouse_id: item.from_warehouse_id,
              old_stock: sourceInventory[0].current_stock,
              new_stock: newStock
            });
          }
        }
        
        // Update destination inventory (increase stock)
        if (item.to_branch_id) {
          // Transfer to branch - increase destination branch stock
          const [destInventory] = await pool.execute(`
            SELECT id, current_stock FROM inventory_items 
            WHERE sku = ? AND scope_type = 'BRANCH' AND scope_id = ?
          `, [item.sku, item.to_branch_id]);
          
          if (destInventory.length > 0) {
            const newStock = destInventory[0].current_stock + item.quantity;
            await pool.execute(`
              UPDATE inventory_items 
              SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [newStock, destInventory[0].id]);
            
            console.log('✅ Updated destination branch inventory:', {
              sku: item.sku,
              branch_id: item.to_branch_id,
              old_stock: destInventory[0].current_stock,
              new_stock: newStock
            });
          } else {
            // Create new inventory item for destination if it doesn't exist
            await pool.execute(`
              INSERT INTO inventory_items (
                name, sku, description, category, unit, cost_price, selling_price, min_stock_level, current_stock,
                scope_type, scope_id, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BRANCH', ?, ?)
            `, [
              item.item_name, item.sku, 'Transferred item', 'Food', 'PIECE', 0.00, 0.00, 0, item.quantity, item.to_branch_id, 4
            ]);
            
            console.log('✅ Created new inventory item for destination branch:', {
              sku: item.sku,
              branch_id: item.to_branch_id,
              stock: item.quantity
            });
          }
        }
        
        if (item.to_warehouse_id) {
          // Transfer to warehouse - increase destination warehouse stock
          const [destInventory] = await pool.execute(`
            SELECT id, current_stock FROM inventory_items 
            WHERE sku = ? AND scope_type = 'WAREHOUSE' AND scope_id = ?
          `, [item.sku, item.to_warehouse_id]);
          
          if (destInventory.length > 0) {
            const newStock = destInventory[0].current_stock + item.quantity;
            await pool.execute(`
              UPDATE inventory_items 
              SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [newStock, destInventory[0].id]);
            
            console.log('✅ Updated destination warehouse inventory:', {
              sku: item.sku,
              warehouse_id: item.to_warehouse_id,
              old_stock: destInventory[0].current_stock,
              new_stock: newStock
            });
          } else {
            // Create new inventory item for destination if it doesn't exist
            await pool.execute(`
              INSERT INTO inventory_items (
                name, sku, description, category, unit, cost_price, selling_price, min_stock_level, current_stock,
                scope_type, scope_id, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAREHOUSE', ?, ?)
            `, [
              item.item_name, item.sku, 'Transferred item', 'Food', 'PIECE', 0.00, 0.00, 0, item.quantity, item.to_warehouse_id, 4
            ]);
            
            console.log('✅ Created new inventory item for destination warehouse:', {
              sku: item.sku,
              warehouse_id: item.to_warehouse_id,
              stock: item.quantity
            });
          }
        }
      }
      
      console.log('✅ Inventory update completed for transfer:', transferId);
      
    } catch (error) {
      console.error('❌ Error updating inventory for transfer:', transferId, error);
      throw error;
    }
  }
}

module.exports = Transfer;