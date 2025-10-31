const { pool } = require('../config/database');
const InvoiceNumberService = require('../services/invoiceNumberService');
const LedgerService = require('../services/ledgerService');
const { createSaleTransaction } = require('../middleware/stockTracking');

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
        notes,
        customerInfo: incomingCustomerInfo // Customer info from controller
      } = saleData;

      // Get warehouse information from warehouse keeper
      // First, get the warehouse_id from the user, then get warehouse details
      let warehouseId = null;
      let warehouseName = null;
      let warehouseCode = null;
      
      try {
        const [users] = await connection.execute(
          'SELECT warehouse_id FROM users WHERE id = ?',
          [warehouseKeeperId]
        );
        
        if (users.length > 0 && users[0].warehouse_id) {
          warehouseId = users[0].warehouse_id;
          
          // Now get warehouse details
          const [warehouses] = await connection.execute(
            'SELECT id, name, code FROM warehouses WHERE id = ?',
            [warehouseId]
          );
          
          if (warehouses.length > 0) {
            warehouseName = warehouses[0].name;
            warehouseCode = warehouses[0].code;
          }
        }
      } catch (error) {
        console.error('[WarehouseSale] Error fetching warehouse info:', error);
      }

      // Generate invoice number using warehouse code
      let invoiceNumber;
      try {
        if (warehouseCode) {
          
          // Get the highest existing invoice number for this warehouse
          const [maxRows] = await connection.execute(
            'SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1',
            [`${warehouseCode}-%`]
          );
          
          let nextNumber = 1;
          if (maxRows.length > 0) {
            const lastInvoice = maxRows[0].invoice_no;
            // Extract the number part after the code and hyphen
            const match = lastInvoice.match(new RegExp(`^${warehouseCode}-(\\d+)$`));
            if (match) {
              nextNumber = parseInt(match[1]) + 1;
            }
          }
          
          invoiceNumber = `${warehouseCode}-${nextNumber.toString().padStart(6, '0')}`;
          console.log('[WarehouseSale] Generated sequential warehouse invoice number:', invoiceNumber);
        } else {
          throw new Error('Warehouse code not found');
        }
      } catch (invoiceError) {
        console.error('[WarehouseSale] Error generating invoice number:', invoiceError);
        // Use regular warehouse invoice numbering as fallback
        try {
          invoiceNumber = await InvoiceNumberService.generateInvoiceNumber('WAREHOUSE', warehouseId || warehouseKeeperId);
          console.log('[WarehouseSale] Using fallback warehouse invoice number:', invoiceNumber);
        } catch (fallbackError) {
          console.error('[WarehouseSale] Error with fallback invoice number:', fallbackError);
          // Last resort: sequential based on warehouse
          const timestamp = Date.now().toString().slice(-6);
          invoiceNumber = `WH${warehouseId || warehouseKeeperId}-${timestamp}`;
          console.log('[WarehouseSale] Using emergency invoice number:', invoiceNumber);
        }
      }
      
      // Use warehouse name as scope_id (consistent with branch sales which use branch name)
      // If warehouse name not found, fall back to warehouse keeper ID for backward compatibility
      const scopeIdForSale = warehouseName || String(warehouseKeeperId);
      
      console.log('[WarehouseSale] Using scope_id:', scopeIdForSale, 'for warehouse:', warehouseName, 'ID:', warehouseId);

      // Prepare customer info with salesperson data
      // Merge incoming customerInfo with our local data, preserving phone and other fields
      const customerInfo = {
        id: incomingCustomerInfo?.id || retailerId,
        name: incomingCustomerInfo?.name || customerName,
        phone: incomingCustomerInfo?.phone || '', // Preserve phone from frontend
        paymentTerms: paymentMethod === 'CREDIT' ? paymentTerms : null,
        paymentMethod: paymentMethod,
        salesperson: {
          id: salespersonId || null,
          name: salespersonName || null,
          phone: salespersonPhone || null
        },
        // Include any other fields from incoming customerInfo
        ...(incomingCustomerInfo || {})
      };
      // Make sure name and id are set correctly
      customerInfo.name = customerInfo.name || customerName;
      customerInfo.id = customerInfo.id || retailerId;

      // Get retailer's previous running balance
      let previousRunningBalance = 0;
      try {
        // Only fetch running balance if retailerId is provided
        if (retailerId) {
          // Use warehouse name for scope_id matching (consistent with how we store it)
          const [latestSale] = await connection.execute(`
            SELECT running_balance 
            FROM sales 
            WHERE JSON_EXTRACT(customer_info, "$.id") = ?
              AND scope_type = 'WAREHOUSE'
              AND (scope_id = ? OR scope_id = ?)
            ORDER BY created_at DESC 
            LIMIT 1
          `, [retailerId, scopeIdForSale, String(warehouseKeeperId)]);
          
          if (latestSale.length > 0) {
            previousRunningBalance = parseFloat(latestSale[0].running_balance) || 0;
          }
        }
      } catch (error) {
        console.error('[WarehouseSale] Error fetching previous running balance:', error);
        previousRunningBalance = 0;
      }

      // Calculate running balance: running_balance = previous_balance + (bill_amount - payment_amount)
      const newCreditAmount = finalAmount - paymentAmount;
      const runningBalance = previousRunningBalance + newCreditAmount;

      console.log('[WarehouseSale] Running balance calculation:', {
        previousRunningBalance,
        finalAmount,
        paymentAmount,
        newCreditAmount,
        runningBalance
      });

      // Determine payment status and type based on payment method
      // Note: paymentStatus should come from controller if provided
      let paymentStatusForInsert = 'COMPLETED';
      let paymentType = 'FULL_PAYMENT';
      
      if (paymentMethod === 'FULLY_CREDIT') {
        paymentStatusForInsert = 'PENDING';
        paymentType = 'FULLY_CREDIT';
      } else if (creditAmount > 0) {
        paymentStatusForInsert = 'PENDING';
        paymentType = 'PARTIAL_PAYMENT';
      }

      // Extract customer name and phone from customerInfo for database storage
      // Use customerInfo name if provided, otherwise fall back to the customerName parameter, then default
      const finalCustomerName = customerInfo?.name || customerName || 'Walk-in Customer';
      const customerPhone = customerInfo?.phone || '';
      
      // Create warehouse sale record using existing sales table
      // Use warehouse name as scope_id (consistent with branch sales which use branch name)
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (user_id, scope_type, scope_id, invoice_no, subtotal, tax, discount, total, payment_method, payment_type, payment_status, payment_amount, credit_amount, running_balance, status, customer_info, customer_name, customer_phone, notes, created_at, updated_at)
         VALUES (?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, NOW(), NOW())`,
        [warehouseKeeperId, scopeIdForSale, invoiceNumber, totalAmount, taxAmount, discountAmount, finalAmount, paymentMethod, paymentType, paymentStatusForInsert, paymentAmount, creditAmount, runningBalance, JSON.stringify(customerInfo), finalCustomerName, customerPhone, notes]
      );

      const saleId = saleResult.insertId;

      // Create sale items using existing sales_items table and track stock
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

        // Create stock transaction record for inventory tracking (sold items count)
        try {
          // Get warehouse keeper info for the transaction record
          const [warehouseKeeperInfo] = await connection.execute(
            'SELECT username, name FROM users WHERE id = ?',
            [warehouseKeeperId]
          );
          
          const userName = warehouseKeeperInfo.length > 0 
            ? (warehouseKeeperInfo[0].name || warehouseKeeperInfo[0].username)
            : 'Warehouse Keeper';

          await createSaleTransaction(
            item.itemId,
            item.quantity,
            item.unitPrice,
            warehouseKeeperId,
            userName,
            'WAREHOUSE_KEEPER',
            saleId
          );
          
          console.log(`[WarehouseSale] Created stock transaction for item ${item.itemId}, quantity: ${item.quantity}`);
        } catch (stockError) {
          console.error(`[WarehouseSale] Error creating stock transaction for item ${item.itemId}:`, stockError);
          // Don't fail the sale if stock tracking fails
        }
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
                s.payment_method, s.payment_status, s.customer_info, s.customer_name, s.customer_phone, s.notes, s.status, 
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
