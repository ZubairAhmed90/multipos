const { pool } = require('../config/database');

class Warehouse {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
    this.location = data.location;
    this.branchId = data.branch_id;
    this.capacity = data.capacity || null;
    this.currentStock = data.current_stock || null;
    this.stock = data.stock || null;
    this.manager = data.manager || 'Not Assigned';
    this.status = data.status || 'active';
    this.settings = data.settings ? JSON.parse(data.settings) : {};
    this.allow_warehouse_company_crud = data.allow_warehouse_company_crud || 0;
    this.createdBy = data.created_by;
    this.updatedBy = data.updated_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static method to create a new warehouse
  static async create(warehouseData) {
    const { 
      name, 
      code, 
      location, 
      branch_id, 
      capacity = null,
      stock = null,
      manager = 'Not Assigned',
      status = 'active',
      created_by,
      settings = {} 
    } = warehouseData;
    
    const [result] = await pool.execute(
      `INSERT INTO warehouses (name, code, location, branch_id, capacity, stock, manager, status, created_by, settings) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, location, branch_id, capacity, stock, manager, status, created_by, JSON.stringify(settings)]
    );
    
    return await Warehouse.findById(result.insertId);
  }

  // Static method to find warehouse by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM warehouses WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    return new Warehouse(rows[0]);
  }

  // Static method to find warehouse
  static async findOne(conditions) {
    let query = 'SELECT * FROM warehouses WHERE ';
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
    return new Warehouse(rows[0]);
  }

  // Instance method to save warehouse
  async save() {
    if (this.id) {
      // Update existing warehouse
      await pool.execute(
        `UPDATE warehouses SET name = ?, code = ?, location = ?, settings = ? 
         WHERE id = ?`,
        [this.name, this.code, this.location, JSON.stringify(this.settings), this.id]
      );
    } else {
      // Create new warehouse
      const result = await pool.execute(
        `INSERT INTO warehouses (name, code, location, settings) 
         VALUES (?, ?, ?, ?)`,
        [this.name, this.code, this.location, JSON.stringify(this.settings)]
      );
      this.id = result[0].insertId;
    }
    return this;
  }

  // Static method to find warehouses with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM warehouses WHERE 1=1';
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
    return rows.map(row => new Warehouse(row));
  }

  // Static method to count warehouses
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM warehouses WHERE 1=1';
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

  // Static method to update warehouse by ID
  static async update(id, updateData) {
    // Convert camelCase to snake_case for database fields
    const dbUpdateData = {};
    
    if (updateData.name !== undefined) dbUpdateData.name = updateData.name;
    if (updateData.code !== undefined) dbUpdateData.code = updateData.code;
    if (updateData.location !== undefined) dbUpdateData.location = updateData.location;
    if (updateData.branchId !== undefined) dbUpdateData.branch_id = updateData.branchId;
    if (updateData.capacity !== undefined) dbUpdateData.capacity = updateData.capacity;
    if (updateData.stock !== undefined) dbUpdateData.stock = updateData.stock;
    if (updateData.manager !== undefined) dbUpdateData.manager = updateData.manager;
    if (updateData.status !== undefined) dbUpdateData.status = updateData.status;
    if (updateData.settings !== undefined) dbUpdateData.settings = typeof updateData.settings === 'string' ? updateData.settings : JSON.stringify(updateData.settings);
    if (updateData.updatedBy !== undefined) dbUpdateData.updated_by = updateData.updatedBy;
    
    // Add updated_at timestamp
    dbUpdateData.updated_at = new Date();
    
    const setClauses = [];
    const params = [];
    
    Object.keys(dbUpdateData).forEach(key => {
      setClauses.push(`${key} = ?`);
      params.push(dbUpdateData[key]);
    });
    
    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }
    
    const query = `UPDATE warehouses SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);
    
    const [result] = await pool.execute(query, params);
    
    if (result.affectedRows === 0) {
      throw new Error('Warehouse not found');
    }
    
    return await Warehouse.findById(id);
  }

  // Static method to update warehouse
  static async updateOne(conditions, updateData) {
    let query = 'UPDATE warehouses SET ';
    const params = [];
    const setClauses = [];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id') {
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
    if (conditions.code) {
      whereClauses.push('code = ?');
      params.push(conditions.code);
    }

    if (whereClauses.length === 0) return { modifiedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { modifiedCount: result.affectedRows };
  }

  // Static method to delete warehouse by ID
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM warehouses WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      throw new Error('Warehouse not found');
    }
    
    return { deletedCount: result.affectedRows };
  }

  // Static method to delete warehouse
  static async deleteOne(conditions) {
    let query = 'DELETE FROM warehouses WHERE ';
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

  // Static method to find warehouse by code
  static async findByCode(code) {
    const [rows] = await pool.execute(
      'SELECT * FROM warehouses WHERE code = ?',
      [code]
    );
    
    if (rows.length === 0) return null;
    return new Warehouse(rows[0]);
  }
}

module.exports = Warehouse;
