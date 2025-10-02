// Simplified Branch Settings Controller
// Clean, robust, simple true/false settings

const { executeQuery } = require('../config/database');

// @desc    Get branch settings
// @route   GET /api/branches/:id/settings
// @access  Private (Admin)
const getBranchSettings = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rows = await executeQuery(`
      SELECT 
        id, name, code, settings
      FROM branches 
      WHERE id = ?
    `, [parseInt(id)]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    const branch = rows[0];
    
    // Parse settings from JSON field
    let settings = {};
    if (branch.settings) {
      try {
        settings = typeof branch.settings === 'string' 
          ? JSON.parse(branch.settings) 
          : branch.settings;
      } catch (error) {
        settings = {};
      }
    }
    
    // Ensure all expected settings exist with default values
    const defaultSettings = {
      allowCashierInventoryEdit: false,
      allowCashierSalesEdit: false,
      allowCashierReturns: false,
      allowCashierCustomers: false,
      allowCashierPOS: false,
      allowCashierLedger: false,
      openAccountSystem: false
    };
    
    // Merge with defaults to ensure all settings are present
    settings = { ...defaultSettings, ...settings };
    
    res.json({
      success: true,
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        settings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving branch settings',
      error: error.message
    });
  }
};

// @desc    Update branch settings
// @route   PUT /api/branches/:id/settings
// @access  Private (Admin)
const updateBranchSettings = async (req, res) => {
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
    
    // Update branch settings in JSON field
    await executeQuery(`
      UPDATE branches SET settings = ?
      WHERE id = ?
    `, [JSON.stringify(settings), parseInt(id)]);
    
    // Return updated settings
    const rows = await executeQuery(`
      SELECT 
        id, name, code, settings
      FROM branches 
      WHERE id = ?
    `, [parseInt(id)]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    const branch = rows[0];
    
    // Parse settings from JSON field
    let updatedSettings = {};
    if (branch.settings) {
      try {
        updatedSettings = typeof branch.settings === 'string' 
          ? JSON.parse(branch.settings) 
          : branch.settings;
      } catch (error) {
        updatedSettings = settings; // Use the settings we just saved
      }
    } else {
      updatedSettings = settings; // Use the settings we just saved
    }
    
    // Ensure all expected settings exist with default values
    const defaultSettings = {
      allowCashierInventoryEdit: false,
      allowCashierSalesEdit: false,
      allowCashierReturns: false,
      allowCashierCustomers: false,
      allowCashierPOS: false,
      allowCashierLedger: false,
      openAccountSystem: false
    };
    
    // Merge with defaults to ensure all settings are present
    updatedSettings = { ...defaultSettings, ...updatedSettings };
    
    res.json({
      success: true,
      message: 'Branch settings updated successfully',
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        settings: updatedSettings
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating branch settings',
      error: error.message
    });
  }
};

module.exports = {
  getBranchSettings,
  updateBranchSettings
};
