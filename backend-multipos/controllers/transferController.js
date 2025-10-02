const Transfer = require('../models/Transfer');
const InventoryItem = require('../models/InventoryItem');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const Ledger = require('../models/Ledger');

// Create transfer
const createTransfer = async (req, res) => {
  try {
    const { from, to, items, reason, notes } = req.body;
    
    // Validate source and destination
    await validateScope(from.scopeType, from.scopeId);
    await validateScope(to.scopeType, to.scopeId);
    
    // Validate items and check availability
    const validatedItems = await validateTransferItems(items, from.scopeType, from.scopeId);
    
    // Calculate total amount
    const totalAmount = validatedItems.reduce((sum, item) => sum + item.totalCost, 0);
    
    // Generate transfer number
    const transferNo = await Transfer.generateTransferNumber(from.warehouseId);
    
    const transfer = await Transfer.create({
      transferNo,
      fromWarehouseId: from.warehouseId,
      toWarehouseId: to.warehouseId,
      toBranchId: to.branchId,
      items: validatedItems,
      totalItems: validatedItems.length,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Transfer created successfully',
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating transfer',
      error: error.message
    });
  }
};

// Get transfers
const getTransfers = async (req, res) => {
  try {
    const { scopeType, scopeId, status } = req.query;
    const { page = 1, limit = 20 } = req.query;
    
    let conditions = {};
    
    // Apply role-based filtering
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see transfers involving their assigned warehouse
      conditions.fromWarehouseId = req.user.warehouseId;
    } else if (req.user.role === 'CASHIER') {
      // Cashiers can only see transfers involving their assigned branch
      conditions.toBranchId = req.user.branchId;
    }
    
    // Add status filter if provided
    if (status) {
      conditions.status = status;
    }
    
    // Get transfers with role-based filtering
    const transfers = await Transfer.find(conditions, { 
      limit: parseInt(limit), 
      offset: (parseInt(page) - 1) * parseInt(limit),
      orderBy: 'created_at DESC'
    });
    
    const total = await Transfer.count(conditions);
    
    res.status(200).json({
      success: true,
      data: transfers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving transfers',
      error: error.message
    });
  }
};

// Get single transfer
const getTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transfer = await Transfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving transfer',
      error: error.message
    });
  }
};

// Approve transfer
const approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transfer = await Transfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Update transfer status to approved
    await Transfer.updateOne({ id: transfer.id }, { 
      status: 'approved',
      approvedBy: req.user.id 
    });
    
    res.status(200).json({
      success: true,
      message: 'Transfer approved successfully',
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving transfer',
      error: error.message
    });
  }
};

// Reject transfer
const rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const transfer = await Transfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Update transfer status to cancelled
    await Transfer.updateOne({ id: transfer.id }, { 
      status: 'cancelled'
    });
    
    res.status(200).json({
      success: true,
      message: 'Transfer rejected successfully',
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting transfer',
      error: error.message
    });
  }
};

// Complete transfer
const completeTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transfer = await Transfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Execute the transfer - update inventory
    await executeTransfer(transfer);
    
    // Update ledger entries
    await updateLedgerEntries(transfer);
    
    // Update transfer status to delivered
    await Transfer.updateOne({ id: transfer.id }, { 
      status: 'delivered'
    });
    
    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error completing transfer',
      error: error.message
    });
  }
};

// Cancel transfer
const cancelTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const transfer = await Transfer.findById(id);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        message: 'Transfer not found'
      });
    }
    
    // Update transfer status to cancelled
    await Transfer.updateOne({ id: transfer.id }, { 
      status: 'cancelled'
    });
    
    res.status(200).json({
      success: true,
      message: 'Transfer cancelled successfully',
      data: transfer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling transfer',
      error: error.message
    });
  }
};

// Helper function to validate scope
const validateScope = async (scopeType, scopeId) => {
  let scope;
  
  switch (scopeType) {
    case 'BRANCH':
      scope = await Branch.findById(scopeId);
      break;
    case 'WAREHOUSE':
      scope = await Warehouse.findById(scopeId);
      break;
    default:
      throw new Error('Invalid scope type for transfer');
  }
  
  if (!scope) {
    throw new Error(`${scopeType} not found`);
  }
  
  return scope;
};

// Helper function to validate transfer items
const validateTransferItems = async (items, scopeType, scopeId) => {
  const validatedItems = [];
  
  for (const item of items) {
    const inventoryItem = await InventoryItem.findById(item.inventoryItemId);
    
    if (!inventoryItem) {
      throw new Error(`Inventory item ${item.inventoryItemId} not found`);
    }
    
    if (inventoryItem.quantity < item.quantity) {
      throw new Error(`Insufficient quantity for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}`);
    }
    
    validatedItems.push({
      inventoryItemId: item.inventoryItemId,
      quantity: item.quantity,
      unitCost: inventoryItem.costPrice,
      totalCost: item.quantity * inventoryItem.costPrice
    });
  }
  
  return validatedItems;
};

// Helper function to execute transfer
const executeTransfer = async (transfer) => {
  for (const item of transfer.items) {
    // Decrement from source
    await InventoryItem.updateStock(item.inventoryItemId, -item.quantity);
    
    // Increment to destination
    const destinationItem = await InventoryItem.findById(item.inventoryItemId);
    
    if (destinationItem) {
      await InventoryItem.updateStock(item.inventoryItemId, item.quantity);
    } else {
      // Create new inventory item at destination
      const sourceItem = await InventoryItem.findById(item.inventoryItemId);
      await InventoryItem.create({
        name: sourceItem.name,
        sku: sourceItem.sku,
        description: sourceItem.description,
        category: sourceItem.category,
        unit: sourceItem.unit,
        costPrice: sourceItem.costPrice,
        salePrice: sourceItem.salePrice,
        quantity: item.quantity,
        minStock: sourceItem.minStock,
        maxStock: sourceItem.maxStock,
        scopeType: transfer.to.scopeType,
        scopeId: transfer.to.scopeId,
        status: sourceItem.status
      });
    }
  }
};

// Helper function to update ledger entries
const updateLedgerEntries = async (transfer) => {
  const description = `Transfer ${transfer.transferNo}`;
  
  // For now, we'll skip ledger entries as the current schema doesn't support them
  // This can be implemented later when the ledger system is properly set up
};

module.exports = {
  createTransfer,
  getTransfers,
  getTransfer,
  approveTransfer,
  rejectTransfer,
  completeTransfer,
  cancelTransfer
};
