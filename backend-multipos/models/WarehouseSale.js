const { pool } = require('../config/database');

class WarehouseSale {
  constructor(data) {
    this.id = data.id;
    this.retailerId = data.retailer_id;
    this.warehouseKeeperId = data.warehouse_keeper_id;
    this.totalAmount = data.total_amount;
    this.taxAmount = data.tax_amount;
    this.discountAmount = data.discount_amount;
    this.finalAmount = data.final_amount;
    this.paymentMethod = data.payment_method;
    this.paymentStatus = data.payment_status;
    this.invoiceNumber = data.invoice_number;
    this.notes = data.notes;
    this.status = data.status;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create new warehouse sale
  static async create(saleData, customerName = 'Company', paymentMethod = 'CASH', paymentTerms = null) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const {
        retailerId,
        warehouseKeeperId,
        items,
        totalAmount,
        taxAmount,
        discountAmount,
        finalAmount,
        paymentMethod,
        notes
      } = saleData;

      // Generate invoice number
      const invoiceNumber = `WS${Date.now()}`;

      // Create warehouse sale record using existing sales table
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (user_id, scope_type, scope_id, invoice_no, subtotal, tax, discount, total, payment_method, payment_status, status, customer_info, notes, created_at, updated_at)
         VALUES (?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 'COMPLETED', ?, ?, NOW(), NOW())`,
        [warehouseKeeperId, warehouseKeeperId, invoiceNumber, totalAmount, taxAmount, discountAmount, finalAmount, paymentMethod, JSON.stringify({id: retailerId, name: customerName, paymentTerms: paymentMethod === 'CREDIT' ? paymentTerms : null, paymentMethod: paymentMethod}), notes]
      );

      const saleId = saleResult.insertId;

      // Create sale items using existing sales_items table
      for (const item of items) {
        await connection.execute(
          `INSERT INTO sale_items (sale_id, inventory_item_id, sku, name, quantity, unit_price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.itemId, item.sku || '', item.name || '', item.quantity, item.unitPrice, item.discount || 0, item.totalPrice]
        );

        // Update inventory quantity
        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?',
          [item.quantity, item.itemId]
        );
      }

      // Create company ledger entry for the sale
      await connection.execute(`
        INSERT INTO ledger_entries (
          entry_type, 
          reference_id, 
          description, 
          debit_amount, 
          credit_amount, 
          branch_id, 
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'WAREHOUSE_SALE', 
        saleId, 
        `Warehouse Sale ${invoiceNumber} [Company ID: ${retailerId}]`, 
        null, // No debit for company
        finalAmount, // Credit the company account
        null, // Set to null for company operations
        warehouseKeeperId
      ]);

      await connection.commit();
      return await WarehouseSale.findById(saleId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Find warehouse sale by ID
  static async findById(id) {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(
        `SELECT s.id, s.invoice_no as invoice_number, s.scope_type, s.scope_id, s.user_id, s.shift_id, 
                s.subtotal as total_amount, s.tax as tax_amount, s.discount as discount_amount, s.total as final_amount,
                s.payment_method, s.payment_status, s.customer_info, s.notes, s.status, 
                s.created_at, s.updated_at,
                u.username as warehouse_keeper_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.id = ? AND s.scope_type = 'WAREHOUSE'`,
        [id]
      );

      if (rows.length === 0) return null;

      const sale = new WarehouseSale(rows[0]);
      
      // Get sale items
      const [items] = await connection.execute(
        `SELECT si.*, ii.name as item_name, ii.sku as item_sku
         FROM sale_items si
         LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
         WHERE si.sale_id = ?`,
        [id]
      );

      sale.items = items;
      return sale;
    } finally {
      connection.release();
    }
  }

  // Find all warehouse sales
  static async findAll(filters = {}) {
    const connection = await pool.getConnection();

    try {
      let query = `SELECT s.id, s.invoice_no as invoice_number, s.scope_type, s.scope_id, s.user_id, s.shift_id, 
                           s.subtotal as total_amount, s.tax as tax_amount, s.discount as discount_amount, s.total as final_amount,
                           s.payment_method, s.payment_status, s.customer_info, s.notes, s.status, 
                           s.created_at, s.updated_at,
                           u.username as warehouse_keeper_name
                   FROM sales s
                   LEFT JOIN users u ON s.user_id = u.id
                   WHERE s.scope_type = 'WAREHOUSE'`;
      const params = [];

      if (filters.retailerId) {
        query += ' AND JSON_EXTRACT(s.customer_info, "$.id") = ?';
        params.push(filters.retailerId);
      }

      if (filters.warehouseKeeperId) {
        query += ' AND s.user_id = ?';
        params.push(filters.warehouseKeeperId);
      }

      if (filters.status) {
        query += ' AND s.status = ?';
        params.push(filters.status);
      }

      if (filters.startDate) {
        query += ' AND s.created_at >= ?';
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ' AND s.created_at <= ?';
        params.push(filters.endDate);
      }

      query += ' ORDER BY s.created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const [rows] = await connection.execute(query, params);
      return rows.map(row => new WarehouseSale(row));
    } finally {
      connection.release();
    }
  }

  // Update warehouse sale
  async update(updateData) {
    const connection = await pool.getConnection();

    try {
      const fields = [];
      const values = [];

      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) return this;

      values.push(this.id);

      await connection.execute(
        `UPDATE sales SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );

      return await WarehouseSale.findById(this.id);
    } finally {
      connection.release();
    }
  }

  // Delete warehouse sale
  async delete() {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Restore inventory quantities
      const [items] = await connection.execute(
        'SELECT inventory_item_id, quantity FROM sale_items WHERE sale_id = ?',
        [this.id]
      );

      for (const item of items) {
        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
      }

      // Delete sale items
      await connection.execute(
        'DELETE FROM sale_items WHERE sale_id = ?',
        [this.id]
      );

      // Delete sale
      await connection.execute(
        'DELETE FROM sales WHERE id = ?',
        [this.id]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = WarehouseSale;
