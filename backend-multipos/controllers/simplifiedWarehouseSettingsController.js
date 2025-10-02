// Simplified Warehouse Settings Controller
// Clean, robust, simple true/false settings

const { executeQuery } = require('../config/database');

// @desc    Get warehouse settings
// @route   GET /api/warehouses/:id/settings
// @access  Private (Admin)
const getWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rows = await executeQuery(`
      SELECT 
        id, name, code, settings
      FROM warehouses 
      WHERE id = ?
    `, [parseInt(id)]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }
    
    const warehouse = rows[0];
    
    // Parse settings from JSON field
    let settings = {};
    if (warehouse.settings) {
      try {
        settings = typeof warehouse.settings === 'string' 
          ? JSON.parse(warehouse.settings) 
          : warehouse.settings;
      } catch (error) {
        settings = {};
      }
    }
    
    // Ensure all expected settings exist with default values
    const defaultSettings = {
      allowWarehouseInventoryEdit: false,
      allowWarehouseReturns: false,
      allowWarehouseSales: false,
      allowWarehouseCompanyCRUD: false,
      allowWarehouseRetailerCRUD: false,
      requireApprovalForTransfers: true,
      autoStockAlerts: false,
      allowWarehouseLedgerEdit: false
    };
    
    // Merge with defaults to ensure all settings are present
    settings = { ...defaultSettings, ...settings };
    
    res.json({
      success: true,
      data: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        settings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse settings',
      error: error.message
    });
  }
};

// @desc    Update warehouse settings
// @route   PUT /api/warehouses/:id/settings
// @access  Private (Admin)
const updateWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;
    
    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }
    
    // Update warehouse settings in JSON field
    await executeQuery(`
      UPDATE warehouses SET settings = ?
      WHERE id = ?
    `, [JSON.stringify(settings), parseInt(id)]);
    
    // Return updated settings
    const rows = await executeQuery(`
      SELECT 
        id, name, code, settings
      FROM warehouses 
      WHERE id = ?
    `, [parseInt(id)]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }
    
    const warehouse = rows[0];
    
    // Parse settings from JSON field
    let updatedSettings = {};
    if (warehouse.settings) {
      try {
        updatedSettings = typeof warehouse.settings === 'string' 
          ? JSON.parse(warehouse.settings) 
          : warehouse.settings;
      } catch (error) {
        updatedSettings = settings; // Use the settings we just saved
      }
    } else {
      updatedSettings = settings; // Use the settings we just saved
    }
    
    // Ensure all expected settings exist with default values
    const defaultSettings = {
      allowWarehouseInventoryEdit: false,
      allowWarehouseReturns: false,
      allowWarehouseSales: false,
      allowWarehouseCompanyCRUD: false,
      allowWarehouseRetailerCRUD: false,
      requireApprovalForTransfers: true,
      autoStockAlerts: false,
      allowWarehouseLedgerEdit: false
    };
    
    // Merge with defaults to ensure all settings are present
    updatedSettings = { ...defaultSettings, ...updatedSettings };
    
    res.json({
      success: true,
      message: 'Warehouse settings updated successfully',
      data: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        settings: updatedSettings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating warehouse settings',
      error: error.message
    });
  }
};

module.exports = {
  getWarehouseSettings,
  updateWarehouseSettings
};
