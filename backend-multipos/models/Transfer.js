const { pool } = require('../config/database');

class TransferItem {
  constructor(data) {
    this.id = data.id;
    this.transferId = data.transfer_id;
    this.inventoryItemId = data.inventory_item_id;
    this.quantity = data.quantity;
    this.unitCost = data.unit_cost;
    this.totalCost = data.total_cost;
  }
}

class Transfer {
  constructor(data) {
    this.id = data.id;
    this.transferNo = data.transfer_number;
    this.fromWarehouseId = data.from_warehouse_id;
    this.toWarehouseId = data.to_warehouse_id;
    this.toBranchId = data.to_branch_id;
    this.totalItems = data.total_items;
    this.status = data.status;
    this.createdBy = data.created_by;
    this.approvedBy = data.approved_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.items = data.items || [];
  }

  // Static method to create a new transfer
  static async create(transferData) {
    const { 
      transferNo, fromWarehouseId, toWarehouseId, toBranchId, 
      items, totalItems, createdBy, status = 'pending' 
    } = transferData;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Insert transfer
      const [transferResult] = await connection.execute(
        `INSERT INTO transfers (transfer_number, from_warehouse_id, to_warehouse_id, to_branch_id, 
         total_items, status, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [transferNo, fromWarehouseId, toWarehouseId, toBranchId, 
         totalItems, status, createdBy]
      );
      
      const transferId = transferResult.insertId;
      
      // Insert transfer items
      if (items && items.length > 0) {
        for (const item of items) {
          await connection.execute(
            `INSERT INTO transfer_items (transfer_id, inventory_item_id, quantity) 
             VALUES (?, ?, ?)`,
            [transferId, item.inventoryItemId, item.quantity]
          );
        }
      }
      
      await connection.commit();
      
      return await Transfer.findById(transferId);
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Static method to find transfer by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM transfers WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    
    const transfer = new Transfer(rows[0]);
    
    // Get transfer items
    const [itemRows] = await pool.execute(
      'SELECT * FROM transfer_items WHERE transfer_id = ?',
      [id]
    );
    
    transfer.items = itemRows.map(item => new TransferItem(item));
    
    return transfer;
  }

  // Static method to find transfer
  static async findOne(conditions) {
    let query = 'SELECT * FROM transfers WHERE ';
    const params = [];
    const conditionsArray = [];

    if (conditions.transferNo) {
      conditionsArray.push('transfer_no = ?');
      params.push(conditions.transferNo);
    }

    if (conditions._id) {
      conditionsArray.push('id = ?');
      params.push(conditions._id);
    }

    if (conditions.id) {
      conditionsArray.push('id = ?');
      params.push(conditions.id);
    }

    if (conditionsArray.length === 0) return null;

    query += conditionsArray.join(' AND ');
    query += ' LIMIT 1';

    const [rows] = await pool.execute(query, params);
    
    if (rows.length === 0) return null;
    
    const transfer = new Transfer(rows[0]);
    
    // Get transfer items
    const [itemRows] = await pool.execute(
      'SELECT * FROM transfer_items WHERE transfer_id = ?',
      [transfer.id]
    );
    
    transfer.items = itemRows.map(item => new TransferItem(item));
    
    return transfer;
  }

  // Instance method to save transfer
  async save() {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      if (this.id) {
        // Update existing transfer
        await connection.execute(
          `UPDATE transfers SET transfer_no = ?, from_scope_type = ?, from_scope_id = ?, 
           to_scope_type = ?, to_scope_id = ?, total_amount = ?, status = ?, reason = ?, 
           notes = ?, requested_by = ?, approved_by = ?, approved_at = ?, rejected_by = ?, 
           rejected_at = ?, rejection_reason = ?, completed_at = ?, completed_by = ? 
           WHERE id = ?`,
          [this.transferNo, this.fromScopeType, this.fromScopeId, this.toScopeType, this.toScopeId,
           this.totalAmount, this.status, this.reason, this.notes, this.requestedBy, 
           this.approvedBy, this.approvedAt, this.rejectedBy, this.rejectedAt, 
           this.rejectionReason, this.completedAt, this.completedBy, this.id]
        );
        
        // Update transfer items if provided
        if (this.items && this.items.length > 0) {
          // Delete existing items
          await connection.execute('DELETE FROM transfer_items WHERE transfer_id = ?', [this.id]);
          
          // Insert new items
          for (const item of this.items) {
            await connection.execute(
              `INSERT INTO transfer_items (transfer_id, inventory_item_id, quantity, unit_cost, total_cost) 
               VALUES (?, ?, ?, ?, ?)`,
              [this.id, item.inventoryItemId, item.quantity, item.unitCost, item.totalCost]
            );
          }
        }
      } else {
        // Create new transfer
        const result = await connection.execute(
          `INSERT INTO transfers (transfer_no, from_scope_type, from_scope_id, to_scope_type, to_scope_id, 
           total_amount, status, reason, notes, requested_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.transferNo, this.fromScopeType, this.fromScopeId, this.toScopeType, this.toScopeId,
           this.totalAmount, this.status, this.reason, this.notes, this.requestedBy]
        );
        
        this.id = result[0].insertId;
        
        // Insert transfer items
        if (this.items && this.items.length > 0) {
          for (const item of this.items) {
            await connection.execute(
              `INSERT INTO transfer_items (transfer_id, inventory_item_id, quantity, unit_cost, total_cost) 
               VALUES (?, ?, ?, ?, ?)`,
              [this.id, item.inventoryItemId, item.quantity, item.unitCost, item.totalCost]
            );
          }
        }
      }
      
