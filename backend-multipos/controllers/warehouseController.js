const { validationResult } = require('express-validator');
const Warehouse = require('../models/Warehouse');
const AdminSettings = require('../models/AdminSettings');
const InventoryItem = require('../models/InventoryItem');
const Customer = require('../models/Customer');
const CreditDebitTransaction = require('../models/CreditDebitTransaction');
const { executeQuery, pool } = require('../config/database');
const WarehouseInitializer = require('../services/warehouseInitializer');

// @desc    Get all warehouses
// @route   GET /api/warehouses
// @access  Private (Admin, Warehouse Keeper)
const getWarehouses = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    let whereConditions = [];
    let params = [];

    // Add role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see their assigned warehouse
      whereConditions.push('id = ?');
      params.push(req.user.warehouseId);
    }

    // Add search conditions
    if (search) {
      whereConditions.push('name LIKE ? OR code LIKE ?');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total FROM warehouses ${whereClause}
    `, params);

    // Get warehouses with pagination
    const warehouses = await executeQuery(`
      SELECT * FROM warehouses 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Transform field names to match frontend expectations
    const transformedWarehouses = warehouses.map(warehouse => ({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      location: warehouse.location,
      branchId: warehouse.branch_id,
      capacity: warehouse.capacity || 1000, // Default capacity if not set
      stock: warehouse.stock || 0, // Default stock if not set
      currentStock: warehouse.current_stock || 0, // Default current stock if not set
      manager: warehouse.manager || 'Not Assigned', // Default manager if not set
      status: warehouse.status || 'active', // Default status if not set
      createdAt: warehouse.created_at,
      updatedAt: warehouse.updated_at
    }));

    res.json({
      success: true,
      count: transformedWarehouses.length,
      total: countResult[0].total,
      page: parseInt(page),
      pages: Math.ceil(countResult[0].total / parseInt(limit)),
      data: transformedWarehouses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouses',
      error: error.message
    });
  }
};

// @desc    Get single warehouse
// @route   GET /api/warehouses/:id
// @access  Private (Admin, Warehouse Keeper)
const getWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    // Transform field names to match frontend expectations
    const transformedWarehouse = {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      location: warehouse.location,
      branchId: warehouse.branch_id,
      capacity: warehouse.capacity || 1000,
      stock: warehouse.stock || 0,
      currentStock: warehouse.current_stock || 0,
      manager: warehouse.manager || 'Not Assigned',
      status: warehouse.status || 'active',
      createdAt: warehouse.created_at,
      updatedAt: warehouse.updated_at
    };

    res.json({
      success: true,
      data: transformedWarehouse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse',
      error: error.message
    });
  }
};

// @desc    Create new warehouse
// @route   POST /api/warehouses
// @access  Private (Admin)
const createWarehouse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    // Only admin can create warehouses
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create warehouses'
      });
    }

    const {
      name,
      code,
      location,
      capacity,
      stock,
      manager,
      status,
      linkedBranchId,
      settings
    } = req.body;

    // Check if warehouse code already exists
    const existingWarehouse = await Warehouse.findByCode(code);
    if (existingWarehouse) {
      return res.status(400).json({
        success: false,
        message: 'Warehouse code already exists'
      });
    }

    const warehouseData = {
      name,
      code,
      location,
      branch_id: linkedBranchId || null,
      capacity: capacity || null,
      stock: stock || null,
      manager: manager || 'Not Assigned',
      status: status || 'active',
      settings: settings ? JSON.stringify(settings) : JSON.stringify({
        autoProvisionInventory: true,
        autoProvisionCreditDebit: true,
        allowRetailerSales: true,
        requireApprovalForSales: false,
        independentOperation: true,
        allowInventoryEdit: true,
        allowCompanyAdd: true,
        allowReturns: true,
        autoProvisionLedger: true,
        autoProvisionCustomers: true
      }),
      created_by: req.user.id
    };

    const warehouse = await Warehouse.create(warehouseData);

    // Initialize complete warehouse functionality automatically
    try {
      const initializer = new WarehouseInitializer(
        warehouse.id,
        name,
        req.user.id
      );
      
      const initResult = await initializer.initialize();

      res.status(201).json({
        success: true,
        message: 'Warehouse created and fully initialized with all functionality ready for warehouse keepers',
        data: warehouse,
        initialization: initResult,
        readyFeatures: [
          'Dashboard Analytics',
          'Company Management (Suppliers)',
          'Retailer Management (Customers)',
          'Warehouse Billing System',
          'Warehouse Ledger with Chart of Accounts',
          'Sales Analytics & Reporting',
          'Returns Management',
          'Inventory Management',
          'Transfer Management',
          'Comprehensive Reports'
        ]
      });
    } catch (initError) {
      
      // Still return success for warehouse creation, but note initialization issue
      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully, but some initialization steps failed',
        data: warehouse,
        warning: 'Manual setup may be required for some features',
        initializationError: initError.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating warehouse',
      error: error.message
    });
  }
};

