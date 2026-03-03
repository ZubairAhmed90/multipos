// Simplified Warehouse Settings Controller
// Clean, robust, simple true/false settings

const { executeQuery } = require('../config/database');

// Helper function to safely convert database values to booleans
const toBoolean = (value) => {
    if (value === null || value === undefined) return false;
    // Handle both number 1/0 and string "1"/"0"
    const num = Number(value);
    return num === 1;
};

// @desc    Get warehouse settings
// @route   GET /api/warehouses/:id/settings
// @access  Private (Admin, Warehouse Keeper for own warehouse)
const getWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 GET /settings called for warehouse:', id);
    
    // Use the Warehouse model
    const Warehouse = require('../models/Warehouse');
    const warehouse = await Warehouse.findById(parseInt(id));
    
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }
    
    // Debug: Log raw model values to see what we're getting
    console.log('🔍 RAW MODEL VALUES:', {
      // Retailer permissions
      allow_retailer_create: warehouse.allow_retailer_create,
      allow_retailer_create_type: typeof warehouse.allow_retailer_create,
      allow_retailer_edit: warehouse.allow_retailer_edit,
      allow_retailer_delete: warehouse.allow_retailer_delete,
      
      // Company permissions
      allow_company_create: warehouse.allow_company_create,
      allow_company_create_type: typeof warehouse.allow_company_create,
      allow_company_edit: warehouse.allow_company_edit,
      allow_company_delete: warehouse.allow_company_delete,
      
      // Transfer permissions
      allow_warehouse_transfers: warehouse.allow_warehouse_transfers,
      max_transfer_amount: warehouse.max_transfer_amount
    });
    
    // Log the raw settings from JSON to see what's being stored
    console.log('📦 warehouse.settings (JSON):', warehouse.settings);
    
    // First, create a clean copy of warehouse.settings without any column properties
    const cleanJsonSettings = { ...warehouse.settings };
    
    // Remove any properties that should come from columns
    delete cleanJsonSettings.allowWarehouseInventoryEdit;
    delete cleanJsonSettings.allowWarehouseReturns;
    delete cleanJsonSettings.allowWarehouseSales;
    delete cleanJsonSettings.allowWarehouseLedgerEdit;
    delete cleanJsonSettings.requireApprovalForTransfers;
    delete cleanJsonSettings.autoStockAlerts;
    delete cleanJsonSettings.allowCompanyCreate;
    delete cleanJsonSettings.allowCompanyEdit;
    delete cleanJsonSettings.allowCompanyDelete;
    delete cleanJsonSettings.allowRetailerCreate;
    delete cleanJsonSettings.allowRetailerEdit;
    delete cleanJsonSettings.allowRetailerDelete;
    delete cleanJsonSettings.allowWarehouseTransfers;
    delete cleanJsonSettings.allowWarehouseToBranchTransfers;
    delete cleanJsonSettings.allowWarehouseToWarehouseTransfers;
    delete cleanJsonSettings.requireApprovalForWarehouseTransfers;
    delete cleanJsonSettings.maxTransferAmount;
    delete cleanJsonSettings.autoApproveSmallTransfers;
    delete cleanJsonSettings.smallTransferThreshold;
    delete cleanJsonSettings.allowWarehouseCompanyCRUD;
    delete cleanJsonSettings.allowWarehouseRetailerCRUD;
    
    console.log('🧹 Clean JSON settings (after removing column props):', cleanJsonSettings);
    
    // Build settings object - model values take precedence
    const settings = {
      // Basic warehouse permissions
      allowWarehouseInventoryEdit: toBoolean(warehouse.allow_warehouse_inventory_edit),
      allowWarehouseReturns: toBoolean(warehouse.allow_warehouse_returns),
      allowWarehouseSales: toBoolean(warehouse.allow_warehouse_direct_sales),
      allowWarehouseLedgerEdit: toBoolean(warehouse.allow_warehouse_ledger_edit),
      requireApprovalForTransfers: toBoolean(warehouse.require_approval_for_transfers),
      autoStockAlerts: toBoolean(warehouse.auto_stock_alerts),
      
      // Company permissions - FIXED: using toBoolean helper
      allowCompanyCreate: toBoolean(warehouse.allow_company_create),
      allowCompanyEdit: toBoolean(warehouse.allow_company_edit),
      allowCompanyDelete: toBoolean(warehouse.allow_company_delete),
      
      // Retailer permissions - FIXED: using toBoolean helper
      allowRetailerCreate: toBoolean(warehouse.allow_retailer_create),
      allowRetailerEdit: toBoolean(warehouse.allow_retailer_edit),
      allowRetailerDelete: toBoolean(warehouse.allow_retailer_delete),
      
      // Transfer settings
      allowWarehouseTransfers: toBoolean(warehouse.allow_warehouse_transfers),
      allowWarehouseToBranchTransfers: toBoolean(warehouse.allow_warehouse_to_branch_transfers),
      allowWarehouseToWarehouseTransfers: toBoolean(warehouse.allow_warehouse_to_warehouse_transfers),
      requireApprovalForWarehouseTransfers: toBoolean(warehouse.require_approval_for_warehouse_transfers),
      
      // Force these to be numbers
      maxTransferAmount: Number(warehouse.max_transfer_amount),
      autoApproveSmallTransfers: toBoolean(warehouse.auto_approve_small_transfers),
      smallTransferThreshold: Number(warehouse.small_transfer_threshold),
      
      // Add any additional settings from JSON (but don't override model values)
      ...cleanJsonSettings
    };
    
    console.log('📤 Sending settings:', {
      // Retailer permissions
      allowRetailerCreate: settings.allowRetailerCreate,
      allowRetailerEdit: settings.allowRetailerEdit,
      allowRetailerDelete: settings.allowRetailerDelete,
      
      // Company permissions
      allowCompanyCreate: settings.allowCompanyCreate,
      allowCompanyEdit: settings.allowCompanyEdit,
      allowCompanyDelete: settings.allowCompanyDelete,
      
      // Transfer settings
      allowWarehouseTransfers: settings.allowWarehouseTransfers,
      maxTransferAmount: settings.maxTransferAmount,
      smallTransferThreshold: settings.smallTransferThreshold
    });
    
    // Add backward compatibility fields
    settings.allowWarehouseCompanyCRUD = settings.allowCompanyCreate && 
                                         settings.allowCompanyEdit && 
                                         settings.allowCompanyDelete;
    
    settings.allowWarehouseRetailerCRUD = settings.allowRetailerCreate && 
                                         settings.allowRetailerEdit && 
                                         settings.allowRetailerDelete;
    
    // Send response with debug info
    res.json({
      success: true,
      _debug: {
        controller: "simplifiedWarehouseSettingsController",
        version: "v2.0-feb16",
        timestamp: new Date().toISOString(),
        modelValues: {
          max_transfer_amount: warehouse.max_transfer_amount,
          small_transfer_threshold: warehouse.small_transfer_threshold,
          allow_retailer_create: warehouse.allow_retailer_create,
          allow_company_create: warehouse.allow_company_create
        }
      },
      data: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        settings
      }
    });
  } catch (error) {
    console.error('❌ Error in getWarehouseSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving warehouse settings',
      error: error.message
    });
  }
};

