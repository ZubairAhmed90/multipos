const { pool } = require('../config/database');

/**
 * Create a stock report entry in inventory_transactions table
 * This function logs all inventory changes for audit and reporting purposes
 */
const createStockReportEntry = async (transactionData) => {
  try {
    const {
      inventoryItemId,
      transactionType,
      quantityChange,
      previousQuantity,
      newQuantity,
      unitPrice = 0,
      totalValue = 0,
      userId,
      userName,
      userRole,
      saleId = null,
      returnId = null,
      transferId = null,
      adjustmentReason = null
    } = transactionData;

    // Validate required fields
    if (!inventoryItemId || !transactionType || !userId || !userName || !userRole) {
      console.error('[StockTracking] Missing required fields:', {
        inventoryItemId,
        transactionType,
        userId,
        userName,
        userRole
      });
      return;
    }

    // Get inventory item details
    const [items] = await pool.execute(
      'SELECT * FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    );
    
    if (items.length === 0) {
      console.error('[StockTracking] Inventory item not found:', inventoryItemId);
      return;
    }

    const item = items[0];

    console.log(`[StockTracking] Creating transaction record for item ${inventoryItemId}, type: ${transactionType}, change: ${quantityChange}`);
    
    // Insert transaction record
    await pool.execute(`
      INSERT INTO stock_reports (
        inventory_item_id, 
        item_name, 
        item_sku, 
        item_category,
        scope_type, 
        scope_id, 
        scope_name, 
        transaction_type,
        quantity_change, 
        previous_quantity, 
        new_quantity,
        unit_price, 
        total_value, 
        user_id, 
        user_name, 
        user_role,
        sale_id, 
        return_id, 
        transfer_id, 
        adjustment_reason,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      inventoryItemId, 
      item.name, 
      item.sku, 
      item.category,
      item.scope_type, 
      item.scope_id, 
      item.scope_id, // scope_name is same as scope_id in current implementation
      transactionType,
      quantityChange, 
      previousQuantity, 
      newQuantity,
      unitPrice, 
      totalValue, 
      userId, 
      userName, 
      userRole,
      saleId, 
      returnId, 
      transferId, 
      adjustmentReason
    ]);

    console.log(`[StockTracking] Created transaction record for item ${inventoryItemId}, type: ${transactionType}, change: ${quantityChange}`);
    
  } catch (error) {
    console.error('[StockTracking] Error creating stock report entry:', error);
    console.error('[StockTracking] Transaction data:', transactionData);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Create transaction record for sale
 */
const createSaleTransaction = async (inventoryItemId, quantity, unitPrice, userId, userName, userRole, saleId) => {
  try {
    console.log(`[StockTracking] Creating sale transaction for item ${inventoryItemId}, quantity: ${quantity}`);
    
    const quantityChange = -Math.abs(quantity); // Sales reduce stock
    
    // Get current stock to calculate previous quantity
    const [items] = await pool.execute(
      'SELECT current_stock FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    );
    
    if (items.length === 0) {
      console.error(`[StockTracking] Inventory item not found: ${inventoryItemId}`);
      return;
    }
    
    const currentStock = items[0].current_stock;
    const previousQuantity = currentStock + Math.abs(quantity);
    const newQuantity = currentStock;
    const totalValue = Math.abs(quantity) * unitPrice;

    console.log(`[StockTracking] Sale transaction data:`, {
      inventoryItemId,
      quantityChange,
      previousQuantity,
      newQuantity,
      unitPrice,
      totalValue,
      userId,
      userName,
      userRole,
      saleId
    });

    await createStockReportEntry({
      inventoryItemId,
      transactionType: 'SALE',
      quantityChange,
      previousQuantity,
      newQuantity,
      unitPrice,
      totalValue,
      userId,
      userName,
      userRole,
      saleId
    });
    
    console.log(`[StockTracking] Successfully created sale transaction for item ${inventoryItemId}`);
  } catch (error) {
    console.error(`[StockTracking] Error creating sale transaction for item ${inventoryItemId}:`, error);
    throw error; // Re-throw to see what's failing
  }
};

/**
 * Create transaction record for return
 */
const createReturnTransaction = async (inventoryItemId, quantity, unitPrice, userId, userName, userRole, returnId) => {
  try {
    console.log(`[StockTracking] Creating return transaction for item ${inventoryItemId}, quantity: ${quantity}`);
    
    const quantityChange = Math.abs(quantity); // Returns increase stock
    
    // Get current stock to calculate previous quantity
    const [items] = await pool.execute(
      'SELECT current_stock FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    );
    
    if (items.length === 0) {
      console.error(`[StockTracking] Inventory item not found: ${inventoryItemId}`);
      return;
    }
    
    const currentStock = items[0].current_stock;
    const previousQuantity = currentStock - Math.abs(quantity);
    const newQuantity = currentStock;
    const totalValue = Math.abs(quantity) * unitPrice;

    console.log(`[StockTracking] Return transaction data:`, {
      inventoryItemId,
      quantityChange,
      previousQuantity,
      newQuantity,
      unitPrice,
      totalValue,
      userId,
      userName,
      userRole,
      returnId
    });

    await createStockReportEntry({
      inventoryItemId,
      transactionType: 'RETURN',
      quantityChange,
      previousQuantity,
      newQuantity,
      unitPrice,
      totalValue,
      userId,
      userName,
      userRole,
      returnId
    });
    
    console.log(`[StockTracking] Successfully created return transaction for item ${inventoryItemId}`);
  } catch (error) {
    console.error(`[StockTracking] Error creating return transaction for item ${inventoryItemId}:`, error);
    throw error; // Re-throw to see what's failing
  }
};

/**
 * Create transaction record for stock adjustment
 */
const createAdjustmentTransaction = async (inventoryItemId, previousQuantity, newQuantity, userId, userName, userRole, reason) => {
  const quantityChange = newQuantity - previousQuantity;
  const unitPrice = 0; // Adjustments don't have unit price
  const totalValue = 0;

  await createStockReportEntry({
    inventoryItemId,
    transactionType: 'ADJUSTMENT',
    quantityChange,
    previousQuantity,
    newQuantity,
    unitPrice,
    totalValue,
    userId,
    userName,
    userRole,
    adjustmentReason: reason
  });
};

module.exports = { 
  createStockReportEntry,
  createSaleTransaction,
  createReturnTransaction,
  createAdjustmentTransaction
};