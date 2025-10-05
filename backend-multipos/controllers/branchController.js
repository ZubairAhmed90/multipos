const { validationResult } = require('express-validator');
const Branch = require('../models/Branch');
const AdminSettings = require('../models/AdminSettings');
const POS = require('../models/POS');
const BranchLedger = require('../models/BranchLedger');
const InventoryItem = require('../models/InventoryItem');
const Customer = require('../models/Customer');
const CreditDebitTransaction = require('../models/CreditDebitTransaction');
const { executeQuery, pool } = require('../config/database');

// @desc    Get all branches
// @route   GET /api/branches
// @access  Private (Admin, Warehouse Keeper)
const getBranches = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    let whereConditions = [];
    let params = [];

    // Add search conditions
    if (search) {
      whereConditions.push('name LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total FROM branches ${whereClause}
    `, params);

    // Get branches with pagination
    const branches = await executeQuery(`
      SELECT * FROM branches
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

              // Transform field names to match frontend expectations
              const transformedBranches = branches.map(branch => ({
                id: branch.id,
                name: branch.name,
                code: branch.code,
                location: branch.location,
                phone: branch.phone,
                email: branch.email,
                managerName: branch.manager_name,
                managerPhone: branch.manager_phone,
                managerEmail: branch.manager_email,
                linkedWarehouseId: branch.linked_warehouse_id,
                status: branch.status,
                createdBy: branch.created_by,
                updatedBy: branch.updated_by,
                settings: branch.settings ? (typeof branch.settings === 'string' ? JSON.parse(branch.settings) : branch.settings) : {},
                created_at: branch.created_at,
                updated_at: branch.updated_at
              }));

    res.json({
      success: true,
      count: transformedBranches.length,
      total: countResult[0].total,
      page: parseInt(page),
      pages: Math.ceil(countResult[0].total / parseInt(limit)),
      data: transformedBranches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving branches',
      error: error.message
    });
  }
};

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private (Admin, Warehouse Keeper)
const getBranch = async (req, res, next) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findById(parseInt(id));
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving branch',
      error: error.message
    });
  }
};

// @desc    Create new branch
// @route   POST /api/branches
// @access  Private (Admin)
const createBranch = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    // Only admin can create branches
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create branches'
      });
    }

    const {
      name,
      code,
      location,
      phone,
      email,
      managerName,
      managerPhone,
      managerEmail,
      linkedWarehouseId,
      status,
      settings
    } = req.body;

    // Check if branch code already exists
    const existingBranch = await Branch.findByCode(code);
    if (existingBranch) {
      return res.status(400).json({
        success: false,
        message: 'Branch code already exists'
      });
    }

    const branchData = {
      name,
      code,
      location,
      phone: phone || null,
      email: email || null,
      managerName: managerName || null,
      managerPhone: managerPhone || null,
      managerEmail: managerEmail || null,
      linkedWarehouseId: linkedWarehouseId || null,
      status: status || 'active',
      settings: settings ? JSON.stringify(settings) : JSON.stringify({
        allowInventoryEdit: true,
        allowCreditSales: true,
        allowDebitSales: true,
        requireShiftValidation: true,
        autoProvisionPOS: true,
        autoProvisionInventory: true,
        autoProvisionLedger: true,
        autoProvisionCustomers: true
      }),
      createdBy: req.user.id
    };

    const branch = await Branch.create(branchData);

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: branch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating branch',
      error: error.message
    });
  }
};

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private (Admin)
const updateBranch = async (req, res, next) => {
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

    // Only admin can update branches
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update branches'
      });
    }

    const branch = await Branch.findById(parseInt(id));
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check if branch code is being changed and if it already exists
    if (updateData.code && updateData.code !== branch.code) {
      const existingBranch = await Branch.findByCode(updateData.code);
      if (existingBranch) {
        return res.status(400).json({
          success: false,
          message: 'Branch code already exists'
        });
      }
    }

    // Convert settings to JSON if provided
    if (updateData.settings) {
      updateData.settings = JSON.stringify(updateData.settings);
    }

    await Branch.updateOne({ id: parseInt(id) }, updateData);

    // Fetch the updated branch to return complete data
    const updatedBranch = await Branch.findById(parseInt(id));

    res.json({
      success: true,
      message: 'Branch updated successfully',
      data: updatedBranch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating branch',
      error: error.message
    });
  }
};

