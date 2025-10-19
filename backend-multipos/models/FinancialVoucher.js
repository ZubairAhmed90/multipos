const { pool } = require('../config/database');

class FinancialVoucher {
  constructor(data) {
    this.id = data.id;
    this.voucherNo = data.voucher_no;
    this.type = data.type; // 'INCOME', 'EXPENSE', 'TRANSFER'
    this.category = data.category; // 'SALES', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'
    this.paymentMethod = data.payment_method; // 'CASH', 'BANK', 'MOBILE', 'CARD'
    this.amount = data.amount;
    this.description = data.description;
    this.reference = data.reference; // Invoice number, expense reference, etc.
    this.scopeType = data.scope_type; // 'BRANCH', 'WAREHOUSE'
    this.scopeId = data.scope_id; // Branch/Warehouse ID
    this.userId = data.user_id;
    this.userName = data.user_name;
    this.userRole = data.user_role;
    this.status = data.status; // 'PENDING', 'APPROVED', 'REJECTED'
    this.approvedBy = data.approved_by;
    this.approvedAt = data.approved_at;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static method to create a new financial voucher
  static async create(voucherData) {
    const {
      voucherNo, type, category, paymentMethod, amount, description, reference,
      scopeType, scopeId, userId, userName, userRole, status = 'PENDING',
      approvedBy, notes
    } = voucherData;

    const result = await pool.execute(
      `INSERT INTO financial_vouchers (
        voucher_no, type, category, payment_method, amount, description, reference,
        scope_type, scope_id, user_id, user_name, user_role, status,
        approved_by, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        voucherNo, type, category, paymentMethod, amount, description, reference,
        scopeType, scopeId, userId, userName, userRole, status,
        approvedBy, notes
      ]
    );

    const lastId = result[0].insertId;
    return await FinancialVoucher.findById(lastId);
  }

  // Static method to find voucher by ID
  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM financial_vouchers WHERE id = ?',
        [id]
      );

      if (rows.length === 0) return null;
      return new FinancialVoucher(rows[0]);
    } catch (error) {
      console.error('Error in FinancialVoucher.findById:', error);
      throw error;
    }
  }

  // Static method to find vouchers with filters
  static async find(filters = {}) {
    try {
      let query = 'SELECT * FROM financial_vouchers WHERE 1=1';
      const params = [];

      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters.paymentMethod) {
        query += ' AND payment_method = ?';
        params.push(filters.paymentMethod);
      }

      if (filters.scopeType) {
        query += ' AND scope_type = ?';
        params.push(filters.scopeType);
      }

      if (filters.scopeId) {
        query += ' AND scope_id = ?';
        params.push(filters.scopeId);
      }

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.userId) {
        query += ' AND user_id = ?';
        params.push(filters.userId);
      }

      if (filters.dateFrom) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.dateTo);
      }

      if (filters.search) {
        query += ' AND (voucher_no LIKE ? OR description LIKE ? OR reference LIKE ? OR user_name LIKE ?)';
        const searchPattern = `%${filters.search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const [rows] = await pool.execute(query, params);
      return rows.map(row => new FinancialVoucher(row));
    } catch (error) {
      console.error('Error in FinancialVoucher.find:', error);
      throw error;
    }
  }

  // Static method to get financial summary
  static async getFinancialSummary(filters = {}) {
    try {
      let query = `
        SELECT 
          type,
          category,
          payment_method,
          scope_type,
          scope_id,
          SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END) as total_transfer,
          COUNT(*) as transaction_count
        FROM financial_vouchers 
        WHERE status = 'APPROVED'
      `;
      const params = [];

      if (filters.dateFrom) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.dateTo);
      }

      if (filters.scopeType) {
        query += ' AND scope_type = ?';
        params.push(filters.scopeType);
      }

      if (filters.scopeId) {
        query += ' AND scope_id = ?';
        params.push(filters.scopeId);
      }

      query += ' GROUP BY type, category, payment_method, scope_type, scope_id ORDER BY created_at DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in FinancialVoucher.getFinancialSummary:', error);
      throw error;
    }
  }

  // Static method to get daily financial summary
  static async getDailySummary(filters = {}) {
    try {
      let query = `
        SELECT 
          DATE(created_at) as date,
          scope_type,
          scope_id,
          payment_method,
          SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END) as total_transfer,
          COUNT(*) as transaction_count
        FROM financial_vouchers 
        WHERE status = 'APPROVED'
      `;
      const params = [];

      if (filters.dateFrom) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.dateTo);
      }

      if (filters.scopeType) {
        query += ' AND scope_type = ?';
        params.push(filters.scopeType);
      }

      if (filters.scopeId) {
        query += ' AND scope_id = ?';
        params.push(filters.scopeId);
      }

      query += ' GROUP BY DATE(created_at), scope_type, scope_id, payment_method ORDER BY date DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in FinancialVoucher.getDailySummary:', error);
      throw error;
    }
  }

  // Static method to get payment method summary
  static async getPaymentMethodSummary(filters = {}) {
    try {
      let query = `
        SELECT 
          payment_method,
          SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END) as total_transfer,
          COUNT(*) as transaction_count
        FROM financial_vouchers 
        WHERE status = 'APPROVED'
      `;
      const params = [];

      if (filters.dateFrom) {
        query += ' AND DATE(created_at) >= ?';
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        query += ' AND DATE(created_at) <= ?';
        params.push(filters.dateTo);
      }

      if (filters.scopeType) {
        query += ' AND scope_type = ?';
        params.push(filters.scopeType);
      }

      if (filters.scopeId) {
        query += ' AND scope_id = ?';
        params.push(filters.scopeId);
      }

      query += ' GROUP BY payment_method ORDER BY total_income DESC';

      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in FinancialVoucher.getPaymentMethodSummary:', error);
      throw error;
    }
  }

  // Instance method to update voucher
  async update(updateData) {
    const allowedFields = [
      'type', 'category', 'payment_method', 'amount', 'description', 'reference',
      'scope_type', 'scope_id', 'status', 'approved_by', 'notes'
    ];

    const updateFields = [];
    const updateValues = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      return this;
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(this.id);

    await pool.execute(
      `UPDATE financial_vouchers SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    return await FinancialVoucher.findById(this.id);
  }

  // Instance method to approve voucher
  async approve(approvedBy) {
    return await this.update({
      status: 'APPROVED',
      approved_by: approvedBy,
      approved_at: new Date()
    });
  }

  // Instance method to reject voucher
  async reject(approvedBy, notes = '') {
    return await this.update({
      status: 'REJECTED',
      approved_by: approvedBy,
      notes: notes
    });
  }

  // Static method to delete voucher
  static async delete(id) {
    await pool.execute('DELETE FROM financial_vouchers WHERE id = ?', [id]);
    return { deletedCount: 1 };
  }

  // Static method to generate voucher number
  static async generateVoucherNo(type) {
    const prefix = type === 'INCOME' ? 'INC' : type === 'EXPENSE' ? 'EXP' : 'TRF';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM financial_vouchers WHERE voucher_no LIKE ?',
      [`${prefix}${date}%`]
    );
    
    const count = rows[0].count + 1;
    return `${prefix}${date}${count.toString().padStart(4, '0')}`;
  }
}

module.exports = FinancialVoucher;




