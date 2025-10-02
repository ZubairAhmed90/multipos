const { validationResult } = require('express-validator');
const Retailer = require('../models/Retailer');

// @desc    Create new retailer
// @route   POST /api/retailers
// @access  Private (Warehouse Keeper, Admin)
const createRetailer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const retailer = await Retailer.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Retailer created successfully',
      data: retailer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all retailers
// @route   GET /api/retailers
// @access  Private (Warehouse Keeper, Admin)
const getRetailers = async (req, res, next) => {
  try {
    const {
      status = 'ACTIVE',
      search,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      status,
      search,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    const retailers = await Retailer.findAll(filters);

    res.json({
      success: true,
      count: retailers.length,
      data: retailers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single retailer
// @route   GET /api/retailers/:id
// @access  Private (Warehouse Keeper, Admin)
const getRetailer = async (req, res, next) => {
  try {
    const retailer = await Retailer.findById(req.params.id);

    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    res.json({
      success: true,
      data: retailer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update retailer
// @route   PUT /api/retailers/:id
// @access  Private (Warehouse Keeper, Admin)
const updateRetailer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const retailer = await Retailer.findById(req.params.id);

    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    const updatedRetailer = await retailer.update(req.body);

    res.json({
      success: true,
      message: 'Retailer updated successfully',
      data: updatedRetailer
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete retailer
// @route   DELETE /api/retailers/:id
// @access  Private (Admin only)
const deleteRetailer = async (req, res, next) => {
  try {
    const retailer = await Retailer.findById(req.params.id);

    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    await retailer.delete();

    res.json({
      success: true,
      message: 'Retailer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRetailer,
  getRetailers,
  getRetailer,
  updateRetailer,
  deleteRetailer
};
