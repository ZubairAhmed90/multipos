const { validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const CreditDebitTransaction = require('../models/CreditDebitTransaction');

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private (Cashier, Warehouse Keeper, Admin)
const createCustomer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const customerData = {
      ...req.body,
      branchId: req.user.branchId,
      warehouseId: req.user.warehouseId
    };

    const customer = await Customer.create(customerData);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private (Cashier, Warehouse Keeper, Admin)
const getCustomers = async (req, res, next) => {
  try {
    const {
      status = 'ACTIVE',
      customerType,
      search,
      hasBalance,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      status,
      customerType,
      search,
      hasBalance: hasBalance === 'true',
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // If user is not admin, filter by their branch/warehouse
    if (req.user.role !== 'ADMIN') {
      if (req.user.branchId) filters.branchId = req.user.branchId;
      if (req.user.warehouseId) filters.warehouseId = req.user.warehouseId;
    }

    const customers = await Customer.findAll(filters);

    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private (Cashier, Warehouse Keeper, Admin)
const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if user can access this customer
    if (req.user.role !== 'ADMIN') {
      if (req.user.branchId && customer.branchId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this customer'
        });
      }
      if (req.user.warehouseId && customer.warehouseId !== req.user.warehouseId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this customer'
        });
      }
    }

    // Get customer transaction summary
    const balanceSummary = await CreditDebitTransaction.getCustomerBalanceSummary(customer.id);

    res.json({
      success: true,
      data: {
        ...customer,
        balanceSummary
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (Cashier, Warehouse Keeper, Admin)
const updateCustomer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if user can update this customer
    if (req.user.role !== 'ADMIN') {
      if (req.user.branchId && customer.branchId !== req.user.branchId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this customer'
        });
      }
    }

    const updatedCustomer = await customer.update(req.body);

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private (Admin only)
const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await customer.delete();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer transactions
// @route   GET /api/customers/:id/transactions
// @access  Private (Cashier, Warehouse Keeper, Admin)
const getCustomerTransactions = async (req, res, next) => {
  try {
    const {
      transactionType,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      customerId: req.params.id,
      transactionType,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // If user is not admin, filter by their branch/warehouse
    if (req.user.role !== 'ADMIN') {
      if (req.user.branchId) filters.branchId = req.user.branchId;
      if (req.user.warehouseId) filters.warehouseId = req.user.warehouseId;
    }

    const transactions = await CreditDebitTransaction.findAll(filters);

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTransactions
};
