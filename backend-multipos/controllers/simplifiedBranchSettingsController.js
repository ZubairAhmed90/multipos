// Simplified Branch Settings Controller
// Clean, robust, simple true/false settings

const toBoolean = (value) => {
  if (value === null || value === undefined) return false;
  return Number(value) === 1;
};

// @desc    Get branch settings
// @route   GET /api/branches/:id/settings
// @access  Private (Admin, Cashier for own branch)
const getBranchSettings = async (req, res) => {
  try {
    const { id } = req.params;

    const Branch = require('../models/Branch');
    const branch = await Branch.findById(parseInt(id));

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // Clean JSON settings - remove anything that lives in a column
    const cleanJsonSettings = { ...branch.settings };

    const columnsToRemove = [
      'allowCashierInventoryAdd', 'allowCashierInventoryEdit',
      'allowCashierSalesEdit', 'allowCashierSalesDelete',
      'allowCashierReturns', 'allowCashierCustomers',
      'allowCashierPOS', 'allowCashierLedger', 'openAccountSystem',
      'allowCashierCustomerEdit',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowBranchTransfers', 'allowBranchToWarehouseTransfers', 'allowBranchToBranchTransfers',
      'requireApprovalForBranchTransfers', 'maxTransferAmount',
      'allowBranchTransfersCRUD', 'allowCashierCRUD'
    ];
    columnsToRemove.forEach(col => delete cleanJsonSettings[col]);

    // Build settings object from DB columns
    const settings = {
      // ── Inventory permissions (split into 2) ──
      allowCashierInventoryAdd:  toBoolean(branch.allow_cashier_inventory_add),
      allowCashierInventoryEdit: toBoolean(branch.allow_cashier_inventory_edit),

      // ── Other cashier permissions ──
      allowCashierReturns:   toBoolean(branch.allow_cashier_returns),
      allowCashierCustomers: toBoolean(branch.allow_cashier_customers),
      allowCashierPOS:       toBoolean(branch.allow_cashier_pos),
      allowCashierLedger:    toBoolean(branch.allow_cashier_ledger),
      openAccountSystem:     toBoolean(branch.open_account_system),

      // ── Customer edit ──
      allowCashierCustomerEdit: toBoolean(branch.allow_cashier_customer_edit),

      // ── Company permissions ──
      allowCompanyCreate: toBoolean(branch.allow_company_create),
      allowCompanyEdit:   toBoolean(branch.allow_company_edit),
      allowCompanyDelete: toBoolean(branch.allow_company_delete),

      // ── Transfer settings ──
      allowBranchTransfers:            toBoolean(branch.allow_branch_transfers),
      allowBranchToWarehouseTransfers: toBoolean(branch.allow_branch_to_warehouse_transfers),
      allowBranchToBranchTransfers:    toBoolean(branch.allow_branch_to_branch_transfers),
      requireApprovalForBranchTransfers: toBoolean(branch.require_approval_for_branch_transfers),
      maxTransferAmount: Number(branch.max_transfer_amount),

      // ── Anything extra from JSON ──
      ...cleanJsonSettings
    };

    res.json({
      success: true,
      data: { id: branch.id, name: branch.name, code: branch.code, settings }
    });
  } catch (error) {
    console.error('❌ Error in getBranchSettings:', error);
    res.status(500).json({ success: false, message: 'Error retrieving branch settings', error: error.message });
  }
};

// @desc    Update branch settings
// @route   PUT /api/branches/:id/settings
// @access  Private (Admin only)
const updateBranchSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object is required' });
    }

    const Branch = require('../models/Branch');
    const branch = await Branch.findById(parseInt(id));

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    // ── Inventory permissions (split) ──
    if (settings.allowCashierInventoryAdd  !== undefined) branch.allow_cashier_inventory_add  = settings.allowCashierInventoryAdd  ? 1 : 0;
    if (settings.allowCashierInventoryEdit !== undefined) branch.allow_cashier_inventory_edit = settings.allowCashierInventoryEdit ? 1 : 0;

    // ── Other cashier permissions ──
    if (settings.allowCashierReturns   !== undefined) branch.allow_cashier_returns   = settings.allowCashierReturns   ? 1 : 0;
    if (settings.allowCashierCustomers !== undefined) branch.allow_cashier_customers = settings.allowCashierCustomers ? 1 : 0;
    if (settings.allowCashierPOS       !== undefined) branch.allow_cashier_pos       = settings.allowCashierPOS       ? 1 : 0;
    if (settings.allowCashierLedger    !== undefined) branch.allow_cashier_ledger    = settings.allowCashierLedger    ? 1 : 0;
    if (settings.openAccountSystem     !== undefined) branch.open_account_system     = settings.openAccountSystem     ? 1 : 0;

    // ── Customer edit ──
    if (settings.allowCashierCustomerEdit !== undefined) branch.allow_cashier_customer_edit = settings.allowCashierCustomerEdit ? 1 : 0;

    // ── Company permissions ──
    if (settings.allowCompanyCreate !== undefined) branch.allow_company_create = settings.allowCompanyCreate ? 1 : 0;
    if (settings.allowCompanyEdit   !== undefined) branch.allow_company_edit   = settings.allowCompanyEdit   ? 1 : 0;
    if (settings.allowCompanyDelete !== undefined) branch.allow_company_delete = settings.allowCompanyDelete ? 1 : 0;

    // ── Transfer settings ──
    if (settings.allowBranchTransfers            !== undefined) branch.allow_branch_transfers              = settings.allowBranchTransfers            ? 1 : 0;
    if (settings.allowBranchToWarehouseTransfers !== undefined) branch.allow_branch_to_warehouse_transfers = settings.allowBranchToWarehouseTransfers ? 1 : 0;
    if (settings.allowBranchToBranchTransfers    !== undefined) branch.allow_branch_to_branch_transfers    = settings.allowBranchToBranchTransfers    ? 1 : 0;
    if (settings.requireApprovalForBranchTransfers !== undefined) branch.require_approval_for_branch_transfers = settings.requireApprovalForBranchTransfers ? 1 : 0;
    if (settings.maxTransferAmount !== undefined) branch.max_transfer_amount = parseFloat(settings.maxTransferAmount);

    // Update JSON settings — only store non-column properties
    const columnsToRemove = [
      'allowCashierInventoryAdd', 'allowCashierInventoryEdit',
      'allowCashierSalesEdit', 'allowCashierSalesDelete',
      'allowCashierReturns', 'allowCashierCustomers',
      'allowCashierPOS', 'allowCashierLedger', 'openAccountSystem',
      'allowCashierCustomerEdit',
      'allowCompanyCreate', 'allowCompanyEdit', 'allowCompanyDelete',
      'allowBranchTransfers', 'allowBranchToWarehouseTransfers', 'allowBranchToBranchTransfers',
      'requireApprovalForBranchTransfers', 'maxTransferAmount',
      'allowBranchTransfersCRUD', 'allowCashierCRUD'
    ];

    const currentJsonSettings = { ...branch.settings };
    columnsToRemove.forEach(col => delete currentJsonSettings[col]);

    const newJsonSettings = { ...settings };
    columnsToRemove.forEach(col => delete newJsonSettings[col]);

    branch.settings = { ...currentJsonSettings, ...newJsonSettings };

    await branch.save();

    // Return updated settings
    return getBranchSettings(req, res);
  } catch (error) {
    console.error('❌ Error in updateBranchSettings:', error);
    res.status(500).json({ success: false, message: 'Error updating branch settings', error: error.message });
  }
};

module.exports = { getBranchSettings, updateBranchSettings };