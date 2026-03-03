const { pool } = require('../config/database');

// @desc    Get stock reports
// @route   GET /api/stock-reports
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getStockReports = async (req, res) => {
  try {
    console.log('[StockReportController] getStockReports called');
    const user = req.user;
    const { 
      warehouse, 
      category, 
      status, 
      dateFrom, 
      dateTo,
      lowStock,
      outOfStock,
      page = 1,
      limit = 25,
      searchTerm,
      scopeType,
      scopeId,
      transactionType,
      itemCategory,
      startDate,
      endDate,
      userRole
    } = req.query;
    
    // Build query conditions for inventory transactions
    let whereConditions = [];
    let params = [];
    
    // Role-based filtering - use stock_reports scope (it.scope_type, it.scope_id) for returns
    // For cashiers, we need to match by branch name since stock_reports stores scope_id as string (branch name)
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      // Get warehouse name to match against stock_reports scope_id
      const [warehouses] = await pool.execute('SELECT id, name FROM warehouses WHERE id = ?', [user.warehouseId]);
      if (warehouses.length > 0) {
        const warehouse = warehouses[0];
        // Use COLLATE utf8mb4_bin for string comparisons to avoid collation issues
        whereConditions.push(`(
          (it.scope_type = 'WAREHOUSE' AND (
            CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin OR 
            CAST(it.scope_id AS UNSIGNED) = ? OR
            CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          )) OR 
          (it.scope_type IS NULL AND ii.scope_type = 'WAREHOUSE' AND (
            CAST(ii.scope_id AS UNSIGNED) = ? OR 
            CAST(ii.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          ))
        )`);
        params.push(
          warehouse.name,           // Match warehouse name (string)
          warehouse.id,            // Match warehouse ID (number)
          String(warehouse.id),    // Match warehouse ID as string
          warehouse.id,            // For inventory_items scope_id (numeric)
          String(warehouse.id)     // For inventory_items scope_id (string)
        );
      }
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // Get branch name and ID to match against stock_reports scope_id
      const [branches] = await pool.execute('SELECT id, name FROM branches WHERE id = ?', [user.branchId]);
      if (branches.length > 0) {
        const branch = branches[0];
        // Filter by stock_reports scope - handle both branch name (string) and branch ID (number)
        // Also handle NULL scope_type (legacy sales data) by checking inventory_items scope
        // Use COLLATE utf8mb4_bin for string comparisons to avoid collation issues
        whereConditions.push(`(
          (it.scope_type = 'BRANCH' AND (
            CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin OR 
            CAST(it.scope_id AS UNSIGNED) = ? OR
            CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          )) OR 
          (it.scope_type IS NULL AND ii.scope_type = 'BRANCH' AND (
            CAST(ii.scope_id AS UNSIGNED) = ? OR 
            CAST(ii.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          ))
        )`);
        params.push(
          branch.name,           // Match branch name (string)
          branch.id,            // Match branch ID (number)
          String(branch.id),    // Match branch ID as string
          branch.id,            // For inventory_items scope_id (numeric)
          String(branch.id)     // For inventory_items scope_id (string)
        );
      }
    }
    
    // Additional filters
    if (searchTerm) {
      whereConditions.push('(ii.name LIKE ? OR ii.sku LIKE ?)');
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    if (scopeType && scopeType !== 'all') {
      // Filter by stock_reports scope first, fallback to inventory_items scope
      whereConditions.push('(it.scope_type = ? OR (it.scope_type IS NULL AND ii.scope_type = ?))');
      params.push(scopeType, scopeType);
    }
    
    if (scopeId && scopeId !== 'all') {
      // Filter by stock_reports scope_id first, fallback to inventory_items scope_id
      // Use COLLATE utf8mb4_bin for string comparisons to avoid collation issues
      whereConditions.push(`(
        (it.scope_type IS NOT NULL AND (
          CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(it.scope_id AS UNSIGNED) = ? OR
          CAST(it.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
        )) OR 
        (it.scope_type IS NULL AND (
          CAST(ii.scope_id AS UNSIGNED) = ? OR 
          CAST(ii.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
        ))
      )`);
      const scopeIdNum = isNaN(scopeId) ? 0 : parseInt(scopeId);
      params.push(
        scopeId, scopeIdNum, String(scopeId),
        scopeIdNum, String(scopeId)
      );
    }
    
    if (transactionType && transactionType !== 'all') {
      whereConditions.push('it.transaction_type = ?');
      params.push(transactionType);
    }
    
    if (itemCategory && itemCategory !== 'all') {
      whereConditions.push('ii.category = ?');
      params.push(itemCategory);
    }
    
    if (startDate) {
      whereConditions.push('it.created_at >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('it.created_at <= ?');
      params.push(endDate);
    }
    
    if (userRole && userRole !== 'all') {
      whereConditions.push('u.role = ?');
      params.push(userRole);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    
    console.log('[StockReportController] Query conditions:', { whereClause, params, limit, offset });
    
    // Get inventory transactions with pagination and supplier info
    const [transactions] = await pool.execute(`
      SELECT 
        it.id,
        it.inventory_item_id as inventoryItemId,
        it.transaction_type as transactionType,
        it.quantity_change as quantityChange,
        it.previous_quantity as previousQuantity,
        it.new_quantity as newQuantity,
        it.unit_price as unitPrice,
        it.total_value as totalValue,
        it.adjustment_reason as adjustmentReason,
        it.created_at as createdAt,
        ii.name as itemName,
        ii.sku as itemSku,
        ii.category as itemCategory,
        ii.supplier_id as supplierId,
        ii.supplier_name as supplierName,
        ii.purchase_date as purchaseDate,
        ii.purchase_price as purchasePrice,
        ii.created_at as itemCreatedAt,
        c.name as supplierCompanyName,
        c.contact_person as supplierContact,
        c.phone as supplierPhone,
        c.email as supplierEmail,
        u.username as userName,
        u.role as userRole,
        COALESCE(it.scope_type, ii.scope_type) as scopeType,
        COALESCE(it.scope_id, ii.scope_id) as scopeName,
        b.name as branchName,
        w.name as warehouseName
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
      LEFT JOIN companies c ON ii.supplier_id = c.id
      LEFT JOIN branches b ON (
        COALESCE(it.scope_type, ii.scope_type) = 'BRANCH' AND (
          CAST(COALESCE(it.scope_id, ii.scope_id) AS CHAR) COLLATE utf8mb4_bin = CAST(b.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(COALESCE(it.scope_id, ii.scope_id) AS UNSIGNED) = b.id OR
          CAST(b.id AS CHAR) COLLATE utf8mb4_bin = CAST(COALESCE(it.scope_id, ii.scope_id) AS CHAR) COLLATE utf8mb4_bin
        )
      )
      LEFT JOIN warehouses w ON (
        COALESCE(it.scope_type, ii.scope_type) = 'WAREHOUSE' AND (
          CAST(COALESCE(it.scope_id, ii.scope_id) AS CHAR) COLLATE utf8mb4_bin = CAST(w.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(COALESCE(it.scope_id, ii.scope_id) AS UNSIGNED) = w.id OR
          CAST(w.id AS CHAR) COLLATE utf8mb4_bin = CAST(COALESCE(it.scope_id, ii.scope_id) AS CHAR) COLLATE utf8mb4_bin
        )
      )
      ${whereClause}
      ORDER BY it.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // Get total count for pagination
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
      ${whereClause}
    `, params);
    
    const totalCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Debug: Log the transactions data to see what's being returned
    console.log('[StockReportController] Returning transactions:', transactions.length, 'items');
    if (transactions.length > 0) {
      console.log('[StockReportController] Sample transaction:', transactions[0]);
    }
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching stock reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stock reports',
      error: error.message
    });
  }
};

