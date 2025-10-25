const { pool } = require('../config/database');
const InvoiceNumberService = require('../services/invoiceNumberService');
const LedgerService = require('../services/ledgerService');

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
        salespersonId, // New field for salesperson who brought the sale
        salespersonName, // New field for salesperson name
        salespersonPhone, // New field for salesperson phone
        items,
        totalAmount,
        taxAmount,
        discountAmount,
        finalAmount,
        paymentMethod,
        paymentAmount = 0, // New field for partial payment amount
        creditAmount = 0, // New field for credit amount
        outstandingPayments = [], // New field for outstanding payments
        notes
      } = saleData;

      // Generate invoice number using warehouse code and salesperson identification
      let invoiceNumber;
      try {
        invoiceNumber = await InvoiceNumberService.generateInvoiceNumberWithSalesperson('WAREHOUSE', warehouseKeeperId, warehouseKeeperId);
        console.log('[WarehouseSale] Generated salesperson-specific invoice number:', invoiceNumber);
      } catch (invoiceError) {
        console.error('[WarehouseSale] Error generating salesperson-specific invoice number:', invoiceError);
        // Fallback to regular warehouse invoice numbering
        try {
          invoiceNumber = await InvoiceNumberService.generateInvoiceNumber('WAREHOUSE', warehouseKeeperId);
          console.log('[WarehouseSale] Using fallback warehouse invoice number:', invoiceNumber);
        } catch (fallbackError) {
          console.error('[WarehouseSale] Error with fallback invoice number:', fallbackError);
          // Final fallback to old method
          invoiceNumber = `WS${Date.now()}`;
          console.log('[WarehouseSale] Using final fallback invoice number:', invoiceNumber);
        }
      }

      // Prepare customer info with salesperson data
      const customerInfo = {
        id: retailerId,
        name: customerName,
        paymentTerms: paymentMethod === 'CREDIT' ? paymentTerms : null,
        paymentMethod: paymentMethod,
        salesperson: {
          id: salespersonId || null,
          name: salespersonName || null,
          phone: salespersonPhone || null
        }
      };

      // Determine payment status and type based on payment method
      let paymentStatus = 'COMPLETED'
      let paymentType = 'FULL_PAYMENT'
      
      if (paymentMethod === 'FULLY_CREDIT') {
        paymentStatus = 'PENDING'
        paymentType = 'FULLY_CREDIT'
      } else if (paymentMethod === 'PARTIAL_PAYMENT') {
        paymentStatus = 'PARTIAL'
        paymentType = 'PARTIAL_PAYMENT'
      }

      // Create warehouse sale record using existing sales table
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (user_id, scope_type, scope_id, invoice_no, subtotal, tax, discount, total, payment_method, payment_type, payment_status, payment_amount, credit_amount, status, customer_info, notes, created_at, updated_at)
         VALUES (?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, NOW(), NOW())`,
        [warehouseKeeperId, warehouseKeeperId, invoiceNumber, totalAmount, taxAmount, discountAmount, finalAmount, paymentMethod, paymentType, paymentStatus, paymentAmount, creditAmount, JSON.stringify(customerInfo), notes]
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

      await connection.commit();
      
      // Clear outstanding payments if any are selected
      if (outstandingPayments && outstandingPayments.length > 0) {
        try {
          console.log('[WarehouseSale] Clearing outstanding payments:', outstandingPayments);
          // Call the clear outstanding payments API
          const clearResponse = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/sales/clear-outstanding`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              outstandingPaymentIds: outstandingPayments,
              paymentAmount: paymentAmount,
              notes: `Cleared via warehouse sale ${invoiceNumber}`
            })
          });
          
          if (clearResponse.ok) {
            console.log('[WarehouseSale] Outstanding payments cleared successfully');
          } else {
            console.error('[WarehouseSale] Failed to clear outstanding payments');
          }
        } catch (clearError) {
          console.error('[WarehouseSale] Error clearing outstanding payments:', clearError);
          // Don't fail the sale if clearing outstanding payments fails
        }
      }
      
      // Record sale in ledger with proper debit/credit entries
      try {
        await LedgerService.recordSaleTransaction({
          saleId: saleId,
          invoiceNo: invoiceNumber,
          scopeType: 'WAREHOUSE',
          scopeId: warehouseKeeperId,
          totalAmount: finalAmount,
          paymentAmount: paymentAmount, // Use actual payment amount
          creditAmount: creditAmount, // Use actual credit amount
          paymentMethod: paymentMethod,
          customerInfo: customerInfo,
          userId: warehouseKeeperId,
          items: items
        });
        console.log('[WarehouseSale] Sale recorded in ledger successfully');
      } catch (ledgerError) {
        console.error('[WarehouseSale] Error recording sale in ledger:', ledgerError);
        // Don't fail the sale if ledger recording fails
      }
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
