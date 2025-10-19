const FinancialVoucher = require('../models/FinancialVoucher');
const { pool } = require('../config/database');

// Get all financial vouchers with filters
const getFinancialVouchers = async (req, res) => {
  try {
    const {
      type, category, paymentMethod, scopeType, scopeId, status, userId,
      dateFrom, dateTo, search, page = 1, limit = 25
    } = req.query;

    // Build filters object
    const filters = {};
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (scopeType) filters.scopeType = scopeType;
    if (scopeId) filters.scopeId = scopeId;
    if (status) filters.status = status;
    if (userId) filters.userId = userId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (search) filters.search = search;

    // Add pagination
    const offset = (page - 1) * limit;
    filters.limit = parseInt(limit);
    filters.offset = offset;

    const vouchers = await FinancialVoucher.find(filters);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM financial_vouchers WHERE 1=1';
    const countParams = [];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (category) {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    if (paymentMethod) {
      countQuery += ' AND payment_method = ?';
      countParams.push(paymentMethod);
    }
    if (scopeType) {
      countQuery += ' AND scope_type = ?';
      countParams.push(scopeType);
    }
    if (scopeId) {
      countQuery += ' AND scope_id = ?';
      countParams.push(scopeId);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }
    if (dateFrom) {
      countQuery += ' AND DATE(created_at) >= ?';
      countParams.push(dateFrom);
    }
    if (dateTo) {
      countQuery += ' AND DATE(created_at) <= ?';
      countParams.push(dateTo);
    }
    if (search) {
      countQuery += ' AND (voucher_no LIKE ? OR description LIKE ? OR reference LIKE ? OR user_name LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: vouchers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in getFinancialVouchers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial vouchers',
      error: error.message
    });
  }
};

// Get financial voucher by ID
const getFinancialVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await FinancialVoucher.findById(id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Financial voucher not found'
      });
    }

    res.json({
      success: true,
      data: voucher
    });
  } catch (error) {
    console.error('Error in getFinancialVoucherById:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial voucher',
      error: error.message
    });
  }
};

// Create new financial voucher
const createFinancialVoucher = async (req, res) => {
  try {
    const {
      type, category, paymentMethod, amount, description, reference,
      scopeType, scopeId, notes
    } = req.body;

    // Validate required fields
    if (!type || !category || !paymentMethod || !amount || !scopeType || !scopeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: type, category, paymentMethod, amount, scopeType, scopeId'
      });
    }

    // Generate voucher number
    const voucherNo = await FinancialVoucher.generateVoucherNo(type);

    // Create voucher data
    const voucherData = {
      voucherNo,
      type,
      category,
      paymentMethod,
      amount: parseFloat(amount),
      description: description || '',
      reference: reference || '',
      scopeType,
      scopeId,
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      notes: notes || ''
    };

    const voucher = await FinancialVoucher.create(voucherData);

    res.status(201).json({
      success: true,
      message: 'Financial voucher created successfully',
      data: voucher
    });
  } catch (error) {
    console.error('Error in createFinancialVoucher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create financial voucher',
      error: error.message
    });
  }
};

// Update financial voucher
const updateFinancialVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const voucher = await FinancialVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Financial voucher not found'
      });
    }

    const updatedVoucher = await voucher.update(updateData);

    res.json({
      success: true,
      message: 'Financial voucher updated successfully',
      data: updatedVoucher
    });
  } catch (error) {
    console.error('Error in updateFinancialVoucher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update financial voucher',
      error: error.message
    });
  }
};

// Approve financial voucher
const approveFinancialVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await FinancialVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Financial voucher not found'
      });
    }

    const approvedVoucher = await voucher.approve(req.user.id);

    res.json({
      success: true,
      message: 'Financial voucher approved successfully',
      data: approvedVoucher
    });
  } catch (error) {
    console.error('Error in approveFinancialVoucher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve financial voucher',
      error: error.message
    });
  }
};

// Reject financial voucher
const rejectFinancialVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const voucher = await FinancialVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Financial voucher not found'
      });
    }

    const rejectedVoucher = await voucher.reject(req.user.id, notes);

    res.json({
      success: true,
      message: 'Financial voucher rejected successfully',
      data: rejectedVoucher
    });
  } catch (error) {
    console.error('Error in rejectFinancialVoucher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject financial voucher',
      error: error.message
    });
  }
};

