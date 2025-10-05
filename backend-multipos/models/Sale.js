const { pool } = require('../config/database');

class SaleItem {
  constructor(data) {
    this.id = data.id;
    this.saleId = data.sale_id;
    this.inventoryItemId = data.inventory_item_id;
    this.sku = data.sku;
    this.name = data.name;
    this.quantity = data.quantity;
    this.unitPrice = data.unit_price;
    this.discount = data.discount;
    this.total = data.total;
    this.createdAt = data.created_at;
  }
}

class Sale {
  constructor(data) {
    this.id = data.id;
    this.invoiceNo = data.invoice_no;
    this.scopeType = data.scope_type;
    this.scopeId = data.scope_id;
    this.userId = data.user_id;
    this.shiftId = data.shift_id;
    this.subtotal = data.subtotal;
    this.tax = data.tax;
    this.discount = data.discount;
    this.total = data.total;
    this.paymentMethod = data.payment_method;
    this.paymentStatus = data.payment_status;
    this.customerInfo = data.customer_info ? JSON.parse(data.customer_info) : null;
    this.notes = data.notes;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.items = data.items || [];
  }

  // Static method to create a new sale with items
  static async create(saleData) {
    const { 
      invoiceNo, scopeType, scopeId, userId, shiftId, items, 
      subtotal, tax, discount, total, paymentMethod, paymentStatus, 
      customerInfo, notes, status = 'COMPLETED', customerName, customerPhone,
      paymentAmount, creditAmount, creditStatus, creditDueDate
    } = saleData;
    
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Insert sale (removed warehouse_sale_id column)
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (invoice_no, scope_type, scope_id, user_id, shift_id, 
         subtotal, tax, discount, total, payment_method, payment_status, 
         customer_info, notes, status, customer_name, customer_phone, 
         payment_amount, credit_amount, credit_status, credit_due_date) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invoiceNo || null, scopeType || null, scopeId || null, userId || null, shiftId || null, 
         subtotal || 0, tax || 0, discount || 0, total || 0, paymentMethod || null, 
         paymentStatus || null, customerInfo || null, notes || null, status || null, 
         customerName || null, customerPhone || null, paymentAmount || 0, 
         creditAmount || 0, creditStatus || 'NONE', creditDueDate || null]
      );
      
      const saleId = saleResult.insertId;
      
      // Insert sale items
      if (items && items.length > 0) {
        for (const item of items) {
          await connection.execute(
            `INSERT INTO sale_items (sale_id, inventory_item_id, sku, name, 
             quantity, unit_price, discount, total) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [saleId, item.inventoryItemId, item.sku, item.name, 
             item.quantity, item.unitPrice, item.discount, item.total]
          );
        }
      }
      
      await connection.commit();
      
      return await Sale.findById(saleId);
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Static method to find sale by ID
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) return null;
    
    const sale = new Sale(rows[0]);
    
    // Get sale items
    const [itemRows] = await pool.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [id]
    );
    
    sale.items = itemRows.map(item => new SaleItem(item));
    
    return sale;
  }

  // Static method to find sale by invoice number
  static async findOne(conditions) {
    let query = 'SELECT * FROM sales WHERE ';
    const params = [];
    const conditionsArray = [];

    if (conditions.invoiceNo) {
      conditionsArray.push('invoice_no = ?');
      params.push(conditions.invoiceNo);
    }

    if (conditions._id) {
      conditionsArray.push('id = ?');
      params.push(conditions._id);
    }

    if (conditions.id) {
      conditionsArray.push('id = ?');
      params.push(conditions.id);
    }

    if (conditions.scopeType && conditions.scopeId) {
      conditionsArray.push('scope_type = ? AND scope_id = ?');
      params.push(conditions.scopeType, conditions.scopeId);
    }

    if (conditionsArray.length === 0) return null;

    query += conditionsArray.join(' AND ');
    query += ' LIMIT 1';

    const [rows] = await pool.execute(query, params);
    
    if (rows.length === 0) return null;
    
    const sale = new Sale(rows[0]);
    
    // Get sale items
    const [itemRows] = await pool.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [sale.id]
    );
    
    sale.items = itemRows.map(item => new SaleItem(item));
    
    return sale;
  }

  // Instance method to save sale
  async save() {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      if (this.id) {
        // Update existing sale
        await connection.execute(
          `UPDATE sales SET invoice_no = ?, scope_type = ?, scope_id = ?, user_id = ?, 
           shift_id = ?, subtotal = ?, tax = ?, discount = ?, total = ?, 
           payment_method = ?, payment_status = ?, customer_info = ?, notes = ?, status = ? 
           WHERE id = ?`,
          [this.invoiceNo, this.scopeType, this.scopeId, this.userId, this.shiftId,
           this.subtotal, this.tax, this.discount, this.total, this.paymentMethod,
           this.paymentStatus, JSON.stringify(this.customerInfo), this.notes, this.status, this.id]
        );
        
        // Update sale items if provided
        if (this.items && this.items.length > 0) {
          // Delete existing items
          await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [this.id]);
          
          // Insert new items
          for (const item of this.items) {
            await connection.execute(
              `INSERT INTO sale_items (sale_id, inventory_item_id, sku, name, 
               quantity, unit_price, discount, total) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [this.id, item.inventoryItemId, item.sku, item.name, 
               item.quantity, item.unitPrice, item.discount, item.total]
            );
          }
        }
      } else {
        // Create new sale
        const result = await connection.execute(
          `INSERT INTO sales (invoice_no, scope_type, scope_id, user_id, shift_id, 
           subtotal, tax, discount, total, payment_method, payment_status, 
           customer_info, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.invoiceNo, this.scopeType, this.scopeId, this.userId, this.shiftId,
           this.subtotal, this.tax, this.discount, this.total, this.paymentMethod,
           this.paymentStatus, JSON.stringify(this.customerInfo), this.notes, this.status]
        );
        
        this.id = result[0].insertId;
        
        // Insert sale items
        if (this.items && this.items.length > 0) {
          for (const item of this.items) {
            await connection.execute(
              `INSERT INTO sale_items (sale_id, inventory_item_id, sku, name, 
               quantity, unit_price, discount, total) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [this.id, item.inventoryItemId, item.sku, item.name, 
               item.quantity, item.unitPrice, item.discount, item.total]
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

  // Static method to find sales with pagination
  static async find(conditions = {}, options = {}) {
    let query = 'SELECT * FROM sales WHERE 1=1';
    const params = [];

    if (conditions.scopeType) {
      query += ' AND scope_type = ?';
      params.push(conditions.scopeType);
    }

    if (conditions.scopeId) {
      query += ' AND scope_id = ?';
      params.push(conditions.scopeId);
    }

    if (conditions.userId) {
      query += ' AND user_id = ?';
      params.push(conditions.userId);
    }

    if (conditions.shiftId) {
      query += ' AND shift_id = ?';
      params.push(conditions.shiftId);
    }

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(conditions.paymentStatus);
    }

    if (conditions.paymentMethod) {
      query += ' AND payment_method = ?';
      params.push(conditions.paymentMethod);
    }

    if (conditions.invoiceNo) {
      query += ' AND invoice_no LIKE ?';
      params.push(`%${conditions.invoiceNo}%`);
    }

    // Date range filtering
    if (conditions.createdAt) {
      if (conditions.createdAt.$gte) {
        query += ' AND created_at >= ?';
        params.push(conditions.createdAt.$gte);
      }
      if (conditions.createdAt.$lte) {
        query += ' AND created_at <= ?';
        params.push(conditions.createdAt.$lte);
      }
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
    const sales = [];

    for (const row of rows) {
      const sale = new Sale(row);
      
      // Get sale items
      const [itemRows] = await pool.execute(
        'SELECT * FROM sale_items WHERE sale_id = ?',
        [sale.id]
      );
      
      sale.items = itemRows.map(item => new SaleItem(item));
      sales.push(sale);
    }

    return sales;
  }

  // Static method to count sales
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM sales WHERE 1=1';
    const params = [];

    if (conditions.scopeType) {
      query += ' AND scope_type = ?';
      params.push(conditions.scopeType);
    }

    if (conditions.scopeId) {
      query += ' AND scope_id = ?';
      params.push(conditions.scopeId);
    }

    if (conditions.userId) {
      query += ' AND user_id = ?';
      params.push(conditions.userId);
    }

    if (conditions.shiftId) {
      query += ' AND shift_id = ?';
      params.push(conditions.shiftId);
    }

    if (conditions.status) {
      query += ' AND status = ?';
      params.push(conditions.status);
    }

    if (conditions.paymentStatus) {
      query += ' AND payment_status = ?';
      params.push(conditions.paymentStatus);
    }

    if (conditions.paymentMethod) {
      query += ' AND payment_method = ?';
      params.push(conditions.paymentMethod);
    }

    if (conditions.invoiceNo) {
      query += ' AND invoice_no LIKE ?';
      params.push(`%${conditions.invoiceNo}%`);
    }

    // Date range filtering
    if (conditions.createdAt) {
      if (conditions.createdAt.$gte) {
        query += ' AND created_at >= ?';
        params.push(conditions.createdAt.$gte);
      }
      if (conditions.createdAt.$lte) {
        query += ' AND created_at <= ?';
        params.push(conditions.createdAt.$lte);
      }
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].count;
  }

  // Static method to update sale by ID (alias for updateOne)
  static async update(id, updateData) {
    return await Sale.updateOne({ id }, updateData);
  }

  // Static method to update sale
  static async updateOne(conditions, updateData) {
    
    let query = 'UPDATE sales SET ';
    const params = [];
    const setClauses = [];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && key !== 'items') {
        if (key === 'customerInfo') {
          setClauses.push('customer_info = ?');
          params.push(JSON.stringify(updateData[key]));
        } else {
          // Map camelCase to snake_case for database columns
          const fieldMapping = {
            'paymentStatus': 'payment_status',
            'paymentMethod': 'payment_method',
            'scopeType': 'scope_type',
            'scopeId': 'scope_id',
            'userId': 'user_id',
            'shiftId': 'shift_id',
            'customerInfo': 'customer_info',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at'
          };
          
          const dbColumn = fieldMapping[key] || key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
          
          setClauses.push(`${dbColumn} = ?`);
          params.push(updateData[key]);
        }
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
    if (conditions.invoiceNo) {
      whereClauses.push('invoice_no = ?');
      params.push(conditions.invoiceNo);
    }

    if (whereClauses.length === 0) return { modifiedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { modifiedCount: result.affectedRows };
  }

  // Static method to delete sale
  static async deleteOne(conditions) {
    let query = 'DELETE FROM sales WHERE ';
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
    if (conditions.invoiceNo) {
      whereClauses.push('invoice_no = ?');
      params.push(conditions.invoiceNo);
    }

    if (whereClauses.length === 0) return { deletedCount: 0 };

    query += whereClauses.join(' AND ');

    const [result] = await pool.execute(query, params);
    return { deletedCount: result.affectedRows };
  }

  // Static method to delete sale by ID (alias for deleteOne)
  static async delete(id) {
    return await Sale.deleteOne({ id });
  }

  // Static method to get sale items
  static async getSaleItems(saleId) {
    const [rows] = await pool.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [saleId]
    );
    
    return rows.map(item => new SaleItem(item));
  }
}

module.exports = Sale;
