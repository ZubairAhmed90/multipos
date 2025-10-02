const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

// @desc    Get all branches with their settings
// @route   GET /api/admin/branches
// @access  Private (Admin only)
const getAllBranches = async (req, res, next) => {
  try {
    const [branches] = await pool.execute(`
      SELECT 
        b.*,
        w.name as warehouse_name,
        w.code as warehouse_code
      FROM branches b
      LEFT JOIN warehouses w ON b.linked_warehouse_id = w.id
      ORDER BY b.created_at DESC
    `);
    
    res.json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving branches',
      error: error.message
    });
  }
};

// @desc    Update branch settings/permissions
// @route   PUT /api/admin/branches/:id/settings
// @access  Private (Admin only)
const updateBranchSettings = async (req, res, next) => {
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
    const settings = JSON.stringify(req.body);
    
    const [result] = await pool.execute(
      'UPDATE branches SET settings = ? WHERE id = ?',
      [settings, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Get updated branch
    const [branches] = await pool.execute(
      'SELECT * FROM branches WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: branches[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating branch settings',
      error: error.message
    });
  }
};

// @desc    Bulk update branch settings
// @route   PUT /api/admin/branches/bulk-settings
// @access  Private (Admin only)
const bulkUpdateBranchSettings = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { branchIds, settings } = req.body;
    
    if (!branchIds || !Array.isArray(branchIds) || branchIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Branch IDs array is required'
      });
    }
    
    const settingsJson = JSON.stringify(settings);
    const placeholders = branchIds.map(() => '?').join(',');
    
    const [result] = await pool.execute(
      `UPDATE branches SET settings = ? WHERE id IN (${placeholders})`,
      [settingsJson, ...branchIds]
    );
    
    res.json({
      success: true,
      message: `Updated ${result.affectedRows} branches`,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error bulk updating branch settings',
      error: error.message
    });
  }
};