      await connection.commit();
      return this;
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Method to approve transfer
  async approve(approvedBy) {
    if (this.status !== 'PENDING') {
      throw new Error('Only pending transfers can be approved');
    }
    
    this.status = 'APPROVED';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    
    return await this.save();
  }

  // Method to reject transfer
  async reject(rejectedBy, rejectionReason) {
    if (this.status !== 'PENDING') {
      throw new Error('Only pending transfers can be rejected');
    }
    
    this.status = 'REJECTED';
    this.rejectedBy = rejectedBy;
    this.rejectedAt = new Date();
    this.rejectionReason = rejectionReason;
    
    return await this.save();
  }

  // Method to complete transfer
  async complete(completedBy) {
    if (this.status !== 'APPROVED') {
      throw new Error('Only approved transfers can be completed');
    }
    
    this.status = 'COMPLETED';
    this.completedBy = completedBy;
    this.completedAt = new Date();
    
    return await this.save();
  }

  // Method to cancel transfer
  async cancel() {
    if (this.status === 'COMPLETED') {
      throw new Error('Completed transfers cannot be cancelled');
    }
    
    this.status = 'CANCELLED';
    return await this.save();
  }

  // Static method to generate transfer number
  static async generateTransferNumber(fromWarehouseId) {
    const prefix = `TRF-WH-${fromWarehouseId}`;
    const year = new Date().getFullYear();
    
    const [rows] = await pool.execute(
      'SELECT transfer_number FROM transfers WHERE transfer_number LIKE ? ORDER BY transfer_number DESC LIMIT 1',
      [`${prefix}-${year}%`]
    );
    
    let sequence = 1;
    if (rows.length > 0) {
      const lastTransferNo = rows[0].transfer_number;
      const lastSequence = parseInt(lastTransferNo.split('-').pop());
      sequence = lastSequence + 1;
    }
    
    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  // Static method to get transfers by scope
  static async getTransfersByScope(scopeType, scopeId, status = null) {
    let query = `SELECT t.*, 
                 u1.username as created_by_name, u1.email as created_by_email,
                 u2.username as approved_by_name, u2.email as approved_by_email
                 FROM transfers t
                 LEFT JOIN users u1 ON t.created_by = u1.id
                 LEFT JOIN users u2 ON t.approved_by = u2.id
                 WHERE (t.from_warehouse_id = ? OR t.to_warehouse_id = ? OR t.to_branch_id = ?)`;
    
    const params = [scopeId, scopeId, scopeId];
    
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    return rows.map(row => new Transfer(row));
  }

  // Static method to find transfers with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM transfers WHERE 1=1';
    const params = [];

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.createdBy) {
      query += ' AND created_by = ?';
      params.push(conditions.createdBy);
    }