// @desc    Get stock report summary
// @route   GET /api/stock-reports/summary
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getStockReportSummary = async (req, res) => {
  try {
    const user = req.user;
    
    // Build query conditions
    let whereConditions = [];
    let params = [];
    
    // Role-based filtering
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', user.warehouseId);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, use branch ID directly (inventory_items stores numeric IDs)
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', user.branchId);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get summary statistics including negative quantities
    const [summaryResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_items,
        SUM(current_stock) as total_stock,
        SUM(current_stock * cost_price) as total_value,
        SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN current_stock < 0 THEN 1 ELSE 0 END) as negative_stock,
        SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as zero_stock,
        SUM(CASE WHEN current_stock <= min_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN current_stock > min_stock_level THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN current_stock < 0 THEN current_stock ELSE 0 END) as total_negative_quantity
      FROM inventory_items
      ${whereClause}
    `, params);
    
    const summary = summaryResult[0] || {
      total_items: 0,
      total_stock: 0,
      total_value: 0,
      out_of_stock: 0,
      negative_stock: 0,
      zero_stock: 0,
      low_stock: 0,
      in_stock: 0,
      total_negative_quantity: 0
    };
    
    res.json({
      success: true,
      data: {
        totalItems: summary.total_items,
        totalStock: summary.total_stock,
        totalValue: summary.total_value,
        outOfStock: summary.out_of_stock,
        negativeStock: summary.negative_stock,
        zeroStock: summary.zero_stock,
        lowStock: summary.low_stock,
        inStock: summary.in_stock,
        totalNegativeQuantity: summary.total_negative_quantity
      }
    });
    
  } catch (error) {
    console.error('Error fetching stock report summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stock report summary',
      error: error.message
    });
  }
};

// @desc    Get stock report statistics
// @route   GET /api/stock-reports/statistics
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getStockReportStatistics = async (req, res) => {
  try {
    console.log('[StockReportController] getStockReportStatistics called');
    const user = req.user;
    const { 
      scopeType, 
      scopeId, 
      startDate, 
      endDate,
      category 
    } = req.query;
    
    // Build query conditions
    let whereConditions = [];
    let params = [];
    
    // Role-based filtering
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      whereConditions.push('it.scope_type = ? AND it.scope_id = ?');
      params.push('WAREHOUSE', user.warehouseId);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, use branch ID directly (inventory_items stores numeric IDs)
      whereConditions.push('it.scope_type = ? AND it.scope_id = ?');
      params.push('BRANCH', user.branchId);
    }
    
    // Additional filters
    if (scopeType && scopeType !== 'all') {
      whereConditions.push('it.scope_type = ?');
      params.push(scopeType);
    }
    
    if (scopeId && scopeId !== 'all') {
      whereConditions.push('it.scope_id = ?');
      params.push(scopeId);
    }
    
    if (category && category !== 'all') {
      whereConditions.push('ii.category = ?');
      params.push(category);
    }
    
    if (startDate) {
      whereConditions.push('it.created_at >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('it.created_at <= ?');
      params.push(endDate);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get overall statistics
    const [overallResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN it.transaction_type = 'PURCHASE' THEN it.quantity_change ELSE 0 END) as total_purchased,
        SUM(CASE WHEN it.transaction_type = 'SALE' THEN it.quantity_change ELSE 0 END) as total_sold,
        SUM(CASE WHEN it.transaction_type = 'RETURN' THEN it.quantity_change ELSE 0 END) as total_returned,
        SUM(CASE WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity_change ELSE 0 END) as total_adjusted,
        SUM(CASE WHEN it.transaction_type = 'TRANSFER_IN' THEN it.quantity_change ELSE 0 END) as total_transferred_in,
        SUM(CASE WHEN it.transaction_type = 'TRANSFER_OUT' THEN it.quantity_change ELSE 0 END) as total_transferred_out
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      ${whereClause}
    `, params);
    
    const overall = overallResult[0] || {
      totalTransactions: 0,
      totalPurchased: 0,
      totalSold: 0,
      totalReturned: 0,
      totalAdjusted: 0,
      totalTransferredIn: 0,
      totalTransferredOut: 0
    };
    
    // Get transaction types breakdown
    const [transactionTypesResult] = await pool.execute(`
      SELECT 
        it.transaction_type,
        COUNT(*) as count,
        SUM(it.quantity_change) as total_quantity
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      ${whereClause}
      GROUP BY it.transaction_type
      ORDER BY count DESC
    `, params);
    
    const transactionTypes = transactionTypesResult.map(row => ({
      transactionType: row.transaction_type,
      count: row.count,
      totalQuantity: row.total_quantity || 0
    }));
    
    // Get top items by transaction count
    const [topItemsResult] = await pool.execute(`
      SELECT 
        it.inventory_item_id,
        ii.name as item_name,
        ii.sku as item_sku,
        ii.category as item_category,
        COUNT(*) as transaction_count,
        SUM(it.quantity_change) as total_quantity
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      ${whereClause.replace('inventory_transactions', 'it')}
      GROUP BY it.inventory_item_id, ii.name, ii.sku, ii.category
      ORDER BY transaction_count DESC
      LIMIT 10
    `, params);
    
    const topItems = topItemsResult.map(item => ({
      inventoryItemId: item.inventory_item_id,
      itemName: item.item_name,
      itemSku: item.item_sku,
      itemCategory: item.item_category,
      transactionCount: item.transaction_count,
      totalQuantity: item.total_quantity || 0
    }));
    
    // Get daily activity (last 30 days)
    const [dailyActivityResult] = await pool.execute(`
      SELECT 
        DATE(it.created_at) as date,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN it.transaction_type = 'PURCHASE' THEN it.quantity_change ELSE 0 END) as purchased,
        SUM(CASE WHEN it.transaction_type = 'SALE' THEN it.quantity_change ELSE 0 END) as sold,
        SUM(CASE WHEN it.transaction_type = 'RETURN' THEN it.quantity_change ELSE 0 END) as returned
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      WHERE it.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${whereConditions.length > 0 ? 'AND ' + whereConditions.join(' AND ') : ''}
      GROUP BY DATE(it.created_at)
      ORDER BY date DESC
      LIMIT 30
    `, params);
    
    const dailyActivity = dailyActivityResult.map(day => ({
      date: day.date,
      transactionCount: day.transaction_count,
      purchased: day.purchased || 0,
      sold: day.sold || 0,
      returned: day.returned || 0
    }));
    
    const statistics = {
      overall,
      transactionTypes,
      topItems,
      dailyActivity
    };
    
    res.json({
      success: true,
      data: statistics
    });
    
  } catch (error) {
    console.error('Error fetching stock report statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stock report statistics',
      error: error.message
    });
  }
};