// @desc    Update warehouse
// @route   PUT /api/warehouses/:id
// @access  Private (Admin)
const updateWarehouse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Only admin can update warehouses
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update warehouses'
      });
    }

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    // Check if warehouse code is being changed and if it already exists
    if (updateData.code && updateData.code !== warehouse.code) {
      const existingWarehouse = await Warehouse.findByCode(updateData.code);
      if (existingWarehouse) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse code already exists'
        });
      }
    }

    // Convert settings to JSON if provided
    if (updateData.settings) {
      updateData.settings = JSON.stringify(updateData.settings);
    }

    // Add updated_by field
    updateData.updatedBy = req.user.id;

    const updatedWarehouse = await Warehouse.update(id, updateData);

    res.json({
      success: true,
      message: 'Warehouse updated successfully',
      data: updatedWarehouse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating warehouse',
      error: error.message
    });
  }
};

// @desc    Delete warehouse
// @route   DELETE /api/warehouses/:id
// @access  Private (Admin)
const deleteWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only admin can delete warehouses
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete warehouses'
      });
    }

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    // Check if warehouse has associated data
    const [inventoryCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM inventory_items WHERE scope_type = ? AND scope_id = ?',
      ['WAREHOUSE', id]
    );

    const [salesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM sales WHERE scope_type = ? AND scope_id = ?',
      ['WAREHOUSE', id]
    );

    if (inventoryCount[0].count > 0 || salesCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete warehouse with associated inventory or sales data'
      });
    }

    await Warehouse.delete(id);

    res.json({
      success: true,
      message: 'Warehouse deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting warehouse',
      error: error.message
    });
  }
};

// @desc    Get warehouse statistics
// @route   GET /api/warehouses/:id/stats
// @access  Private (Admin, Warehouse Keeper)
const getWarehouseStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    // Get inventory count
    const [inventoryCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM inventory_items WHERE scope_type = ? AND scope_id = ?',
      ['WAREHOUSE', id]
    );

    // Get sales count and total
    const [salesStats] = await pool.execute(`
      SELECT 
        COUNT(*) as count,
        SUM(total) as totalSales,
        SUM(subtotal) as totalSubtotal,
        SUM(tax) as totalTax,
        SUM(discount) as totalDiscount
      FROM sales 
      WHERE scope_type = ? AND scope_id = ?
    `, ['WAREHOUSE', id]);

    // Get users count
    const [usersCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE warehouse_id = ?',
      [id]
    );

    // Get low stock items
    const [lowStockCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM inventory_items WHERE scope_type = ? AND scope_id = ? AND current_stock <= min_stock_level',
      ['WAREHOUSE', id]
    );

    // Get recent sales
    const [recentSales] = await pool.execute(`
      SELECT 
        s.*,
        u.username
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.scope_type = ? AND s.scope_id = ?
      ORDER BY s.created_at DESC
      LIMIT 5
    `, ['WAREHOUSE', id]);

    res.json({
      success: true,
      data: {
        warehouse,
        inventoryCount: inventoryCount[0].count,
        salesStats: salesStats[0],
        usersCount: usersCount[0].count,
        lowStockCount: lowStockCount[0].count,
        recentSales
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse statistics',
      error: error.message
    });
  }
};

// @desc    Get warehouse inventory
// @route   GET /api/warehouses/:id/inventory
// @access  Private (Admin, Warehouse Keeper)
const getWarehouseInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, lowStock } = req.query;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    let whereConditions = ['scope_type = ? AND scope_id = ?'];
    let params = ['WAREHOUSE', id];

    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }

    if (lowStock === 'true') {
      whereConditions.push('current_stock <= min_stock_level');
    }

    const whereClause = whereConditions.join(' AND ');

    const [inventoryItems] = await pool.execute(`
      SELECT * FROM inventory_items 
      WHERE ${whereClause}
      ORDER BY created_at DESC
    `, params);

    res.json({
      success: true,
      count: inventoryItems.length,
      data: inventoryItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse inventory',
      error: error.message
    });
  }
};

// @desc    Get warehouse sales
// @route   GET /api/warehouses/:id/sales
// @access  Private (Admin, Warehouse Keeper)
const getWarehouseSales = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, paymentMethod } = req.query;

    const warehouse = await Warehouse.findById(id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    let whereConditions = ['scope_type = ? AND scope_id = ?'];
    let params = ['WAREHOUSE', id];

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    if (paymentMethod) {
      whereConditions.push('payment_method = ?');
      params.push(paymentMethod);
    }

    const whereClause = whereConditions.join(' AND ');

    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        u.email
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
    `, params);

    res.json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse sales',
      error: error.message
    });
  }
};

module.exports = {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseStats,
  getWarehouseInventory,
  getWarehouseSales
};