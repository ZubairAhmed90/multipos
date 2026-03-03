const { pool } = require('../config/database');

/**
 * Create a stock report entry in inventory_transactions table
 * This function logs all inventory changes for audit and reporting purposes
 * @param {object} transactionData - The transaction data
 * @param {object} connection - Optional database connection (for transactions)
 */
const createStockReportEntry = async (transactionData, connection = null) => {
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

    const dbConnection = connection || pool;

    // Get inventory item details
    const [items] = await dbConnection.execute(
      'SELECT * FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    );
    
    if (items.length === 0) {
      console.error('[StockTracking] Inventory item not found:', inventoryItemId);
      return;
    }

    const item = items[0];

    // Use provided scope if available (for returns), otherwise use item's scope
    const finalScopeType = transactionData.scopeType || item.scope_type;
    const finalScopeId = transactionData.scopeId !== null && transactionData.scopeId !== undefined ? transactionData.scopeId : item.scope_id;
    const finalScopeName = transactionData.scopeId !== null && transactionData.scopeId !== undefined ? String(transactionData.scopeId) : String(item.scope_id);

    console.log(`[StockTracking] Creating transaction record for item ${inventoryItemId}, type: ${transactionType}, change: ${quantityChange}, scopeType: ${finalScopeType}, scopeId: ${finalScopeId}`);
    
    // Insert transaction record
    await dbConnection.execute(`
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
      finalScopeType, 
      finalScopeId, 
      finalScopeName, // scope_name is same as scope_id in current implementation
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
    console.error('[StockTracking] Error stack:', error.stack);
    throw error; // Re-throw to ensure transaction rollback
  }
};

/**
 * Create transaction record for sale
 * @param {number} inventoryItemId - The inventory item ID
 * @param {number} quantity - The quantity sold (positive value)
 * @param {number} unitPrice - The unit price
 * @param {number} userId - The user ID who made the sale
 * @param {string} userName - The user name
 * @param {string} userRole - The user role
 * @param {number} saleId - The sale ID
 * @param {object} connection - Optional database connection (for transactions)
 */
const createSaleTransaction = async (inventoryItemId, quantity, unitPrice, userId, userName, userRole, saleId, connection = null) => {
  try {
    console.log(`[StockTracking] Creating sale transaction for item ${inventoryItemId}, quantity: ${quantity}`);
    
    const quantityChange = -Math.abs(quantity); // Sales reduce stock
    const dbConnection = connection || pool;
    
    // Get current stock to calculate previous quantity
    const [items] = await dbConnection.execute(
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
    }, connection);
    
    console.log(`[StockTracking] Successfully created sale transaction for item ${inventoryItemId}`);
  } catch (error) {
    console.error(`[StockTracking] Error creating sale transaction for item ${inventoryItemId}:`, error);
    throw error; // Re-throw to see what's failing
  }
};

/**
 * Create transaction record for return
 * @param {number} inventoryItemId - The inventory item ID
 * @param {number} quantity - The quantity returned (positive value)
 * @param {number} unitPrice - The unit price
 * @param {number} userId - The user ID who processed the return
 * @param {string} userName - The user name
 * @param {string} userRole - The user role
 * @param {number} returnId - The return ID
 * @param {object} connection - Optional database connection (for transactions)
 * @param {string} scopeType - The scope type (BRANCH or WAREHOUSE) from the original sale
 * @param {string|number} scopeId - The scope ID from the original sale
 */
const createReturnTransaction = async (
  inventoryItemId,
  quantity,
  unitPrice,
  userId,
  userName,
  userRole,
  returnId,
  connection = null,
  scopeType = null,
  scopeId = null,
  affectStock = true // when false, we log the return without changing stock levels
) => {
  try {
    console.log(`[StockTracking] Creating return transaction for item ${inventoryItemId}, quantity: ${quantity}, scopeType: ${scopeType}, scopeId: ${scopeId}`);
    
    const quantityChange = Math.abs(quantity); // Returns increase stock when affectStock is true
    const dbConnection = connection || pool;
    
    // Get current stock to calculate previous quantity
    const [items] = await dbConnection.execute(
      'SELECT current_stock FROM inventory_items WHERE id = ?',
      [inventoryItemId]
    );
    
    if (items.length === 0) {
      console.error(`[StockTracking] Inventory item not found: ${inventoryItemId}`);
      return;
    }
    
    const currentStock = items[0].current_stock;
    let previousQuantity = currentStock - Math.abs(quantity);
    let newQuantity = currentStock;

    // If we are not affecting stock (log-only), keep previous/new the same
    if (!affectStock) {
      previousQuantity = currentStock;
      newQuantity = currentStock;
    }
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
      returnId,
      scopeType,
      scopeId
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
      returnId,
      scopeType,
      scopeId
    }, connection);
    
    console.log(`[StockTracking] Successfully created return transaction for item ${inventoryItemId}`);
  } catch (error) {
    console.error(`[StockTracking] Error creating return transaction for item ${inventoryItemId}:`, error);
    throw error; // Re-throw to see what's failing
  }
};

/**
 * Create transaction record for stock adjustment
 * @param {number} inventoryItemId - The inventory item ID
 * @param {number} previousQuantity - The previous stock quantity
 * @param {number} newQuantity - The new stock quantity
 * @param {number} userId - The user ID who made the adjustment
 * @param {string} userName - The user name
 * @param {string} userRole - The user role
 * @param {string} reason - The reason for adjustment
 * @param {object} connection - Optional database connection (for transactions)
 */
const createAdjustmentTransaction = async (inventoryItemId, previousQuantity, newQuantity, userId, userName, userRole, reason, connection = null) => {
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
  }, connection);
};

module.exports = { 
  createStockReportEntry,
  createSaleTransaction,
  createReturnTransaction,
  createAdjustmentTransaction
};