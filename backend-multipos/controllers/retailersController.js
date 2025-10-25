const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

// @desc    Get all retailers
// @route   GET /api/retailers
// @access  Private (Admin, Warehouse Keeper)
const getRetailers = async (req, res) => {
  try {
    const { status, businessType, paymentTerms, warehouseId } = req.query;
    
    console.log('[Retailers Controller] Request params:', { status, businessType, paymentTerms, warehouseId })
    console.log('[Retailers Controller] User:', { role: req.user.role, warehouseId: req.user.warehouseId })
    
    let whereConditions = [];
    let params = [];
    
    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see retailers in their warehouse
      // Use query parameter warehouseId if provided, otherwise use user's warehouseId
      const targetWarehouseId = warehouseId || req.user.warehouseId;
      console.log('[Retailers Controller] Target warehouse ID:', targetWarehouseId)
      whereConditions.push('warehouse_id = ?');
      params.push(targetWarehouseId);
    } else if (req.user.role === 'CASHIER') {
      // Cashiers don't have access to retailers (they use companies)
      return res.status(403).json({
        success: false,
        message: 'Cashiers do not have access to retailers'
      });
    } else if (req.user.role === 'ADMIN' && warehouseId) {
      // Admin can filter by specific warehouse if requested
      console.log('[Retailers Controller] Admin filtering by warehouse:', warehouseId)
      whereConditions.push('warehouse_id = ?');
      params.push(warehouseId);
    }
    // Admins without warehouseId filter can see all retailers
    
    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (businessType) {
      whereConditions.push('business_type = ?');
      params.push(businessType);
    }
    
    if (paymentTerms) {
      whereConditions.push('payment_terms = ?');
      params.push(paymentTerms);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    console.log('[Retailers Controller] Final query:', `SELECT * FROM retailers ${whereClause} ORDER BY name ASC`)
    console.log('[Retailers Controller] Query params:', params)
    
    const [retailers] = await pool.execute(`
      SELECT * FROM retailers 
      ${whereClause}
      ORDER BY name ASC
    `, params);
    
    console.log('[Retailers Controller] Found retailers:', retailers.length)
    console.log('[Retailers Controller] Retailers data:', retailers)
    
    res.json({
      success: true,
      count: retailers.length,
      data: retailers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving retailers',
      error: error.message
    });
  }
};

// @desc    Get single retailer
// @route   GET /api/retailers/:id
// @access  Private (Admin, Warehouse Keeper)
const getRetailer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [retailers] = await pool.execute(
      'SELECT * FROM retailers WHERE id = ?',
      [id]
    );
    
    if (retailers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }
    
    res.json({
      success: true,
      data: retailers[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving retailer',
      error: error.message
    });
  }
};

// @desc    Create new retailer
// @route   POST /api/retailers
// @access  Private (Admin, Warehouse Keeper)
const createRetailer = async (req, res) => {
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
      name,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      businessType,
      taxId,
      creditLimit = 0,
      paymentTerms = 'CASH',
      status = 'ACTIVE',
      notes
    } = req.body;

    // Determine warehouse_id based on user role
    let warehouseId = null;
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      warehouseId = req.user.warehouseId;
    } else if (req.user.role === 'ADMIN') {
      // Admin can specify warehouse_id in request body, default to null (global)
      warehouseId = req.body.warehouseId || null;
    }

    const [result] = await pool.execute(`
      INSERT INTO retailers (
        warehouse_id, name, email, phone, address, city, state, zip_code, 
        business_type, tax_id, credit_limit, payment_terms, 
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      warehouseId, name, email, phone, address, city, state, zipCode,
      businessType, taxId, creditLimit, paymentTerms,
      status, notes
    ]);

    // Get the created retailer
    const [retailers] = await pool.execute(
      'SELECT * FROM retailers WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Retailer created successfully',
      data: retailers[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating retailer',
      error: error.message
    });
  }
};

// @desc    Update retailer
// @route   PUT /api/retailers/:id
// @access  Private (Admin, Warehouse Keeper)
const updateRetailer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      businessType,
      taxId,
      creditLimit,
      paymentTerms,
      status,
      notes
    } = req.body;

    // Check if retailer exists
    const [existing] = await pool.execute(
      'SELECT * FROM retailers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (address !== undefined) {
      updateFields.push('address = ?');
      updateValues.push(address);
    }
    if (city !== undefined) {
      updateFields.push('city = ?');
      updateValues.push(city);
    }
    if (state !== undefined) {
      updateFields.push('state = ?');
      updateValues.push(state);
    }
    if (zipCode !== undefined) {
      updateFields.push('zip_code = ?');
      updateValues.push(zipCode);
    }
    if (businessType !== undefined) {
      updateFields.push('business_type = ?');
      updateValues.push(businessType);
    }
    if (taxId !== undefined) {
      updateFields.push('tax_id = ?');
      updateValues.push(taxId);
    }
    if (creditLimit !== undefined) {
      updateFields.push('credit_limit = ?');
      updateValues.push(creditLimit);
    }
    if (paymentTerms !== undefined) {
      updateFields.push('payment_terms = ?');
      updateValues.push(paymentTerms);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(id);

    await pool.execute(`
      UPDATE retailers 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    // Get the updated retailer
    const [retailers] = await pool.execute(
      'SELECT * FROM retailers WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Retailer updated successfully',
      data: retailers[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating retailer',
      error: error.message
    });
  }
};

// @desc    Delete retailer
// @route   DELETE /api/retailers/:id
// @access  Private (Admin only)
const deleteRetailer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if retailer exists
    const [existing] = await pool.execute(
      'SELECT * FROM retailers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Retailer not found'
      });
    }

    // Check if retailer has any sales
    const [sales] = await pool.execute(
      'SELECT COUNT(*) as count FROM sales WHERE customer_info LIKE ?',
      [`%"id":${id}%`]
    );

    if (sales[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete retailer with existing sales. Please deactivate instead.'
      });
    }

    await pool.execute('DELETE FROM retailers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Retailer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting retailer',
      error: error.message
    });
  }
};

module.exports = {
  getRetailers,
  getRetailer,
  createRetailer,
  updateRetailer,
  deleteRetailer
};