// @desc    Get stock summary
// @route   GET /api/stock-reports/summary
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getStockSummary = async (req, res) => {
  try {
    const user = req.user;
    const { page = 1, limit = 25, searchTerm, scopeType, scopeId, itemCategory } = req.query;
    
    // Build query conditions
    let whereConditions = [];
    let params = [];
    
    // Role-based filtering
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      whereConditions.push('ii.scope_type = ? AND ii.scope_id = ?');
      params.push('WAREHOUSE', user.warehouseId);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, use branch ID directly (inventory_items stores numeric IDs)
      whereConditions.push('ii.scope_type = ? AND ii.scope_id = ?');
      params.push('BRANCH', user.branchId);
    }
    
    // Additional filters
    if (searchTerm) {
      whereConditions.push('(ii.name LIKE ? OR ii.sku LIKE ?)');
      params.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    
    if (scopeType && scopeType !== 'all') {
      whereConditions.push('ii.scope_type = ?');
      params.push(scopeType);
    }
    
    if (scopeId && scopeId !== 'all') {
      whereConditions.push('ii.scope_id = ?');
      params.push(scopeId);
    }
    
    if (itemCategory && itemCategory !== 'all') {
      whereConditions.push('ii.category = ?');
      params.push(itemCategory);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    
    // Get stock summary with transaction totals and supplier info
    const [summaryResult] = await pool.execute(`
      SELECT 
        ii.id,
        ii.name as itemName,
        ii.sku as itemSku,
        ii.category as itemCategory,
        ii.current_stock as currentStock,
        ii.min_stock_level as minStockLevel,
        ii.max_stock_level as maxStockLevel,
        ii.cost_price as costPrice,
        ii.selling_price as sellingPrice,
        ii.supplier_id as supplierId,
        ii.supplier_name as supplierName,
        ii.purchase_date as purchaseDate,
        ii.purchase_price as purchasePrice,
        ii.created_at as itemCreatedAt,
        c.name as supplierCompanyName,
        c.contact_person as supplierContact,
        c.phone as supplierPhone,
        c.email as supplierEmail,
        b.name as branchName,
        w.name as warehouseName,
        ii.scope_type as scopeType,
        ii.scope_id as scopeId,
        (ii.current_stock * ii.cost_price) as currentStockValue,
        COALESCE(purchases.total_purchased, 0) as totalPurchased,
        COALESCE(sales.total_sold, 0) as totalSold,
        COALESCE(returns.total_returned, 0) as totalReturned,
        COALESCE(adjustments.total_adjusted, 0) as totalAdjusted,
        COALESCE(transfers_in.total_transferred_in, 0) as totalTransferredIn,
        COALESCE(transfers_out.total_transferred_out, 0) as totalTransferredOut
      FROM inventory_items ii
      LEFT JOIN companies c ON ii.supplier_id = c.id
      LEFT JOIN branches b ON ii.scope_type = 'BRANCH' AND ii.scope_id = b.id
      LEFT JOIN warehouses w ON ii.scope_type = 'WAREHOUSE' AND ii.scope_id = w.id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(sr.quantity_change) as total_purchased
        FROM stock_reports sr
        INNER JOIN inventory_items ii_p ON sr.inventory_item_id = ii_p.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'PURCHASE'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_p.scope_type AND (
            sr.scope_id = ii_p.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_p.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_p.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) purchases ON ii.id = purchases.inventory_item_id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(ABS(sr.quantity_change)) as total_sold
        FROM stock_reports sr
        INNER JOIN inventory_items ii_s ON sr.inventory_item_id = ii_s.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'SALE'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_s.scope_type AND (
            sr.scope_id = ii_s.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_s.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_s.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) sales ON ii.id = sales.inventory_item_id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(sr.quantity_change) as total_returned
        FROM stock_reports sr
        INNER JOIN inventory_items ii_r ON sr.inventory_item_id = ii_r.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'RETURN'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_r.scope_type AND (
            sr.scope_id = ii_r.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_r.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_r.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) returns ON ii.id = returns.inventory_item_id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(sr.quantity_change) as total_adjusted
        FROM stock_reports sr
        INNER JOIN inventory_items ii_a ON sr.inventory_item_id = ii_a.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'ADJUSTMENT'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_a.scope_type AND (
            sr.scope_id = ii_a.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_a.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_a.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) adjustments ON ii.id = adjustments.inventory_item_id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(sr.quantity_change) as total_transferred_in
        FROM stock_reports sr
        INNER JOIN inventory_items ii_ti ON sr.inventory_item_id = ii_ti.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'TRANSFER_IN'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_ti.scope_type AND (
            sr.scope_id = ii_ti.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_ti.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_ti.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) transfers_in ON ii.id = transfers_in.inventory_item_id
      LEFT JOIN (
        SELECT sr.inventory_item_id, SUM(sr.quantity_change) as total_transferred_out
        FROM stock_reports sr
        INNER JOIN inventory_items ii_to ON sr.inventory_item_id = ii_to.id
        LEFT JOIN branches b_sr ON sr.scope_type = 'BRANCH' AND (sr.scope_id = b_sr.name OR sr.scope_id = b_sr.id)
        LEFT JOIN warehouses w_sr ON sr.scope_type = 'WAREHOUSE' AND (sr.scope_id = w_sr.name OR sr.scope_id = w_sr.id)
        WHERE sr.transaction_type = 'TRANSFER_OUT'
          AND (sr.scope_type IS NULL OR (sr.scope_type = ii_to.scope_type AND (
            sr.scope_id = ii_to.scope_id
            OR (sr.scope_type = 'BRANCH' AND b_sr.id = ii_to.scope_id)
            OR (sr.scope_type = 'WAREHOUSE' AND w_sr.id = ii_to.scope_id)
          )))
        GROUP BY sr.inventory_item_id
      ) transfers_out ON ii.id = transfers_out.inventory_item_id
      ${whereClause}
      ORDER BY ii.name ASC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);
    
    // Get total count for pagination
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM inventory_items ii
      ${whereClause}
    `, params);
    
    const totalCount = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      success: true,
      data: summaryResult,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching stock summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stock summary',
      error: error.message
    });
  }
};