// @desc    Update warehouse settings
// @route   PUT /api/warehouses/:id/settings
// @access  Private (Admin only)
const updateWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;
    
    console.log('🔧 UPDATE /settings called for warehouse:', id);
    console.log('📦 Update data:', settings);
    
    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }
    
    const Warehouse = require('../models/Warehouse');
    const warehouse = await Warehouse.findById(parseInt(id));
    
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }
    
    // Update warehouse properties
    // Basic permissions
    if (settings.allowWarehouseInventoryEdit !== undefined) {
      warehouse.allow_warehouse_inventory_edit = settings.allowWarehouseInventoryEdit ? 1 : 0;
    }
    
    if (settings.allowWarehouseReturns !== undefined) {
      warehouse.allow_warehouse_returns = settings.allowWarehouseReturns ? 1 : 0;
    }
    
    if (settings.allowWarehouseSales !== undefined) {
      warehouse.allow_warehouse_direct_sales = settings.allowWarehouseSales ? 1 : 0;
    }
    
    if (settings.allowWarehouseLedgerEdit !== undefined) {
      warehouse.allow_warehouse_ledger_edit = settings.allowWarehouseLedgerEdit ? 1 : 0;
    }
    
    if (settings.requireApprovalForTransfers !== undefined) {
      warehouse.require_approval_for_transfers = settings.requireApprovalForTransfers ? 1 : 0;
    }
    
    if (settings.autoStockAlerts !== undefined) {
      warehouse.auto_stock_alerts = settings.autoStockAlerts ? 1 : 0;
    }
    
    // Company permissions
    if (settings.allowCompanyCreate !== undefined) {
      warehouse.allow_company_create = settings.allowCompanyCreate ? 1 : 0;
    }
    
    if (settings.allowCompanyEdit !== undefined) {
      warehouse.allow_company_edit = settings.allowCompanyEdit ? 1 : 0;
    }
    
    if (settings.allowCompanyDelete !== undefined) {
      warehouse.allow_company_delete = settings.allowCompanyDelete ? 1 : 0;
    }
    
    // Retailer permissions
    if (settings.allowRetailerCreate !== undefined) {
      warehouse.allow_retailer_create = settings.allowRetailerCreate ? 1 : 0;
    }
    
    if (settings.allowRetailerEdit !== undefined) {
      warehouse.allow_retailer_edit = settings.allowRetailerEdit ? 1 : 0;
    }
    
    if (settings.allowRetailerDelete !== undefined) {
      warehouse.allow_retailer_delete = settings.allowRetailerDelete ? 1 : 0;
    }
    
    // Transfer settings
    if (settings.allowWarehouseTransfers !== undefined) {
      warehouse.allow_warehouse_transfers = settings.allowWarehouseTransfers ? 1 : 0;
    }
    
    if (settings.allowWarehouseToBranchTransfers !== undefined) {
      warehouse.allow_warehouse_to_branch_transfers = settings.allowWarehouseToBranchTransfers ? 1 : 0;
    }
    
    if (settings.allowWarehouseToWarehouseTransfers !== undefined) {
      warehouse.allow_warehouse_to_warehouse_transfers = settings.allowWarehouseToWarehouseTransfers ? 1 : 0;
    }
    
    if (settings.requireApprovalForWarehouseTransfers !== undefined) {
      warehouse.require_approval_for_warehouse_transfers = settings.requireApprovalForWarehouseTransfers ? 1 : 0;
    }
    
    // Decimal values - ensure they're numbers
    if (settings.maxTransferAmount !== undefined) {
      warehouse.max_transfer_amount = parseFloat(settings.maxTransferAmount);
    }
    
    if (settings.autoApproveSmallTransfers !== undefined) {
      warehouse.auto_approve_small_transfers = settings.autoApproveSmallTransfers ? 1 : 0;
    }
    
    if (settings.smallTransferThreshold !== undefined) {
      warehouse.small_transfer_threshold = parseFloat(settings.smallTransferThreshold);
    }
    
    // Handle backward compatibility
    if (settings.allowWarehouseCompanyCRUD !== undefined) {
      const val = settings.allowWarehouseCompanyCRUD ? 1 : 0;
      warehouse.allow_company_create = val;
      warehouse.allow_company_edit = val;
      warehouse.allow_company_delete = val;
    }
    
    if (settings.allowWarehouseRetailerCRUD !== undefined) {
      const val = settings.allowWarehouseRetailerCRUD ? 1 : 0;
      warehouse.allow_retailer_create = val;
      warehouse.allow_retailer_edit = val;
      warehouse.allow_retailer_delete = val;
    }
    
    // Update settings JSON - store only non-column properties
    // First, get current settings
    const currentJsonSettings = { ...warehouse.settings };
    
    // Remove any column properties that might be in the current JSON
    const columnsToRemove = [
      'allowWarehouseInventoryEdit', 'allowWarehouseReturns', 'allowWarehouseSales',
      'allowWarehouseLedgerEdit', 'requireApprovalForTransfers', 'autoStockAlerts',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowRetailerCreate', 'allowRetailerEdit', 'allowRetailerDelete',
      'allowWarehouseTransfers', 'allowWarehouseToBranchTransfers', 'allowWarehouseToWarehouseTransfers',
      'requireApprovalForWarehouseTransfers', 'maxTransferAmount', 'autoApproveSmallTransfers',
      'smallTransferThreshold', 'allowWarehouseCompanyCRUD', 'allowWarehouseRetailerCRUD'
    ];
    
    columnsToRemove.forEach(col => delete currentJsonSettings[col]);
    
    // Merge with new settings (but only non-column properties)
    const newJsonSettings = { ...settings };
    columnsToRemove.forEach(col => delete newJsonSettings[col]);
    
    // Update warehouse.settings with merged result
    warehouse.settings = {
      ...currentJsonSettings,
      ...newJsonSettings
    };
    
    console.log('💾 Saving warehouse with updated settings');
    console.log('   - Column values updated directly');
    console.log('   - JSON settings:', warehouse.settings);
    
    // Save the warehouse
    await warehouse.save();
    console.log('✅ Warehouse saved successfully');
    
    // Return updated settings
    return getWarehouseSettings(req, res);
    
  } catch (error) {
    console.error('❌ Error in updateWarehouseSettings:', error);
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