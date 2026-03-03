// Simplified Branch Settings Controller
// Clean, robust, simple true/false settings
// UPDATED: Using direct column values for company permissions

const { executeQuery } = require('../config/database');

// Helper function to safely convert database values to booleans
const toBoolean = (value) => {
    if (value === null || value === undefined) return false;
    // Handle both number 1/0 and string "1"/"0"
    const num = Number(value);
    return num === 1;
};

// @desc    Get branch settings
// @route   GET /api/branches/:id/settings
// @access  Private (Admin)
const getBranchSettings = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 GET /settings called for branch:', id);
    
    // Use the Branch model
    const Branch = require('../models/Branch');
    const branch = await Branch.findById(parseInt(id));
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Debug: Log raw model values
    console.log('🔍 RAW MODEL VALUES:', {
      // Cashier permissions
      allow_cashier_inventory_edit: branch.allow_cashier_inventory_edit,
      allow_cashier_returns: branch.allow_cashier_returns,
      allow_cashier_customers: branch.allow_cashier_customers,
      allow_cashier_pos: branch.allow_cashier_pos,
      allow_cashier_ledger: branch.allow_cashier_ledger,
      open_account_system: branch.open_account_system,
      
      // Company permissions - NEW
      allow_company_create: branch.allow_company_create,
      allow_company_create_type: typeof branch.allow_company_create,
      allow_company_edit: branch.allow_company_edit,
      allow_company_delete: branch.allow_company_delete,
      
      // Transfer permissions
      allow_branch_transfers: branch.allow_branch_transfers,
      allow_branch_to_warehouse_transfers: branch.allow_branch_to_warehouse_transfers,
      allow_branch_to_branch_transfers: branch.allow_branch_to_branch_transfers,
      require_approval_for_branch_transfers: branch.require_approval_for_branch_transfers,
      max_transfer_amount: branch.max_transfer_amount
    });
    
    // Log the raw settings from JSON to see what's being stored
    console.log('📦 branch.settings (JSON):', branch.settings);
    
    // First, create a clean copy of branch.settings without any column properties
    const cleanJsonSettings = { ...branch.settings };
    
    // Remove any properties that should come from columns
    const columnsToRemove = [
      'allowCashierInventoryEdit', 'allowCashierReturns', 'allowCashierCustomers',
      'allowCashierPOS', 'allowCashierLedger', 'openAccountSystem',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowBranchTransfers', 'allowBranchToWarehouseTransfers', 'allowBranchToBranchTransfers',
      'requireApprovalForBranchTransfers', 'maxTransferAmount'
    ];
    
    columnsToRemove.forEach(col => delete cleanJsonSettings[col]);
    
    console.log('🧹 Clean JSON settings (after removing column props):', cleanJsonSettings);
    
    // Build settings object - model values take precedence
    const settings = {
      // Cashier permissions
      allowCashierInventoryEdit: toBoolean(branch.allow_cashier_inventory_edit),
      allowCashierReturns: toBoolean(branch.allow_cashier_returns),
      allowCashierCustomers: toBoolean(branch.allow_cashier_customers),
      allowCashierPOS: toBoolean(branch.allow_cashier_pos),
      allowCashierLedger: toBoolean(branch.allow_cashier_ledger),
      openAccountSystem: toBoolean(branch.open_account_system),
      
      // Company permissions - NEW
      allowCompanyCreate: toBoolean(branch.allow_company_create),
      allowCompanyEdit: toBoolean(branch.allow_company_edit),
      allowCompanyDelete: toBoolean(branch.allow_company_delete),
      
      // Transfer settings
      allowBranchTransfers: toBoolean(branch.allow_branch_transfers),
      allowBranchToWarehouseTransfers: toBoolean(branch.allow_branch_to_warehouse_transfers),
      allowBranchToBranchTransfers: toBoolean(branch.allow_branch_to_branch_transfers),
      requireApprovalForBranchTransfers: toBoolean(branch.require_approval_for_branch_transfers),
      
      // Force this to be number
      maxTransferAmount: Number(branch.max_transfer_amount),
      
      // Add any additional settings from JSON (but don't override model values)
      ...cleanJsonSettings
    };
    
    console.log('📤 Sending settings:', {
      // Cashier permissions
      allowCashierInventoryEdit: settings.allowCashierInventoryEdit,
      allowCashierReturns: settings.allowCashierReturns,
      allowCashierCustomers: settings.allowCashierCustomers,
      allowCashierPOS: settings.allowCashierPOS,
      allowCashierLedger: settings.allowCashierLedger,
      openAccountSystem: settings.openAccountSystem,
      
      // Company permissions
      allowCompanyCreate: settings.allowCompanyCreate,
      allowCompanyEdit: settings.allowCompanyEdit,
      allowCompanyDelete: settings.allowCompanyDelete,
      
      // Transfer settings
      allowBranchTransfers: settings.allowBranchTransfers,
      maxTransferAmount: settings.maxTransferAmount
    });
    
    // Send response with debug info
    res.json({
      success: true,
      _debug: {
        controller: "simplifiedBranchSettingsController",
        version: "v2.0-feb18",
        timestamp: new Date().toISOString(),
        modelValues: {
          max_transfer_amount: branch.max_transfer_amount,
          allow_company_create: branch.allow_company_create,
          allow_company_edit: branch.allow_company_edit,
          allow_company_delete: branch.allow_company_delete
        }
      },
      data: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        settings
      }
    });
  } catch (error) {
    console.error('❌ Error in getBranchSettings:', error);
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
    
    console.log('🔧 UPDATE /settings called for branch:', id);
    console.log('📦 Update data:', settings);
    
    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }
    
    const Branch = require('../models/Branch');
    const branch = await Branch.findById(parseInt(id));
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    // Update branch properties
    
    // Cashier permissions
    if (settings.allowCashierInventoryEdit !== undefined) {
      branch.allow_cashier_inventory_edit = settings.allowCashierInventoryEdit ? 1 : 0;
    }
    
    if (settings.allowCashierReturns !== undefined) {
      branch.allow_cashier_returns = settings.allowCashierReturns ? 1 : 0;
    }
    
    if (settings.allowCashierCustomers !== undefined) {
      branch.allow_cashier_customers = settings.allowCashierCustomers ? 1 : 0;
    }
    
    if (settings.allowCashierPOS !== undefined) {
      branch.allow_cashier_pos = settings.allowCashierPOS ? 1 : 0;
    }
    
    if (settings.allowCashierLedger !== undefined) {
      branch.allow_cashier_ledger = settings.allowCashierLedger ? 1 : 0;
    }
    
    if (settings.openAccountSystem !== undefined) {
      branch.open_account_system = settings.openAccountSystem ? 1 : 0;
    }
    
    // Company permissions - NEW
    if (settings.allowCompanyCreate !== undefined) {
      branch.allow_company_create = settings.allowCompanyCreate ? 1 : 0;
    }
    
    if (settings.allowCompanyEdit !== undefined) {
      branch.allow_company_edit = settings.allowCompanyEdit ? 1 : 0;
    }
    
    if (settings.allowCompanyDelete !== undefined) {
      branch.allow_company_delete = settings.allowCompanyDelete ? 1 : 0;
    }
    
    // Transfer settings
    if (settings.allowBranchTransfers !== undefined) {
      branch.allow_branch_transfers = settings.allowBranchTransfers ? 1 : 0;
    }
    
    if (settings.allowBranchToWarehouseTransfers !== undefined) {
      branch.allow_branch_to_warehouse_transfers = settings.allowBranchToWarehouseTransfers ? 1 : 0;
    }
    
    if (settings.allowBranchToBranchTransfers !== undefined) {
      branch.allow_branch_to_branch_transfers = settings.allowBranchToBranchTransfers ? 1 : 0;
    }
    
    if (settings.requireApprovalForBranchTransfers !== undefined) {
      branch.require_approval_for_branch_transfers = settings.requireApprovalForBranchTransfers ? 1 : 0;
    }
    
    // Decimal value - ensure it's a number
    if (settings.maxTransferAmount !== undefined) {
      branch.max_transfer_amount = parseFloat(settings.maxTransferAmount);
    }
    
    // Update settings JSON - store only non-column properties
    // First, get current settings
    const currentJsonSettings = { ...branch.settings };
    
    // Remove any column properties that might be in the current JSON
    const columnsToRemove = [
      'allowCashierInventoryEdit', 'allowCashierReturns', 'allowCashierCustomers',
      'allowCashierPOS', 'allowCashierLedger', 'openAccountSystem',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowBranchTransfers', 'allowBranchToWarehouseTransfers', 'allowBranchToBranchTransfers',
      'requireApprovalForBranchTransfers', 'maxTransferAmount'
    ];
    
    columnsToRemove.forEach(col => delete currentJsonSettings[col]);
    
    // Merge with new settings (but only non-column properties)
    const newJsonSettings = { ...settings };
    columnsToRemove.forEach(col => delete newJsonSettings[col]);
    
    // Update branch.settings with merged result
    branch.settings = {
      ...currentJsonSettings,
      ...newJsonSettings
    };
    
    console.log('💾 Saving branch with updated settings');
    console.log('   - Column values updated directly');
    console.log('   - Company permissions:', {
      allow_company_create: branch.allow_company_create,
      allow_company_edit: branch.allow_company_edit,
      allow_company_delete: branch.allow_company_delete
    });
    console.log('   - JSON settings:', branch.settings);
    
    // Save the branch
    await branch.save();
    console.log('✅ Branch saved successfully');
    
    // Return updated settings
    return getBranchSettings(req, res);
    
  } catch (error) {
    console.error('❌ Error in updateBranchSettings:', error);
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