// @desc    Get product stock history
// @route   GET /api/stock-reports/product/:id
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getProductStockHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Get product details with supplier info
    const [productResult] = await pool.execute(`
      SELECT 
        ii.*,
        c.name as supplierCompanyName,
        c.contact_person as supplierContact,
        c.phone as supplierPhone,
        c.email as supplierEmail,
        b.name as branchName,
        w.name as warehouseName
      FROM inventory_items ii
      LEFT JOIN companies c ON ii.supplier_id = c.id
      LEFT JOIN branches b ON ii.scope_type = 'BRANCH' AND ii.scope_id = b.id
      LEFT JOIN warehouses w ON ii.scope_type = 'WAREHOUSE' AND ii.scope_id = w.id
      WHERE ii.id = ?
    `, [id]);
    
    if (productResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const product = productResult[0];
    
    // Get stock history
    const [historyResult] = await pool.execute(`
      SELECT 
        it.id,
        it.inventory_item_id as inventoryItemId,
        it.transaction_type as transactionType,
        it.quantity_change as quantityChange,
        it.previous_quantity as previousQuantity,
        it.new_quantity as newQuantity,
        it.unit_price as unitPrice,
        it.total_value as totalValue,
        it.adjustment_reason as adjustmentReason,
        it.created_at as createdAt,
        u.username as userName,
        u.role as userRole
      FROM stock_reports it
      LEFT JOIN users u ON it.user_id = u.id
      WHERE it.inventory_item_id = ?
      ORDER BY it.created_at DESC
      LIMIT 100
    `, [id]);
    
    // Get summary statistics
    const [summaryResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as total_purchased,
        SUM(CASE WHEN transaction_type = 'SALE' THEN quantity_change ELSE 0 END) as total_sold,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as total_returned,
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as total_adjusted,
        SUM(CASE WHEN transaction_type = 'TRANSFER_IN' THEN quantity_change ELSE 0 END) as total_transferred_in,
        SUM(CASE WHEN transaction_type = 'TRANSFER_OUT' THEN quantity_change ELSE 0 END) as total_transferred_out
      FROM stock_reports
      WHERE inventory_item_id = ?
    `, [id]);
    
    const summary = summaryResult[0] || {
      total_transactions: 0,
      total_purchased: 0,
      total_sold: 0,
      total_returned: 0,
      total_adjusted: 0,
      total_transferred_in: 0,
      total_transferred_out: 0
    };
    
    // Get daily movements (last 30 days)
    const [dailyMovementsResult] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as purchased,
        SUM(CASE WHEN transaction_type = 'SALE' THEN quantity_change ELSE 0 END) as sold,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as returned,
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as adjusted,
        COUNT(*) as transactions
      FROM stock_reports
      WHERE inventory_item_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [id]);
    
    // Get monthly movements (last 12 months)
    const [monthlyMovementsResult] = await pool.execute(`
      SELECT 
        YEAR(created_at) as year,
        MONTH(created_at) as month,
        SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as purchased,
        SUM(CASE WHEN transaction_type = 'SALE' THEN quantity_change ELSE 0 END) as sold,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as returned,
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as adjusted,
        COUNT(*) as transactions
      FROM stock_reports
      WHERE inventory_item_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY year DESC, month DESC
    `, [id]);
    
    res.json({
      success: true,
      data: {
        inventoryItem: product,
        summary: summary,
        dailyMovements: dailyMovementsResult,
        monthlyMovements: monthlyMovementsResult,
        recentTransactions: historyResult
      }
    });
    
  } catch (error) {
    console.error('Error fetching product stock history:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving product stock history',
      error: error.message
    });
  }
};

// @desc    Get stock reports by scope
// @route   GET /api/stock-reports/scope/:scopeType/:scopeId
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getStockReportsByScope = async (req, res) => {
  try {
    const { scopeType, scopeId } = req.params;
    const user = req.user;
    
    // Check permissions
    if (user?.role === 'WAREHOUSE_KEEPER' && 
        (scopeType !== 'WAREHOUSE' || scopeId !== user.warehouseName)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (user?.role === 'CASHIER' && 
        (scopeType !== 'BRANCH' || scopeId !== user.branchName)) {
      // For cashiers, check against branch name instead of branchId
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [user.branchName]);
      const branchName = branches[0]?.name || user.branchName;
      console.log('[StockReportController] Cashier scope check:', {
        branchId: user.branchName,
        branchName: branchName,
        requestedScopeId: scopeId
      });
      
      if (scopeType !== 'BRANCH' || scopeId !== branchName) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }
    
    // Get stock reports for the specific scope with supplier info
    const [reportsResult] = await pool.execute(`
      SELECT 
        it.*,
        ii.name as item_name,
        ii.sku as item_sku,
        ii.category as item_category,
        ii.supplier_id as supplier_id,
        ii.supplier_name as supplier_name,
        ii.purchase_date as purchase_date,
        ii.purchase_price as purchase_price,
        ii.created_at as item_created_at,
        c.name as supplier_company_name,
        c.contact_person as supplier_contact,
        c.phone as supplier_phone,
        c.email as supplier_email,
        u.username as user_name,
        u.role as user_role
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
      LEFT JOIN companies c ON ii.supplier_id = c.id
      WHERE ii.scope_type = ? AND ii.scope_id = ?
      ORDER BY it.created_at DESC
      LIMIT 100
    `, [scopeType, scopeId]);
    
    res.json({
      success: true,
      data: reportsResult
    });
    
  } catch (error) {
    console.error('Error fetching stock reports by scope:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving stock reports by scope',
      error: error.message
    });
  }
};

module.exports = {
  getStockReports,
  getStockReportSummary,
  getStockReportStatistics,
  getStockSummary,
  getProductStockHistory,
  getStockReportsByScope
};