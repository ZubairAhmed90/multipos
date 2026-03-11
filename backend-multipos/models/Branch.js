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

    // Handle settings - either parse JSON or use empty object
    this.settings = {};
    if (data.settings) {
      try {
        this.settings = typeof data.settings === 'string'
          ? JSON.parse(data.settings)
          : data.settings;
      } catch (error) {
        this.settings = {};
      }
    }

    // ==================== CASHIER PERMISSIONS ====================
    this.allow_cashier_inventory_add  = data.allow_cashier_inventory_add  !== undefined ? data.allow_cashier_inventory_add  : 0;
    this.allow_cashier_inventory_edit = data.allow_cashier_inventory_edit !== undefined ? data.allow_cashier_inventory_edit : 0;
    this.allow_cashier_returns        = data.allow_cashier_returns        !== undefined ? data.allow_cashier_returns        : 0;
    this.allow_cashier_customers      = data.allow_cashier_customers      !== undefined ? data.allow_cashier_customers      : 0;
    this.allow_cashier_pos            = data.allow_cashier_pos            !== undefined ? data.allow_cashier_pos            : 0;
    this.allow_cashier_ledger         = data.allow_cashier_ledger         !== undefined ? data.allow_cashier_ledger         : 0;
    this.open_account_system          = data.open_account_system          !== undefined ? data.open_account_system          : 0;
    this.allow_cashier_customer_edit  = data.allow_cashier_customer_edit  !== undefined ? data.allow_cashier_customer_edit  : 0;

    // ==================== COMPANY PERMISSIONS ====================
    this.allow_company_create = data.allow_company_create !== undefined ? data.allow_company_create : 0;
    this.allow_company_edit   = data.allow_company_edit   !== undefined ? data.allow_company_edit   : 0;
    this.allow_company_delete = data.allow_company_delete !== undefined ? data.allow_company_delete : 0;

    // ==================== TRANSFER SETTINGS ====================
    this.allow_branch_transfers                = data.allow_branch_transfers                !== undefined ? data.allow_branch_transfers                : 0;
    this.allow_branch_to_warehouse_transfers   = data.allow_branch_to_warehouse_transfers   !== undefined ? data.allow_branch_to_warehouse_transfers   : 0;
    this.allow_branch_to_branch_transfers      = data.allow_branch_to_branch_transfers      !== undefined ? data.allow_branch_to_branch_transfers      : 0;
    this.require_approval_for_branch_transfers = data.require_approval_for_branch_transfers !== undefined ? data.require_approval_for_branch_transfers : 0;
    this.max_transfer_amount                   = data.max_transfer_amount                   !== undefined ? data.max_transfer_amount                   : 0;

    // ==================== BACKWARD COMPAT CAMELCASE ====================
    this.allowCompanyCreate                = this.allow_company_create === 1;
    this.allowCompanyEdit                  = this.allow_company_edit === 1;
    this.allowCompanyDelete                = this.allow_company_delete === 1;
    this.allowBranchTransfers              = this.allow_branch_transfers === 1;
    this.allowBranchToWarehouseTransfers   = this.allow_branch_to_warehouse_transfers === 1;
    this.allowBranchToBranchTransfers      = this.allow_branch_to_branch_transfers === 1;
    this.requireApprovalForBranchTransfers = this.require_approval_for_branch_transfers === 1;
    this.maxTransferAmount                 = this.max_transfer_amount;

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
      settings = {},
      allow_company_create = 0,
      allow_company_edit = 0,
      allow_company_delete = 0
    } = branchData;

    const [result] = await pool.execute(
      `INSERT INTO branches (
        name, code, location, phone, email, manager_name, manager_phone,
        manager_email, linked_warehouse_id, status, created_by, settings,
        allow_cashier_inventory_add, allow_cashier_inventory_edit,
        allow_cashier_returns, allow_cashier_customers,
        allow_cashier_pos, allow_cashier_ledger, open_account_system,
        allow_company_create, allow_company_edit, allow_company_delete,
        allow_cashier_customer_edit,
        allow_branch_transfers, allow_branch_to_warehouse_transfers,
        allow_branch_to_branch_transfers, require_approval_for_branch_transfers,
        max_transfer_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, code, location, phone, email, managerName, managerPhone,
        managerEmail, linkedWarehouseId, status, createdBy, JSON.stringify(settings),
        0, 0, 0, 0, 0, 0, 0,
        allow_company_create, allow_company_edit, allow_company_delete,
        0, 0, 0, 0, 0, 0
      ]
    );

    return await Branch.findById(result.insertId);
  }

  // Static method to find branch by ID
  static async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM branches WHERE id = ?', [id]);
    if (rows.length === 0) return null;
    return new Branch(rows[0]);
  }

  // Static method to find branch by conditions
  static async findOne(conditions) {
    let query = 'SELECT * FROM branches WHERE ';
    const params = [];
    const conditionsArray = [];

    if (conditions.code) { conditionsArray.push('code = ?'); params.push(conditions.code); }
    if (conditions.name) { conditionsArray.push('name = ?'); params.push(conditions.name); }
    if (conditions._id)  { conditionsArray.push('id = ?');   params.push(conditions._id); }
    if (conditions.id)   { conditionsArray.push('id = ?');   params.push(conditions.id); }

    if (conditionsArray.length === 0) return null;

    query += conditionsArray.join(' AND ') + ' LIMIT 1';

    const [rows] = await pool.execute(query, params);
    if (rows.length === 0) return null;
    return new Branch(rows[0]);
  }

  // Instance method to save branch
  async save() {
    if (this.id) {
      await pool.execute(
        `UPDATE branches SET
          name = ?,
          code = ?,
          location = ?,
          phone = ?,
          email = ?,
          manager_name = ?,
          manager_phone = ?,
          manager_email = ?,
          linked_warehouse_id = ?,
          status = ?,
          updated_by = ?,
          settings = ?,
          allow_cashier_inventory_add = ?,
          allow_cashier_inventory_edit = ?,
          allow_cashier_returns = ?,
          allow_cashier_customers = ?,
          allow_cashier_pos = ?,
          allow_cashier_ledger = ?,
          open_account_system = ?,
          allow_company_create = ?,
          allow_company_edit = ?,
          allow_company_delete = ?,
          allow_cashier_customer_edit = ?,
          allow_branch_transfers = ?,
          allow_branch_to_warehouse_transfers = ?,
          allow_branch_to_branch_transfers = ?,
          require_approval_for_branch_transfers = ?,
          max_transfer_amount = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          this.name,
          this.code,
          this.location,
          this.phone,
          this.email,
          this.managerName,
          this.managerPhone,
          this.managerEmail,
          this.linkedWarehouseId,
          this.status,
          this.updatedBy,
          JSON.stringify(this.settings),
          this.allow_cashier_inventory_add  || 0,
          this.allow_cashier_inventory_edit || 0,
          this.allow_cashier_returns        || 0,
          this.allow_cashier_customers      || 0,
          this.allow_cashier_pos            || 0,
          this.allow_cashier_ledger         || 0,
          this.open_account_system          || 0,
          this.allow_company_create         || 0,
          this.allow_company_edit           || 0,
          this.allow_company_delete         || 0,
          this.allow_cashier_customer_edit  || 0,
          this.allow_branch_transfers                || 0,
          this.allow_branch_to_warehouse_transfers   || 0,
          this.allow_branch_to_branch_transfers      || 0,
          this.require_approval_for_branch_transfers || 0,
          this.max_transfer_amount                   || 0,
          this.id
        ]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO branches (
          name, code, location, phone, email, manager_name, manager_phone,
          manager_email, linked_warehouse_id, status, created_by, settings,
          allow_cashier_inventory_add, allow_cashier_inventory_edit,
          allow_cashier_returns, allow_cashier_customers,
          allow_cashier_pos, allow_cashier_ledger, open_account_system,
          allow_company_create, allow_company_edit, allow_company_delete,
          allow_cashier_customer_edit,
          allow_branch_transfers, allow_branch_to_warehouse_transfers,
          allow_branch_to_branch_transfers, require_approval_for_branch_transfers,
          max_transfer_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.name, this.code, this.location, this.phone, this.email,
          this.managerName, this.managerPhone, this.managerEmail,
          this.linkedWarehouseId, this.status, this.createdBy,
          JSON.stringify(this.settings),
          this.allow_cashier_inventory_add  || 0,
          this.allow_cashier_inventory_edit || 0,
          this.allow_cashier_returns        || 0,
          this.allow_cashier_customers      || 0,
          this.allow_cashier_pos            || 0,
          this.allow_cashier_ledger         || 0,
          this.open_account_system          || 0,
          this.allow_company_create         || 0,
          this.allow_company_edit           || 0,
          this.allow_company_delete         || 0,
          this.allow_cashier_customer_edit  || 0,
          this.allow_branch_transfers                || 0,
          this.allow_branch_to_warehouse_transfers   || 0,
          this.allow_branch_to_branch_transfers      || 0,
          this.require_approval_for_branch_transfers || 0,
          this.max_transfer_amount                   || 0
        ]
      );
      this.id = result.insertId;
    }
    return this;
  }

  // Static method to find branches with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM branches WHERE 1=1';
    const params = [];

    if (conditions.name)     { query += ' AND name LIKE ?';     params.push(`%${conditions.name}%`); }
    if (conditions.code)     { query += ' AND code LIKE ?';     params.push(`%${conditions.code}%`); }
    if (conditions.location) { query += ' AND location LIKE ?'; params.push(`%${conditions.location}%`); }
    if (conditions.allow_company_create !== undefined) { query += ' AND allow_company_create = ?'; params.push(conditions.allow_company_create); }
    if (conditions.allow_company_edit   !== undefined) { query += ' AND allow_company_edit = ?';   params.push(conditions.allow_company_edit); }
    if (conditions.allow_company_delete !== undefined) { query += ' AND allow_company_delete = ?'; params.push(conditions.allow_company_delete); }

    if (options.sort) {
      const sortField = options.sort.replace(/^-/, '');
      const sortOrder = options.sort.startsWith('-') ? 'DESC' : 'ASC';
      query += ` ORDER BY ${sortField} ${sortOrder}`;
    } else {
      query += ' ORDER BY created_at DESC';
    }

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.skip) { query += ' OFFSET ?'; params.push(options.skip); }
    }

    const [rows] = await pool.execute(query, params);
    return rows.map(row => new Branch(row));
  }

  // Static method to count branches
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM branches WHERE 1=1';
    const params = [];

    if (conditions.name)     { query += ' AND name LIKE ?';     params.push(`%${conditions.name}%`); }
    if (conditions.code)     { query += ' AND code LIKE ?';     params.push(`%${conditions.code}%`); }
    if (conditions.location) { query += ' AND location LIKE ?'; params.push(`%${conditions.location}%`); }

    const [rows] = await pool.execute(query, params);
    return rows[0].count;
  }

  // Static method to update branch
  static async updateOne(conditions, updateData) {
    let query = 'UPDATE branches SET ';
    const params = [];
    const setClauses = [];

    const fieldMapping = {
      'managerName':       'manager_name',
      'managerPhone':      'manager_phone',
      'managerEmail':      'manager_email',
      'linkedWarehouseId': 'linked_warehouse_id',
      'createdBy':         'created_by',
      'updatedBy':         'updated_by',
      'allowCompanyCreate': 'allow_company_create',
      'allowCompanyEdit':   'allow_company_edit',
      'allowCompanyDelete': 'allow_company_delete'
    };

    const allowedFields = [
      'name', 'code', 'location', 'phone', 'email', 'managerName',
      'managerPhone', 'managerEmail', 'linkedWarehouseId', 'status',
      'settings', 'createdBy', 'updatedBy',
      'allow_company_create', 'allow_company_edit', 'allow_company_delete',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete'
    ];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && allowedFields.includes(key)) {
        const dbColumn = fieldMapping[key] || key;
        setClauses.push(`${dbColumn} = ?`);
        params.push(key === 'settings' ? JSON.stringify(updateData[key]) : updateData[key]);
      }
    });

    if (setClauses.length === 0) return { modifiedCount: 0 };

    query += setClauses.join(', ') + ' WHERE ';

    const whereClauses = [];
    if (conditions._id)  { whereClauses.push('id = ?');   params.push(conditions._id); }
    if (conditions.id)   { whereClauses.push('id = ?');   params.push(conditions.id); }
    if (conditions.code) { whereClauses.push('code = ?'); params.push(conditions.code); }

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

    if (conditions._id)  { whereClauses.push('id = ?');   params.push(conditions._id); }
    if (conditions.id)   { whereClauses.push('id = ?');   params.push(conditions.id); }
    if (conditions.code) { whereClauses.push('code = ?'); params.push(conditions.code); }

    if (whereClauses.length === 0) return { deletedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { deletedCount: result.affectedRows };
  }

  // Static method to find branch by code
  static async findByCode(code) {
    const [rows] = await pool.execute('SELECT * FROM branches WHERE code = ?', [code]);
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
    const [rows] = await pool.execute('SELECT settings FROM branches WHERE id = ?', [branchId]);
    if (rows.length === 0) return null;
    const settings = rows[0].settings;
    if (!settings) return {};
    try {
      return typeof settings === 'string' ? JSON.parse(settings) : settings;
    } catch (error) {
      return {};
    }
  }

  // Helper method to get company permissions
  getCompanyPermissions() {
    return {
      canCreate: this.allow_company_create === 1,
      canEdit:   this.allow_company_edit   === 1,
      canDelete: this.allow_company_delete === 1
    };
  }

  // Static method to update branch by ID
  static async update(id, updateData) {
    const dbUpdateData = {};

    if (updateData.name         !== undefined) dbUpdateData.name         = updateData.name;
    if (updateData.code         !== undefined) dbUpdateData.code         = updateData.code;
    if (updateData.location     !== undefined) dbUpdateData.location     = updateData.location;
    if (updateData.phone        !== undefined) dbUpdateData.phone        = updateData.phone;
    if (updateData.email        !== undefined) dbUpdateData.email        = updateData.email;
    if (updateData.managerName  !== undefined) dbUpdateData.manager_name  = updateData.managerName;
    if (updateData.managerPhone !== undefined) dbUpdateData.manager_phone = updateData.managerPhone;
    if (updateData.managerEmail !== undefined) dbUpdateData.manager_email = updateData.managerEmail;
    if (updateData.linkedWarehouseId !== undefined) dbUpdateData.linked_warehouse_id = updateData.linkedWarehouseId;
    if (updateData.status       !== undefined) dbUpdateData.status       = updateData.status;

    const permissionFields = ['allow_company_create', 'allow_company_edit', 'allow_company_delete'];
    permissionFields.forEach(field => {
      if (updateData[field] !== undefined) dbUpdateData[field] = updateData[field];
    });

    if (updateData.settings !== undefined) {
      dbUpdateData.settings = typeof updateData.settings === 'string'
        ? updateData.settings
        : JSON.stringify(updateData.settings);
    }

    if (updateData.updatedBy !== undefined) dbUpdateData.updated_by = updateData.updatedBy;
    dbUpdateData.updated_at = new Date();

    const setClauses = [];
    const params = [];

    Object.keys(dbUpdateData).forEach(key => {
      setClauses.push(`${key} = ?`);
      params.push(dbUpdateData[key]);
    });

    if (setClauses.length === 0) throw new Error('No fields to update');

    const query = `UPDATE branches SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);

    const [result] = await pool.execute(query, params);
    if (result.affectedRows === 0) throw new Error('Branch not found');

    return await Branch.findById(id);
  }
}

module.exports = Branch;  