// Delete financial voucher
const deleteFinancialVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await FinancialVoucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Financial voucher not found'
      });
    }

    await FinancialVoucher.delete(id);

    res.json({
      success: true,
      message: 'Financial voucher deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteFinancialVoucher:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete financial voucher',
      error: error.message
    });
  }
};

// Get financial summary
const getFinancialSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo, scopeType, scopeId } = req.query;

    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (scopeType) filters.scopeType = scopeType;
    if (scopeId) filters.scopeId = scopeId;

    const summary = await FinancialVoucher.getFinancialSummary(filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error in getFinancialSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial summary',
      error: error.message
    });
  }
};

// Get daily financial summary
const getDailySummary = async (req, res) => {
  try {
    const { dateFrom, dateTo, scopeType, scopeId } = req.query;

    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (scopeType) filters.scopeType = scopeType;
    if (scopeId) filters.scopeId = scopeId;

    const summary = await FinancialVoucher.getDailySummary(filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error in getDailySummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily summary',
      error: error.message
    });
  }
};

// Get payment method summary
const getPaymentMethodSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo, scopeType, scopeId } = req.query;

    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (scopeType) filters.scopeType = scopeType;
    if (scopeId) filters.scopeId = scopeId;

    const summary = await FinancialVoucher.getPaymentMethodSummary(filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error in getPaymentMethodSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment method summary',
      error: error.message
    });
  }
};

// Get financial accounts and balances
const getFinancialAccounts = async (req, res) => {
  try {
    const { scopeType, scopeId } = req.query;

    let query = 'SELECT * FROM financial_accounts WHERE is_active = TRUE';
    const params = [];

    if (scopeType) {
      query += ' AND scope_type = ?';
      params.push(scopeType);
    }

    if (scopeId) {
      query += ' AND scope_id = ?';
      params.push(scopeId);
    }

    query += ' ORDER BY scope_type, scope_id, account_type';

    const [accounts] = await pool.execute(query, params);

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error in getFinancialAccounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch financial accounts',
      error: error.message
    });
  }
};

// Update financial account balance
const updateAccountBalance = async (req, res) => {
  try {
    const { id } = req.params;
    const { balance } = req.body;

    if (balance === undefined || balance === null) {
      return res.status(400).json({
        success: false,
        message: 'Balance is required'
      });
    }

    await pool.execute(
      'UPDATE financial_accounts SET current_balance = ?, last_updated = NOW() WHERE id = ?',
      [parseFloat(balance), id]
    );

    const [updatedAccount] = await pool.execute(
      'SELECT * FROM financial_accounts WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Account balance updated successfully',
      data: updatedAccount[0]
    });
  } catch (error) {
    console.error('Error in updateAccountBalance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update account balance',
      error: error.message
    });
  }
};

// Create financial account
const createFinancialAccount = async (req, res) => {
  try {
    const {
      accountName, accountType, scopeType, scopeId, initialBalance = 0
    } = req.body;

    if (!accountName || !accountType || !scopeType || !scopeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: accountName, accountType, scopeType, scopeId'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO financial_accounts (account_name, account_type, scope_type, scope_id, current_balance, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [accountName, accountType, scopeType, scopeId, parseFloat(initialBalance)]
    );

    const [newAccount] = await pool.execute(
      'SELECT * FROM financial_accounts WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Financial account created successfully',
      data: newAccount[0]
    });
  } catch (error) {
    console.error('Error in createFinancialAccount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create financial account',
      error: error.message
    });
  }
};

module.exports = {
  getFinancialVouchers,
  getFinancialVoucherById,
  createFinancialVoucher,
  updateFinancialVoucher,
  approveFinancialVoucher,
  rejectFinancialVoucher,
  deleteFinancialVoucher,
  getFinancialSummary,
  getDailySummary,
  getPaymentMethodSummary,
  getFinancialAccounts,
  updateAccountBalance,
  createFinancialAccount
};