// @desc    Update branch settings only
// @route   PUT /api/branches/:id/settings
// @access  Private (Admin)
const updateBranchSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    // Only admin can update branch settings
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update branch settings'
      });
    }

    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    // Check if branch exists using direct database query
    const { executeQuery } = require('../config/database');
    const [branchRows] = await executeQuery('SELECT id FROM branches WHERE id = ?', [parseInt(id)]);
    
    if (branchRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Update only the settings field using direct database query
    await executeQuery('UPDATE branches SET settings = ? WHERE id = ?', [JSON.stringify(settings), parseInt(id)]);

    // Fetch the updated branch to return complete data
    let updatedBranch;
    try {
      const [updatedRows] = await executeQuery('SELECT * FROM branches WHERE id = ?', [parseInt(id)]);
      if (updatedRows.length > 0) {
        const branch = updatedRows[0];
        updatedBranch = {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          location: branch.location,
          address: branch.address,
          phone: branch.phone,
          email: branch.email,
          managerName: branch.manager_name,
          managerPhone: branch.manager_phone,
          managerEmail: branch.manager_email,
          linkedWarehouseId: branch.linked_warehouse_id,
          status: branch.status,
          createdBy: branch.created_by,
          updatedBy: branch.updated_by,
          settings: branch.settings ? (typeof branch.settings === 'string' ? JSON.parse(branch.settings) : branch.settings) : {},
          created_at: branch.created_at,
          updated_at: branch.updated_at
        };
      } else {
        // Fallback if we can't fetch the updated branch
        updatedBranch = {
          id: parseInt(id),
          settings: settings
        };
      }
    } catch (findError) {
      // If we can't fetch the updated branch, return success with the updated settings
      updatedBranch = {
        id: parseInt(id),
        settings: settings
      };
    }

    res.json({
      success: true,
      message: 'Branch settings updated successfully',
      data: updatedBranch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating branch settings',
      error: error.message
    });
  }
};

// @desc    Delete branch
// @route   DELETE /api/branches/:id
// @access  Private (Admin)
const deleteBranch = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only admin can delete branches
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete branches'
      });
    }

    const branch = await Branch.findById(parseInt(id));
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Check if branch has associated data
    const [inventoryCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM inventory_items WHERE scope_type = ? AND scope_id = ?',
      ['BRANCH', id]
    );

    const [salesCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM sales WHERE scope_type = ? AND scope_id = ?',
      ['BRANCH', id]
    );

    if (inventoryCount[0].count > 0 || salesCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete branch with associated inventory or sales data'
      });
    }

    await Branch.deleteOne({ id: parseInt(id) });

    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting branch',
      error: error.message
    });
  }
};

// @desc    Get branch statistics
// @route   GET /api/branches/:id/stats
// @access  Private (Admin, Warehouse Keeper)
const getBranchStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    // Get inventory count
    const [inventoryCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM inventory_items WHERE scope_type = ? AND scope_id = ?',
      ['BRANCH', id]
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
    `, ['BRANCH', id]);

    // Get users count
    const [usersCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE branch_id = ?',
      [id]
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
    `, ['BRANCH', id]);

    res.json({
      success: true,
      data: {
        branch,
        inventoryCount: inventoryCount[0].count,
        salesStats: salesStats[0],
        usersCount: usersCount[0].count,
        recentSales
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving branch statistics',
      error: error.message
    });
  }
};

// @desc    Get branch inventory
// @route   GET /api/branches/:id/inventory
// @access  Private (Admin, Warehouse Keeper)
const getBranchInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, lowStock } = req.query;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    let whereConditions = ['scope_type = ? AND scope_id = ?'];
    let params = ['BRANCH', id];

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
      message: 'Error retrieving branch inventory',
      error: error.message
    });
  }
};

// @desc    Get branch sales
// @route   GET /api/branches/:id/sales
// @access  Private (Admin, Warehouse Keeper)
const getBranchSales = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, paymentMethod } = req.query;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    let whereConditions = ['scope_type = ? AND scope_id = ?'];
    let params = ['BRANCH', id];

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
      message: 'Error retrieving branch sales',
      error: error.message
    });
  }
};

module.exports = {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  updateBranchSettings,
  deleteBranch,
  getBranchStats,
  getBranchInventory,
  getBranchSales
};