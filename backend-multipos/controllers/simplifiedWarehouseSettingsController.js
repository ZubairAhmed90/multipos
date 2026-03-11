// Simplified Warehouse Settings Controller
// Clean, robust, simple true/false settings

const { executeQuery } = require('../config/database');

// Helper function to safely convert database values to booleans
const toBoolean = (value) => {
  if (value === null || value === undefined) return false;
  return Number(value) === 1;
};

// @desc    Get warehouse settings
// @route   GET /api/warehouses/:id/settings
// @access  Private (Admin, Warehouse Keeper for own warehouse)
const getWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;

    const Warehouse = require('../models/Warehouse');
    const warehouse = await Warehouse.findById(parseInt(id));

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // Clean JSON settings - remove anything that lives in a column
    const cleanJsonSettings = { ...warehouse.settings };

    const columnsToRemove = [
      'allowWarehouseInventoryAdd', 'allowWarehouseInventoryEdit',
      'allowWarehouseReturns', 'allowWarehouseSales',
      'allowWarehouseLedgerEdit', 'requireApprovalForTransfers', 'autoStockAlerts',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowRetailerCreate', 'allowRetailerEdit', 'allowRetailerDelete', 'allowRetailerCustomerEdit',
      'allowWarehouseTransfers', 'allowWarehouseToBranchTransfers', 'allowWarehouseToWarehouseTransfers',
      'requireApprovalForWarehouseTransfers', 'maxTransferAmount', 'autoApproveSmallTransfers',
      'smallTransferThreshold', 'allowWarehouseCompanyCRUD', 'allowWarehouseRetailerCRUD'
    ];
    columnsToRemove.forEach(col => delete cleanJsonSettings[col]);

    // Build settings object from DB columns
    const settings = {
      // ── Inventory permissions (now split into 2) ──
      allowWarehouseInventoryAdd:  toBoolean(warehouse.allow_warehouse_inventory_add),
      allowWarehouseInventoryEdit: toBoolean(warehouse.allow_warehouse_inventory_edit),

      // ── Other basic permissions ──
      allowWarehouseReturns:          toBoolean(warehouse.allow_warehouse_returns),
      allowWarehouseSales:            toBoolean(warehouse.allow_warehouse_direct_sales),
      allowWarehouseLedgerEdit:       toBoolean(warehouse.allow_warehouse_ledger_edit),
      requireApprovalForTransfers:    toBoolean(warehouse.require_approval_for_transfers),
      autoStockAlerts:                toBoolean(warehouse.auto_stock_alerts),

      // ── Company permissions ──
      allowCompanyCreate: toBoolean(warehouse.allow_company_create),
      allowCompanyEdit:   toBoolean(warehouse.allow_company_edit),
      allowCompanyDelete: toBoolean(warehouse.allow_company_delete),

      // ── Retailer permissions ──
      allowRetailerCreate:       toBoolean(warehouse.allow_retailer_create),
      allowRetailerEdit:         toBoolean(warehouse.allow_retailer_edit),
      allowRetailerDelete:       toBoolean(warehouse.allow_retailer_delete),
      allowRetailerCustomerEdit: toBoolean(warehouse.allow_retailer_customer_edit),

      // ── Transfer settings ──
      allowWarehouseTransfers:              toBoolean(warehouse.allow_warehouse_transfers),
      allowWarehouseToBranchTransfers:      toBoolean(warehouse.allow_warehouse_to_branch_transfers),
      allowWarehouseToWarehouseTransfers:   toBoolean(warehouse.allow_warehouse_to_warehouse_transfers),
      requireApprovalForWarehouseTransfers: toBoolean(warehouse.require_approval_for_warehouse_transfers),
      maxTransferAmount:       Number(warehouse.max_transfer_amount),
      autoApproveSmallTransfers: toBoolean(warehouse.auto_approve_small_transfers),
      smallTransferThreshold:  Number(warehouse.small_transfer_threshold),

      // ── Anything extra from JSON ──
      ...cleanJsonSettings
    };

    // Backward compatibility aggregate fields
    settings.allowWarehouseCompanyCRUD  = settings.allowCompanyCreate  && settings.allowCompanyEdit  && settings.allowCompanyDelete;
    settings.allowWarehouseRetailerCRUD = settings.allowRetailerCreate && settings.allowRetailerEdit && settings.allowRetailerDelete;

    res.json({
      success: true,
      data: { id: warehouse.id, name: warehouse.name, code: warehouse.code, settings }
    });
  } catch (error) {
    console.error('❌ Error in getWarehouseSettings:', error);
    res.status(500).json({ success: false, message: 'Error retrieving warehouse settings', error: error.message });
  }
};

