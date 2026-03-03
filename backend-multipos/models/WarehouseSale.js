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

    const parseNumber = (value, fallback = 0) => {
      if (value === undefined || value === null || value === '') {
        return fallback;
      }
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const normalizeId = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    };

    try {
      await connection.beginTransaction();

      const {
        retailerId,
        warehouseKeeperId,
        salespersonId,
        salespersonName,
        salespersonPhone,
        items = [],
        subtotal = 0,
        taxAmount = 0,
        discountAmount = 0,
        billAmount: providedBillAmount,
        totalWithOutstanding: providedTotalWithOutstanding,
        paymentMethod: incomingPaymentMethod,
        paymentType,
        paymentStatus,
        paymentAmount = 0,
        creditAmount = 0,
        outstandingPayments = [],
        notes,
        customerInfo: incomingCustomerInfo,
        scopeWarehouseId = null,
        outstandingPortion = null
      } = saleData;

      if (!warehouseKeeperId) {
        throw new Error('Warehouse keeper ID is required to create a warehouse sale');
      }

      const subtotalAmount = parseNumber(subtotal);
      const taxAmountValue = parseNumber(taxAmount);
      const discountAmountValue = parseNumber(discountAmount);
      const billAmount = parseNumber(providedBillAmount, subtotalAmount + taxAmountValue - discountAmountValue);
      const totalWithOutstanding = parseNumber(providedTotalWithOutstanding, billAmount);

      const paymentMethodValue = (incomingPaymentMethod || paymentMethod || 'CASH').toUpperCase();
      let paymentTypeValue = paymentType || null;
      const paymentAmountValue = parseNumber(paymentAmount, 0);
      const creditAmountValue = parseNumber(creditAmount, 0);

      if (!paymentTypeValue) {
        if (paymentMethodValue === 'FULLY_CREDIT') {
          paymentTypeValue = 'FULLY_CREDIT';
        } else if (creditAmountValue > 0 && paymentAmountValue > 0) {
          paymentTypeValue = 'PARTIAL_PAYMENT';
        } else if (creditAmountValue > 0) {
          paymentTypeValue = 'PARTIAL_PAYMENT';
        } else {
          paymentTypeValue = 'FULL_PAYMENT';
        }
      }

      let paymentStatusValue = paymentStatus || null;
      if (!paymentStatusValue) {
        if (paymentTypeValue === 'BALANCE_PAYMENT') {
          paymentStatusValue = 'COMPLETED';
        } else if (paymentMethodValue === 'FULLY_CREDIT') {
          paymentStatusValue = 'PENDING';
        } else if (creditAmountValue > 0) {
          paymentStatusValue = 'PENDING';
        } else {
          paymentStatusValue = 'COMPLETED';
        }
      }

      const normalizedItems = items.map((item) => {
        const inventoryItemId = normalizeId(item.itemId || item.inventoryItemId || item.id || null);
        const quantity = parseNumber(item.quantity, 0);
        const unitPrice = parseNumber(
          item.unitPrice !== undefined ? item.unitPrice : (item.customPrice !== undefined ? item.customPrice : item.price),
          0
        );
        const discountValue = parseNumber(item.discount, 0);
        const lineTotal = parseNumber(
          item.totalPrice !== undefined ? item.totalPrice : item.total,
          (unitPrice * quantity) - discountValue
        );

        return {
          itemId: inventoryItemId,
          inventoryItemId,
          sku: item.sku || '',
          name: item.name || '',
          quantity,
          unitPrice,
          discount: discountValue,
          totalPrice: lineTotal
        };
      });

      let warehouseId = normalizeId(scopeWarehouseId);
      let warehouseName = null;
      let warehouseCode = null;

      try {
        if (warehouseId) {
          const [warehouses] = await connection.execute(
            'SELECT id, name, code FROM warehouses WHERE id = ?',
            [warehouseId]
          );
          if (warehouses.length > 0) {
            warehouseName = warehouses[0].name;
            warehouseCode = warehouses[0].code;
          }
        }

        if (!warehouseName) {
          const [users] = await connection.execute(
            'SELECT warehouse_id FROM users WHERE id = ?',
            [warehouseKeeperId]
          );

          if (users.length > 0 && users[0].warehouse_id) {
            warehouseId = users[0].warehouse_id;

            const [warehouses] = await connection.execute(
              'SELECT id, name, code FROM warehouses WHERE id = ?',
              [warehouseId]
            );

            if (warehouses.length > 0) {
              warehouseName = warehouses[0].name;
              warehouseCode = warehouses[0].code;
            }
          }
        }
      } catch (warehouseError) {
        console.error('[WarehouseSale] Error fetching warehouse info:', warehouseError);
      }

      let invoiceNumber;
      try {
        if (warehouseCode) {
          const [maxRows] = await connection.execute(
            'SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1',
            [`${warehouseCode}-%`]
          );

          let nextNumber = 1;
          if (maxRows.length > 0) {
            const lastInvoice = maxRows[0].invoice_no;
            const match = lastInvoice.match(new RegExp(`^${warehouseCode}-(\\d+)$`));
            if (match) {
              nextNumber = parseInt(match[1], 10) + 1;
            }
          }

          invoiceNumber = `${warehouseCode}-${nextNumber.toString().padStart(6, '0')}`;
        } else {
          throw new Error('Warehouse code not found');
        }
      } catch (invoiceError) {
        console.error('[WarehouseSale] Error generating invoice number:', invoiceError);
        try {
          invoiceNumber = await InvoiceNumberService.generateInvoiceNumber('WAREHOUSE', warehouseId || warehouseKeeperId);
        } catch (fallbackError) {
          console.error('[WarehouseSale] Error with fallback invoice number:', fallbackError);
          const timestamp = Date.now().toString().slice(-6);
          invoiceNumber = `WH${warehouseId || warehouseKeeperId}-${timestamp}`;
        }
      }

      const scopeIdForSale = warehouseName || (warehouseId !== null ? String(warehouseId) : String(warehouseKeeperId));

      const customerInfoPayload = {
        id: incomingCustomerInfo?.id || retailerId,
        name: incomingCustomerInfo?.name || customerName,
        phone: incomingCustomerInfo?.phone || '',
        paymentTerms: paymentMethodValue === 'CREDIT' ? paymentTerms : incomingCustomerInfo?.paymentTerms || null,
        paymentMethod: paymentMethodValue,
        salesperson: {
          id: salespersonId || null,
          name: salespersonName || null,
          phone: salespersonPhone || null
        },
        ...(incomingCustomerInfo || {})
      };
      customerInfoPayload.name = customerInfoPayload.name || customerName;
      customerInfoPayload.id = customerInfoPayload.id || retailerId;

      let previousRunningBalance = 0;
      try {
        if (retailerId) {
          const [latestSale] = await connection.execute(
            `SELECT running_balance
             FROM sales
             WHERE JSON_EXTRACT(customer_info, "$.id") = ?
               AND scope_type = 'WAREHOUSE'
               AND (scope_id = ? OR scope_id = ?)
             ORDER BY created_at DESC
             LIMIT 1`,
            [retailerId, scopeIdForSale, String(warehouseKeeperId)]
          );

          if (latestSale.length > 0) {
            previousRunningBalance = parseNumber(latestSale[0].running_balance, 0);
          }
        }
      } catch (balanceError) {
        console.error('[WarehouseSale] Error fetching previous running balance:', balanceError);
        previousRunningBalance = 0;
      }

      const newCreditAmount = billAmount - paymentAmountValue;
      const oldBalance = previousRunningBalance; // old_balance = previous row's running_balance
      const runningBalance = oldBalance + billAmount - paymentAmountValue; // running_balance = old_balance + amount - payment
      const creditStatus = creditAmountValue !== 0 ? 'PENDING' : 'NONE';

      const finalCustomerName = customerInfoPayload?.name || customerName || 'Walk-in Customer';
      const customerPhone = customerInfoPayload?.phone || '';

      const [saleResult] = await connection.execute(
        `INSERT INTO sales (user_id, scope_type, scope_id, invoice_no, subtotal, tax, discount, total, payment_method, payment_type, payment_status, payment_amount, credit_amount, old_balance, running_balance, status, customer_info, customer_name, customer_phone, notes, created_at, updated_at)
         VALUES (?, 'WAREHOUSE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, NOW(), NOW())`,
        [
          warehouseKeeperId,
          scopeIdForSale,
          invoiceNumber,
          subtotalAmount,
          taxAmountValue,
          discountAmountValue,
          billAmount,
          paymentMethodValue,
          paymentTypeValue,
          paymentStatusValue,
          paymentAmountValue,
          creditAmountValue,
          oldBalance, // ✅ Save old_balance
          runningBalance, // ✅ Save running_balance
          JSON.stringify({
            ...customerInfoPayload,
            creditStatus,
            runningBalance,
            outstandingPortion: outstandingPortion ?? (totalWithOutstanding - billAmount)
          }),
          finalCustomerName,
          customerPhone,
          notes
        ]
      );

      const saleId = saleResult.insertId;

      for (const item of normalizedItems) {
        await connection.execute(
          `INSERT INTO sale_items (sale_id, inventory_item_id, sku, name, quantity, unit_price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId,
            item.itemId,
            item.sku || '',
            item.name || '',
            item.quantity,
            item.unitPrice,
            item.discount || 0,
            item.totalPrice
          ]
        );

        if (item.itemId) {
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?',
            [item.quantity, item.itemId]
          );

          try {
            const [warehouseKeeperInfo] = await connection.execute(
              'SELECT username FROM users WHERE id = ?',
              [warehouseKeeperId]
            );

            const userName = warehouseKeeperInfo.length > 0
              ? warehouseKeeperInfo[0].username
              : 'Warehouse Keeper';

            // Pass the connection to ensure transaction consistency
            await createSaleTransaction(
              item.itemId,
              item.quantity,
              item.unitPrice,
              warehouseKeeperId,
              userName,
              'WAREHOUSE_KEEPER',
              saleId,
              connection
            );
          } catch (stockError) {
            console.error(`[WarehouseSale] Error creating stock transaction for item ${item.itemId}:`, stockError);
            console.error(`[WarehouseSale] Stock error stack:`, stockError.stack);
            throw stockError; // Re-throw to ensure transaction rollback
          }
        }
      }

      await connection.commit();

      if (outstandingPayments && outstandingPayments.length > 0) {
        try {
          const clearResponse = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/sales/clear-outstanding`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              outstandingPaymentIds: outstandingPayments,
              paymentAmount: paymentAmountValue,
              notes: `Cleared via warehouse sale ${invoiceNumber}`
            })
          });

          if (!clearResponse.ok) {
            console.error('[WarehouseSale] Failed to clear outstanding payments');
          }
        } catch (clearError) {
          console.error('[WarehouseSale] Error clearing outstanding payments:', clearError);
        }
      }

      try {
        await LedgerService.recordSaleTransaction({
          saleId,
          invoiceNo: invoiceNumber,
          scopeType: 'WAREHOUSE',
          scopeId: scopeIdForSale,
          totalAmount: billAmount,
          paymentAmount: paymentAmountValue,
          creditAmount: creditAmountValue,
          paymentMethod: paymentMethodValue,
          customerInfo: customerInfoPayload,
          userId: warehouseKeeperId,
          items: normalizedItems
        });
      } catch (ledgerError) {
        console.error('[WarehouseSale] Error recording sale in ledger:', ledgerError);
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
