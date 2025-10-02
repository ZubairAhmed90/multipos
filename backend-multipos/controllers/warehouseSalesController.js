const { validationResult } = require('express-validator');
const WarehouseSale = require('../models/WarehouseSale');
const Sale = require('../models/Sale');
const Retailer = require('../models/Retailer');
const InventoryItem = require('../models/InventoryItem');

// @desc    Create warehouse sale to retailer
// @route   POST /api/warehouse-sales
// @access  Private (Warehouse Keeper, Admin)
const createWarehouseSale = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const {
      retailerId,
      items,
      totalAmount,
      taxAmount = 0,
      discountAmount = 0,
      finalAmount,
      paymentMethod = 'CASH',
      paymentTerms,
      notes
    } = req.body;


    // Verify retailer exists (retailers are now the customers)
    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    // Verify all items exist and have sufficient stock
    for (const item of items) {
      const inventoryItem = await InventoryItem.findById(item.itemId);
      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: `Inventory item with ID ${item.itemId} not found`
        });
      }

      if (inventoryItem.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`
        });
      }
    }

    // Create warehouse sale
    const saleData = {
      retailerId,
      warehouseKeeperId: req.user.id,
      items,
      totalAmount,
      taxAmount,
      discountAmount,
      finalAmount,
      paymentMethod,
      notes
    };

    // Get the actual retailer name from database
    const actualCustomerName = retailer.name || `Retailer ${retailerId}`;

    const warehouseSale = await WarehouseSale.create(saleData, actualCustomerName, paymentMethod, paymentTerms);

    // WarehouseSale.create already creates the sales table record with correct data
    

    res.status(201).json({
      success: true,
      message: 'Warehouse sale created successfully',
      data: warehouseSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all warehouse sales
// @route   GET /api/warehouse-sales
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSales = async (req, res, next) => {
  try {
    const {
      retailerId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      retailerId,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // If user is warehouse keeper, filter by their sales
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      filters.warehouseKeeperId = req.user.id;
    }

    const sales = await WarehouseSale.findAll(filters);

    res.json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single warehouse sale
// @route   GET /api/warehouse-sales/:id
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSale = async (req, res, next) => {
  try {
    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    // Check if user can access this sale
    if (req.user.role === 'WAREHOUSE_KEEPER' && sale.warehouseKeeperId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this warehouse sale'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update warehouse sale
// @route   PUT /api/warehouse-sales/:id
// @access  Private (Admin only)
const updateWarehouseSale = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    const updatedSale = await sale.update(req.body);

    res.json({
      success: true,
      message: 'Warehouse sale updated successfully',
      data: updatedSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete warehouse sale
// @route   DELETE /api/warehouse-sales/:id
// @access  Private (Admin only)
const deleteWarehouseSale = async (req, res, next) => {
  try {
    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    await sale.delete();

    res.json({
      success: true,
      message: 'Warehouse sale deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get warehouse sales summary
// @route   GET /api/warehouse-sales/summary
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // This would need to be implemented with proper SQL queries
    // For now, returning a basic structure
    res.json({
      success: true,
      data: {
        totalSales: 0,
        totalRevenue: 0,
        totalRetailers: 0,
        averageOrderValue: 0,
        topSellingItems: [],
        salesByRetailer: []
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarehouseSale,
  getWarehouseSales,
  getWarehouseSale,
  updateWarehouseSale,
  deleteWarehouseSale,
  getWarehouseSalesSummary
};