    if (conditions.fromWarehouseId) {
      query += ' AND from_warehouse_id = ?';
      params.push(conditions.fromWarehouseId);
    }

    if (conditions.toWarehouseId) {
      query += ' AND to_warehouse_id = ?';
      params.push(conditions.toWarehouseId);
    }

    if (conditions.toBranchId) {
      query += ' AND to_branch_id = ?';
      params.push(conditions.toBranchId);
    }

    // Add sorting
    if (options.sort) {
      const sortField = options.sort.replace(/^-/, '');
      const sortOrder = options.sort.startsWith('-') ? 'DESC' : 'ASC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;
    } else {
      query += ' ORDER BY created_at DESC';
    }

    // Add pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.skip) {
        query += ' OFFSET ?';
        params.push(options.skip);
      }
    }

    const [rows] = await pool.execute(query, params);
    const transfers = [];

    for (const row of rows) {
      const transfer = new Transfer(row);
      
      // Get transfer items
      const [itemRows] = await pool.execute(
        'SELECT * FROM transfer_items WHERE transfer_id = ?',
        [transfer.id]
      );
      
      transfer.items = itemRows.map(item => new TransferItem(item));
      transfers.push(transfer);
    }

    return transfers;
  }

  // Static method to count transfers
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM transfers WHERE 1=1';
    const params = [];

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.createdBy) {
      query += ' AND created_by = ?';
      params.push(conditions.createdBy);
    }

    if (conditions.fromWarehouseId) {
      query += ' AND from_warehouse_id = ?';
      params.push(conditions.fromWarehouseId);
    }

    if (conditions.toWarehouseId) {
      query += ' AND to_warehouse_id = ?';
      params.push(conditions.toWarehouseId);
    }

    if (conditions.toBranchId) {
      query += ' AND to_branch_id = ?';
      params.push(conditions.toBranchId);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].count;
  }

  // Static method to update transfer
  static async updateOne(conditions, updateData) {
    let query = 'UPDATE transfers SET ';
    const params = [];
    const setClauses = [];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'items') {
        setClauses.push(`${key} = ?`);
        params.push(updateData[key]);
      }
    });

    if (setClauses.length === 0) return { modifiedCount: 0 };

    query += setClauses.join(', ');
    query += ' WHERE ';

    const whereClauses = [];
    if (conditions._id) {
      whereClauses.push('id = ?');
      params.push(conditions._id);
    }
    if (conditions.id) {
      whereClauses.push('id = ?');
      params.push(conditions.id);
    }
    if (conditions.transferNo) {
      whereClauses.push('transfer_number = ?');
      params.push(conditions.transferNo);
    }

    if (whereClauses.length === 0) return { modifiedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { modifiedCount: result.affectedRows };
  }

  // Static method to delete transfer
  static async deleteOne(conditions) {
    let query = 'DELETE FROM transfers WHERE ';
    const params = [];
    const whereClauses = [];

    if (conditions._id) {
      whereClauses.push('id = ?');
      params.push(conditions._id);
    }
    if (conditions.id) {
      whereClauses.push('id = ?');
      params.push(conditions.id);
    }
    if (conditions.transferNo) {
      whereClauses.push('transfer_number = ?');
      params.push(conditions.transferNo);
    }

    if (whereClauses.length === 0) return { deletedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { deletedCount: result.affectedRows };
  }
}

module.exports = Transfer;