// @desc    Get all inventories across all branches and warehouses
// @route   GET /api/admin/inventories
// @access  Private (Admin only)
const getAllInventories = async (req, res, next) => {
  try {
    const { scopeType, scopeId, category, lowStock } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (scopeType && scopeId) {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push(scopeType, scopeId);
    }
    
    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (lowStock === 'true') {
      whereConditions.push('current_stock <= min_stock_level');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [inventories] = await pool.execute(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `, params);
    
    res.json({
      success: true,
      count: inventories.length,
      data: inventories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventories',
      error: error.message
    });
  }
};

// @desc    Update any inventory item
// @route   PUT /api/admin/inventories/:id
// @access  Private (Admin only)
const updateAnyInventory = async (req, res, next) => {
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
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    values.push(id);
    
    const [result] = await pool.execute(
      `UPDATE inventory_items SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Get updated inventory item
    const [inventories] = await pool.execute(
      'SELECT * FROM inventory_items WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      data: inventories[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating inventory item',
      error: error.message
    });
  }
};

// @desc    Get all companies across all branches and warehouses
// @route   GET /api/admin/companies
// @access  Private (Admin only)
const getAllCompanies = async (req, res, next) => {
  try {
    const { scopeType, scopeId, transactionType } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (scopeType && scopeId) {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push(scopeType, scopeId);
    }
    
    if (transactionType) {
      whereConditions.push('transaction_type = ?');
      params.push(transactionType);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [companies] = await pool.execute(`
      SELECT 
        c.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM companies c
      LEFT JOIN branches b ON c.scope_type = 'BRANCH' AND c.scope_id = b.id
      LEFT JOIN warehouses w ON c.scope_type = 'WAREHOUSE' AND c.scope_id = w.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);
    
    res.json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving companies',
      error: error.message
    });
  }
};

// @desc    Get all sales across all branches
// @route   GET /api/admin/sales
// @access  Private (Admin only)
const getAllSales = async (req, res, next) => {
  try {
    const { scopeType, scopeId, startDate, endDate, paymentMethod } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (scopeType && scopeId) {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push(scopeType, scopeId);
    }
    
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
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        u.email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
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
      message: 'Error retrieving sales',
      error: error.message
    });
  }
};

// @desc    Get all ledgers across all branches
// @route   GET /api/admin/ledgers
// @access  Private (Admin only)
const getAllLedgers = async (req, res, next) => {
  try {
    // Since ledgers table doesn't exist, return empty data
    res.json({
      success: true,
      count: 0,
      data: [],
      message: 'Ledgers table not available'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving ledgers',
      error: error.message
    });
  }
};

// @desc    Get all users with their roles and permissions
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, branchId, warehouseId, status } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }
    
    if (branchId) {
      whereConditions.push('branch_id = ?');
      params.push(branchId);
    }
    
    if (warehouseId) {
      whereConditions.push('warehouse_id = ?');
      params.push(warehouseId);
    }
    
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [users] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.branch_id as branchId,
        u.warehouse_id as warehouseId,
        u.shift,
        u.status,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        b.name as branch_name,
        b.code as branch_code,
        w.name as warehouse_name,
        w.code as warehouse_code
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      ${whereClause}
      ORDER BY u.created_at DESC
    `, params);
    
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
};

// @desc    Update user role and permissions
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res, next) => {
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
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    
    // Map frontend field names to database field names
    const fieldMapping = {
      'branchId': 'branch_id',
      'warehouseId': 'warehouse_id'
    };
    
    // Define allowed database fields that can be updated
    const allowedFields = [
      'username', 'email', 'role', 'branch_id', 'warehouse_id', 'shift', 'status'
    ];
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'password') {
        const dbFieldName = fieldMapping[key] || key;
        
        // Only include fields that exist in the database
        if (allowedFields.includes(dbFieldName)) {
          updateFields.push(`${dbFieldName} = ?`);
          values.push(updateData[key]);
        }
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    values.push(id);
    
    const [result] = await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Handle shift assignment if shift, branchId, or warehouseId is being updated
    if (updateData.shift || updateData.branchId || updateData.warehouseId) {
      try {
        // First, remove user from existing shifts
        await pool.execute('UPDATE shifts SET user_id = NULL WHERE user_id = ?', [id]);
        
        // Create new shift assignment if user has branch/warehouse and shift
        const branchId = updateData.branchId;
        const warehouseId = updateData.warehouseId;
        const shift = updateData.shift;
        
        if ((branchId || warehouseId) && shift) {
          let scopeType, scopeId, shiftName;
          
          if (branchId) {
            scopeType = 'BRANCH';
            scopeId = branchId;
            // Get branch name for shift name
            const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchId]);
            const branchName = branches[0]?.name || 'Unknown Branch';
            shiftName = `${shift} Shift - ${branchName}`;
          } else if (warehouseId) {
            scopeType = 'WAREHOUSE';
            scopeId = warehouseId;
            // Get warehouse name for shift name
            const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseId]);
            const warehouseName = warehouses[0]?.name || 'Unknown Warehouse';
            shiftName = `${shift} Shift - ${warehouseName}`;
          }

          // Ensure created_by is valid (fallback to user being updated if req.user.id is undefined)
          const createdBy = req.user?.id || id;
          
          // Create shift and assign user
          await pool.execute(
            `INSERT INTO shifts (name, start_time, end_time, scope_type, scope_id, user_id, is_active, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
            [
              shiftName,
              shift === 'MORNING' ? '08:00:00' : shift === 'AFTERNOON' ? '12:00:00' : '20:00:00',
              shift === 'MORNING' ? '16:00:00' : shift === 'AFTERNOON' ? '20:00:00' : '08:00:00',
              scopeType,
              scopeId,
              id,
              createdBy
            ]
          );
        }
      } catch (shiftError) {
        // Don't fail the entire update if shift assignment fails
        // Just log the error and continue
      }
    }
    
    // Get updated user
    const [users] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.branch_id as branchId,
        u.warehouse_id as warehouseId,
        u.shift,
        u.status,
        u.created_at as createdAt,
        u.updated_at as updatedAt,
        b.name as branch_name,
        w.name as warehouse_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      WHERE u.id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// @desc    Get system-wide dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getSystemDashboard = async (req, res, next) => {
  try {
    // Get system statistics
    const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
    const [branchCount] = await pool.execute('SELECT COUNT(*) as count FROM branches');
    const [warehouseCount] = await pool.execute('SELECT COUNT(*) as count FROM warehouses');
    const [inventoryCount] = await pool.execute('SELECT COUNT(*) as count FROM inventory_items');
    const [salesCount] = await pool.execute('SELECT COUNT(*) as count FROM sales');
    const [companyCount] = await pool.execute('SELECT COUNT(*) as count FROM companies');
    
    // Get recent activity
    const [recentSales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        b.name as branch_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      ORDER BY s.created_at DESC
      LIMIT 10
    `);
    
    // Get low stock items
    const [lowStockItems] = await pool.execute(`
      SELECT 
        i.*,
        b.name as branch_name,
        w.name as warehouse_name
      FROM inventory_items i
      LEFT JOIN branches b ON i.scope_type = 'BRANCH' AND i.scope_id = b.id
      LEFT JOIN warehouses w ON i.scope_type = 'WAREHOUSE' AND i.scope_id = w.id
      WHERE i.current_stock <= i.min_stock_level
      ORDER BY i.current_stock ASC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        statistics: {
          users: userCount[0].count,
          branches: branchCount[0].count,
          warehouses: warehouseCount[0].count,
          inventoryItems: inventoryCount[0].count,
          sales: salesCount[0].count,
          companies: companyCount[0].count
        },
        recentSales,
        lowStockItems
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving system dashboard',
      error: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Prevent deletion of the last admin user
    if (user.role === 'ADMIN') {
      const [adminCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM users WHERE role = ?',
        ['ADMIN']
      );

      if (adminCount[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin user'
        });
      }
    }

    // Delete the user
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// @desc    Create a new user
// @route   POST /api/admin/users
// @access  Private (Admin only)
const createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { username, email, password, role, branchId, warehouseId, shift } = req.body;

    // Check if user already exists
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, role, branch_id, warehouse_id, shift, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())`,
      [username, email, hashedPassword, role, branchId || null, warehouseId || null, shift || null]
    );

    const userId = result.insertId;

    // Create and assign shift if user has branch or warehouse assignment
    if ((branchId || warehouseId) && shift) {
      let scopeType, scopeId, shiftName;
      
      if (branchId) {
        scopeType = 'BRANCH';
        scopeId = branchId;
        // Get branch name for shift name
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchId]);
        const branchName = branches[0]?.name || 'Unknown Branch';
        shiftName = `${shift} Shift - ${branchName}`;
      } else if (warehouseId) {
        scopeType = 'WAREHOUSE';
        scopeId = warehouseId;
        // Get warehouse name for shift name
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseId]);
        const warehouseName = warehouses[0]?.name || 'Unknown Warehouse';
        shiftName = `${shift} Shift - ${warehouseName}`;
      }

      // Create shift and assign user
      await pool.execute(
        `INSERT INTO shifts (name, start_time, end_time, scope_type, scope_id, user_id, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
        [
          shiftName,
          shift === 'MORNING' ? '08:00:00' : shift === 'AFTERNOON' ? '12:00:00' : '20:00:00',
          shift === 'MORNING' ? '16:00:00' : shift === 'AFTERNOON' ? '20:00:00' : '08:00:00',
          scopeType,
          scopeId,
          userId,
          req.user.id // created_by (admin who created the user)
        ]
      );
    }

    // Get created user with branch/warehouse names
    const [users] = await pool.execute(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.branch_id,
        u.warehouse_id,
        u.shift,
        u.status,
        u.created_at,
        u.updated_at,
        b.name as branch_name,
        w.name as warehouse_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      WHERE u.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: users[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

module.exports = {
  getAllBranches,
  updateBranchSettings,
  bulkUpdateBranchSettings,
  getAllInventories,
  updateAnyInventory,
  getAllCompanies,
  getAllSales,
  getAllLedgers,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getSystemDashboard
};