// @desc    Update warehouse settings
// @route   PUT /api/warehouses/:id/settings
// @access  Private (Admin only)
const updateWarehouseSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object is required' });
    }

    const Warehouse = require('../models/Warehouse');
    const warehouse = await Warehouse.findById(parseInt(id));

    if (!warehouse) {
      return res.status(404).json({ success: false, message: 'Warehouse not found' });
    }

    // ── Inventory permissions (split) ──
    if (settings.allowWarehouseInventoryAdd  !== undefined) warehouse.allow_warehouse_inventory_add  = settings.allowWarehouseInventoryAdd  ? 1 : 0;
    if (settings.allowWarehouseInventoryEdit !== undefined) warehouse.allow_warehouse_inventory_edit = settings.allowWarehouseInventoryEdit ? 1 : 0;

    // ── Other basic permissions ──
    if (settings.allowWarehouseReturns       !== undefined) warehouse.allow_warehouse_returns       = settings.allowWarehouseReturns       ? 1 : 0;
    if (settings.allowWarehouseSales         !== undefined) warehouse.allow_warehouse_direct_sales  = settings.allowWarehouseSales         ? 1 : 0;
    if (settings.allowWarehouseLedgerEdit    !== undefined) warehouse.allow_warehouse_ledger_edit   = settings.allowWarehouseLedgerEdit    ? 1 : 0;
    if (settings.requireApprovalForTransfers !== undefined) warehouse.require_approval_for_transfers = settings.requireApprovalForTransfers ? 1 : 0;
    if (settings.autoStockAlerts             !== undefined) warehouse.auto_stock_alerts             = settings.autoStockAlerts             ? 1 : 0;

    // ── Company permissions ──
    if (settings.allowCompanyCreate !== undefined) warehouse.allow_company_create = settings.allowCompanyCreate ? 1 : 0;
    if (settings.allowCompanyEdit   !== undefined) warehouse.allow_company_edit   = settings.allowCompanyEdit   ? 1 : 0;
    if (settings.allowCompanyDelete !== undefined) warehouse.allow_company_delete = settings.allowCompanyDelete ? 1 : 0;

    // ── Retailer permissions ──
    if (settings.allowRetailerCreate       !== undefined) warehouse.allow_retailer_create        = settings.allowRetailerCreate        ? 1 : 0;
    if (settings.allowRetailerEdit         !== undefined) warehouse.allow_retailer_edit          = settings.allowRetailerEdit          ? 1 : 0;
    if (settings.allowRetailerDelete       !== undefined) warehouse.allow_retailer_delete        = settings.allowRetailerDelete        ? 1 : 0;
    if (settings.allowRetailerCustomerEdit !== undefined) warehouse.allow_retailer_customer_edit = settings.allowRetailerCustomerEdit  ? 1 : 0;

    // ── Transfer settings ──
    if (settings.allowWarehouseTransfers              !== undefined) warehouse.allow_warehouse_transfers              = settings.allowWarehouseTransfers              ? 1 : 0;
    if (settings.allowWarehouseToBranchTransfers      !== undefined) warehouse.allow_warehouse_to_branch_transfers   = settings.allowWarehouseToBranchTransfers      ? 1 : 0;
    if (settings.allowWarehouseToWarehouseTransfers   !== undefined) warehouse.allow_warehouse_to_warehouse_transfers = settings.allowWarehouseToWarehouseTransfers  ? 1 : 0;
    if (settings.requireApprovalForWarehouseTransfers !== undefined) warehouse.require_approval_for_warehouse_transfers = settings.requireApprovalForWarehouseTransfers ? 1 : 0;
    if (settings.maxTransferAmount        !== undefined) warehouse.max_transfer_amount        = parseFloat(settings.maxTransferAmount);
    if (settings.autoApproveSmallTransfers !== undefined) warehouse.auto_approve_small_transfers = settings.autoApproveSmallTransfers ? 1 : 0;
    if (settings.smallTransferThreshold  !== undefined) warehouse.small_transfer_threshold  = parseFloat(settings.smallTransferThreshold);

    // Backward compatibility
    if (settings.allowWarehouseCompanyCRUD !== undefined) {
      const val = settings.allowWarehouseCompanyCRUD ? 1 : 0;
      warehouse.allow_company_create = val;
      warehouse.allow_company_edit   = val;
      warehouse.allow_company_delete = val;
    }
    if (settings.allowWarehouseRetailerCRUD !== undefined) {
      const val = settings.allowWarehouseRetailerCRUD ? 1 : 0;
      warehouse.allow_retailer_create = val;
      warehouse.allow_retailer_edit   = val;
      warehouse.allow_retailer_delete = val;
    }

    // Update JSON settings — only store non-column properties
    const columnsToRemove = [
      'allowWarehouseInventoryAdd', 'allowWarehouseInventoryEdit',
      'allowWarehouseReturns', 'allowWarehouseSales',
      'allowWarehouseLedgerEdit', 'requireApprovalForTransfers', 'autoStockAlerts',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowRetailerCreate', 'allowRetailerEdit', 'allowRetailerDelete', 'allowRetailerCustomerEdit',
      'allowWarehouseTransfers', 'allowWarehouseToBranchTransfers', 'allowWarehouseToWarehouseTransfers',
      'requireApprovalForWarehouseTransfers', 'maxTransferAmount', 'autoApproveSmallTransfers',
      'smallTransferThreshold', 'allowWarehouseCompanyCRUD', 'allowWarehouseRetailerCRUD'
    ];

    const currentJsonSettings = { ...warehouse.settings };
    columnsToRemove.forEach(col => delete currentJsonSettings[col]);

    const newJsonSettings = { ...settings };
    columnsToRemove.forEach(col => delete newJsonSettings[col]);

    warehouse.settings = { ...currentJsonSettings, ...newJsonSettings };

    await warehouse.save();

    // Return updated settings
    return getWarehouseSettings(req, res);
  } catch (error) {
    console.error('❌ Error in updateWarehouseSettings:', error);
    res.status(500).json({ success: false, message: 'Error updating warehouse settings', error: error.message });
  }
};

module.exports = { getWarehouseSettings, updateWarehouseSettings };