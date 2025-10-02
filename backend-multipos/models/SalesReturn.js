const { pool } = require('../config/database');

class SalesReturn {
  constructor(data) {
    this.id = data.id;
    this.returnNo = data.return_no;
    this.originalSaleId = data.original_sale_id;
    this.reason = data.reason;
    this.totalAmount = data.total_amount;
    this.status = data.status;
    this.processedBy = data.processed_by;
    this.approvedBy = data.approved_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static method to create a new sales return
  static async create(returnData) {
    const { returnNo, originalSaleId, reason, totalAmount, processedBy } = returnData;
    
    const [result] = await pool.execute(
      `INSERT INTO sales_returns (return_no, original_sale_id, reason, total_amount, processed_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [returnNo, originalSaleId, reason, totalAmount, processedBy]
    );
    
    return await SalesReturn.findById(result.insertId);
  }

  // Static method to find sales return by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM sales_returns WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    return new SalesReturn(rows[0]);
  }

  // Static method to find sales return
  static async findOne(conditions) {
    let query = 'SELECT * FROM sales_returns WHERE ';
    const params = [];
    const conditionsArray = [];

    if (conditions.returnNo) {
      conditionsArray.push('return_no = ?');
      params.push(conditions.returnNo);
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
    return new SalesReturn(rows[0]);
  }

  // Instance method to save sales return
  async save() {
    if (this.id) {
      // Update existing sales return
      await pool.execute(
        `UPDATE sales_returns SET return_no = ?, original_sale_id = ?, reason = ?, 
         total_amount = ?, status = ?, processed_by = ?, approved_by = ? 
         WHERE id = ?`,
        [this.returnNo, this.originalSaleId, this.reason, this.totalAmount, 
         this.status, this.processedBy, this.approvedBy, this.id]
      );
    } else {
      // Create new sales return
      const result = await pool.execute(
        `INSERT INTO sales_returns (return_no, original_sale_id, reason, total_amount, status, processed_by, approved_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [this.returnNo, this.originalSaleId, this.reason, this.totalAmount, 
         this.status, this.processedBy, this.approvedBy]
      );
      this.id = result[0].insertId;
    }
    return this;
  }

  // Static method to find sales returns with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM sales_returns WHERE 1=1';
    const params = [];

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.processedBy) {
      query += ' AND processed_by = ?';
      params.push(conditions.processedBy);
    }

    if (conditions.approvedBy) {
      query += ' AND approved_by = ?';
      params.push(conditions.approvedBy);
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
    return rows.map(row => new SalesReturn(row));
  }

  // Static method to count sales returns
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM sales_returns WHERE 1=1';
    const params = [];

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.processedBy) {
      query += ' AND processed_by = ?';
      params.push(conditions.processedBy);
    }

    if (conditions.approvedBy) {
      query += ' AND approved_by = ?';
      params.push(conditions.approvedBy);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].count;
  }

  // Static method to update sales return
  static async updateOne(conditions, updateData) {
    let query = 'UPDATE sales_returns SET ';
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
    if (conditions.returnNo) {
      whereClauses.push('return_no = ?');
      params.push(conditions.returnNo);
    }

    if (whereClauses.length === 0) return { modifiedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { modifiedCount: result.affectedRows };
  }

  // Static method to delete sales return
  static async deleteOne(conditions) {
    let query = 'DELETE FROM sales_returns WHERE ';
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
    if (conditions.returnNo) {
      whereClauses.push('return_no = ?');
      params.push(conditions.returnNo);
    }

    if (whereClauses.length === 0) return { deletedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { deletedCount: result.affectedRows };
  }
}

module.exports = SalesReturn;