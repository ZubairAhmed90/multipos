const { pool } = require('../config/database');

class Branch {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.location = data.location;
    this.phone = data.phone;
    this.email = data.email;
    this.managerName = data.manager_name;
    this.managerPhone = data.manager_phone;
    this.managerEmail = data.manager_email;
    this.linkedWarehouseId = data.linked_warehouse_id;
    this.status = data.status || 'active';
    this.createdBy = data.created_by;
    this.updatedBy = data.updated_by;
    this.settings = data.settings ? JSON.parse(data.settings) : {};
    
    // Transfer settings - check both database columns and settings JSON
    const settings = data.settings ? (typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings) : {};
    
    this.allowBranchTransfers = data.allow_branch_transfers || settings.allowBranchTransfers || false;
    this.allowBranchToWarehouseTransfers = data.allow_branch_to_warehouse_transfers || settings.allowBranchToWarehouseTransfers || false;
    this.allowBranchToBranchTransfers = data.allow_branch_to_branch_transfers || settings.allowBranchToBranchTransfers || false;
    this.requireApprovalForBranchTransfers = data.require_approval_for_branch_transfers !== false || settings.requireApprovalForBranchTransfers !== false;
    this.maxTransferAmount = data.max_transfer_amount || settings.maxTransferAmount || 10000.00;
    // this.transferNotificationEmail = data.transfer_notification_email; // Commented out - will be used in future when email system is implemented
    
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static method to create a new branch
  static async create(branchData) {
    const { 
      name, 
      code, 
      location, 
      phone = null,
      email = null,
      managerName = null,
      managerPhone = null,
      managerEmail = null,
      linkedWarehouseId = null,
      status = 'active',
      createdBy = null,
      settings = {} 
    } = branchData;
    
    const [result] = await pool.execute(
      `INSERT INTO branches (
        name, code, location, phone, email, manager_name, manager_phone, 
        manager_email, linked_warehouse_id, status, created_by, settings,
        allow_cashier_inventory_edit, allow_cashier_returns, allow_cashier_customers,
        allow_cashier_pos, allow_cashier_ledger, open_account_system
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, code, location, phone, email, managerName, managerPhone, 
        managerEmail, linkedWarehouseId, status, createdBy, JSON.stringify(settings),
        0, 0, 0, 0, 0, 0  // Default values for the extra columns
      ]
    );
    
    return await Branch.findById(result.insertId);
  }

  // Static method to find branch by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM branches WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    return new Branch(rows[0]);
  }

  // Static method to find branch by code
  static async findOne(conditions) {
    let query = 'SELECT * FROM branches WHERE ';
    const params = [];
    const conditionsArray = [];

    if (conditions.code) {
      conditionsArray.push('code = ?');
      params.push(conditions.code);
    }

    if (conditions.name) {
      conditionsArray.push('name = ?');
      params.push(conditions.name);
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
    return new Branch(rows[0]);
  }

  // Instance method to save branch
  async save() {
    if (this.id) {
      // Update existing branch
      await pool.execute(
        `UPDATE branches SET name = ?, code = ?, location = ?, phone = ?, email = ?, manager_name = ?, manager_phone = ?, manager_email = ?, linked_warehouse_id = ?, status = ?, updated_by = ?, settings = ? 
         WHERE id = ?`,
        [this.name, this.code, this.location, this.phone, this.email, this.managerName, this.managerPhone, this.managerEmail, this.linkedWarehouseId, this.status, this.updatedBy, JSON.stringify(this.settings), this.id]
      );
    } else {
      // Create new branch
      const result = await pool.execute(
        `INSERT INTO branches (name, code, location, phone, email, manager_name, manager_phone, manager_email, linked_warehouse_id, status, created_by, settings) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.name, this.code, this.location, this.phone, this.email, this.managerName, this.managerPhone, this.managerEmail, this.linkedWarehouseId, this.status, this.createdBy, JSON.stringify(this.settings)]
      );
      this.id = result[0].insertId;
    }
    return this;
  }

  // Static method to find branches with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM branches WHERE 1=1';
    const params = [];

    if (conditions.name) {
      query += ' AND name LIKE ?';
      params.push(`%${conditions.name}%`);
    }

    if (conditions.code) {
      query += ' AND code LIKE ?';
      params.push(`%${conditions.code}%`);
    }

    if (conditions.location) {
      query += ' AND location LIKE ?';
      params.push(`%${conditions.location}%`);
    }

    // Add sorting
    if (options.sort) {
      const sortField = options.sort.replace(/^-/, ''); // Remove minus sign
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
    return rows.map(row => new Branch(row));
  }

  // Static method to count branches
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM branches WHERE 1=1';
    const params = [];

    if (conditions.name) {
      query += ' AND name LIKE ?';
      params.push(`%${conditions.name}%`);
    }

    if (conditions.code) {
      query += ' AND code LIKE ?';
      params.push(`%${conditions.code}%`);
    }

    if (conditions.location) {
      query += ' AND location LIKE ?';
      params.push(`%${conditions.location}%`);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].count;
  }

  // Static method to update branch
  static async updateOne(conditions, updateData) {
    let query = 'UPDATE branches SET ';
    const params = [];
    const setClauses = [];

    // Field mapping from camelCase to snake_case
    const fieldMapping = {
      'managerName': 'manager_name',
      'managerPhone': 'manager_phone', 
      'managerEmail': 'manager_email',
      'linkedWarehouseId': 'linked_warehouse_id',
      'createdBy': 'created_by',
      'updatedBy': 'updated_by',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at'
    };

    // Filter out fields that shouldn't be updated
    const allowedFields = [
      'name', 'code', 'location', 'phone', 'email', 'managerName', 
      'managerPhone', 'managerEmail', 'linkedWarehouseId', 'status', 
      'settings', 'createdBy', 'updatedBy'
    ];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && allowedFields.includes(key)) {
        // Map camelCase field names to snake_case database columns
        const dbColumn = fieldMapping[key] || key;
        
        if (key === 'settings') {
          setClauses.push(`${dbColumn} = ?`);
          params.push(JSON.stringify(updateData[key]));
        } else {
          setClauses.push(`${dbColumn} = ?`);
          params.push(updateData[key]);
        }
      } else if (key !== 'id' && !allowedFields.includes(key)) {
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
    if (conditions.code) {
      whereClauses.push('code = ?');
      params.push(conditions.code);
    }

    if (whereClauses.length === 0) return { modifiedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { modifiedCount: result.affectedRows };
  }

  // Static method to delete branch
  static async deleteOne(conditions) {
    let query = 'DELETE FROM branches WHERE ';
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
    if (conditions.code) {
      whereClauses.push('code = ?');
      params.push(conditions.code);
    }

    if (whereClauses.length === 0) return { deletedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { deletedCount: result.affectedRows };
  }

  // Static method to find branch by code
  static async findByCode(code) {
    const [rows] = await pool.execute(
      'SELECT * FROM branches WHERE code = ?',
      [code]
    );
    
    if (rows.length === 0) return null;
    return new Branch(rows[0]);
  }

  // Static method to find branches with open account setting
  static async findByOpenAccount(excludeId) {
    const [rows] = await pool.execute(
      'SELECT * FROM branches WHERE JSON_EXTRACT(settings, "$.openAccount") = true AND id != ?',
      [excludeId]
    );
    
    return rows.map(row => new Branch(row));
  }

  // Static method to get branch settings
  static async getSettings(branchId) {
    const [rows] = await pool.execute(
      'SELECT settings FROM branches WHERE id = ?',
      [branchId]
    );
    
    if (rows.length === 0) return null;
    
    const settings = rows[0].settings;
    if (!settings) return {};
    
    try {
      return typeof settings === 'string' ? JSON.parse(settings) : settings;
    } catch (error) {
      return {};
    }
  }
}

module.exports = Branch;
