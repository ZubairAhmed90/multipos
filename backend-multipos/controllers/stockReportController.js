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
    
    // Role-based filtering
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseName) {
      whereConditions.push('ii.scope_type = ? AND ii.scope_id = ?');
      params.push('WAREHOUSE', user.warehouseName);
    } else if (user?.role === 'CASHIER' && user?.branchName) {
      // For cashiers, use branch name directly
      whereConditions.push('ii.scope_type = ? AND ii.scope_id = ?');
      params.push('BRANCH', user.branchName);
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
    
    // Get inventory transactions with pagination
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
        u.username as userName,
        u.role as userRole,
        ii.scope_type as scopeType,
        ii.scope_id as scopeName
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
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
      params.push('WAREHOUSE', user.warehouseName);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, get branch name for filtering
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [user.branchName]);
      const branchName = branches[0]?.name || user.branchName;
      console.log('[StockReportController] Cashier branch lookup (summary):', {
        branchId: user.branchName,
        branchName: branchName
      });
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', branchName);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get summary statistics
    const [summaryResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_items,
        SUM(current_stock) as total_stock,
        SUM(current_stock * cost_price) as total_value,
        SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN current_stock <= min_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) as low_stock,
        SUM(CASE WHEN current_stock > min_stock_level THEN 1 ELSE 0 END) as in_stock
      FROM inventory_items
      ${whereClause}
    `, params);
    
    const summary = summaryResult[0] || {
      total_items: 0,
      total_stock: 0,
      total_value: 0,
      out_of_stock: 0,
      low_stock: 0,
      in_stock: 0
    };
    
    res.json({
      success: true,
      data: {
        totalItems: summary.total_items,
        totalStock: summary.total_stock,
        totalValue: summary.total_value,
        outOfStock: summary.out_of_stock,
        lowStock: summary.low_stock,
        inStock: summary.in_stock
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
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('WAREHOUSE', user.warehouseName);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, get branch name for filtering
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [user.branchName]);
      const branchName = branches[0]?.name || user.branchName;
      console.log('[StockReportController] Cashier branch lookup (statistics):', {
        branchId: user.branchName,
        branchName: branchName
      });
      whereConditions.push('scope_type = ? AND scope_id = ?');
      params.push('BRANCH', branchName);
    }
    
    // Additional filters
    if (scopeType && scopeType !== 'all') {
      whereConditions.push('scope_type = ?');
      params.push(scopeType);
    }
    
    if (scopeId && scopeId !== 'all') {
      whereConditions.push('scope_id = ?');
      params.push(scopeId);
    }
    
    if (category && category !== 'all') {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get overall statistics
    const [overallResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as total_purchased,
        SUM(CASE WHEN transaction_type = 'SALE' THEN quantity_change ELSE 0 END) as total_sold,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as total_returned,
        SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as total_adjusted,
        SUM(CASE WHEN transaction_type = 'TRANSFER_IN' THEN quantity_change ELSE 0 END) as total_transferred_in,
        SUM(CASE WHEN transaction_type = 'TRANSFER_OUT' THEN quantity_change ELSE 0 END) as total_transferred_out
      FROM stock_reports
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
        transaction_type,
        COUNT(*) as count,
        SUM(quantity_change) as total_quantity
      FROM stock_reports
      ${whereClause}
      GROUP BY transaction_type
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
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as purchased,
        SUM(CASE WHEN transaction_type = 'SALE' THEN quantity_change ELSE 0 END) as sold,
        SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as returned
      FROM stock_reports
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${whereConditions.length > 0 ? 'AND ' + whereConditions.join(' AND ') : ''}
      GROUP BY DATE(created_at)
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
      params.push('WAREHOUSE', user.warehouseName);
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      // For cashiers, get branch name for filtering
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [user.branchName]);
      const branchName = branches[0]?.name || user.branchName;
      console.log('[StockReportController] Cashier branch lookup (stock summary):', {
        branchId: user.branchName,
        branchName: branchName
      });
      whereConditions.push('ii.scope_type = ? AND ii.scope_id = ?');
      params.push('BRANCH', branchName);
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
    
    // Get stock summary with transaction totals
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
        (ii.current_stock * ii.cost_price) as currentStockValue,
        COALESCE(purchases.total_purchased, 0) as totalPurchased,
        COALESCE(sales.total_sold, 0) as totalSold,
        COALESCE(returns.total_returned, 0) as totalReturned,
        COALESCE(adjustments.total_adjusted, 0) as totalAdjusted,
        COALESCE(transfers_in.total_transferred_in, 0) as totalTransferredIn,
        COALESCE(transfers_out.total_transferred_out, 0) as totalTransferredOut
      FROM inventory_items ii
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_purchased
        FROM stock_reports 
        WHERE transaction_type = 'PURCHASE'
        GROUP BY inventory_item_id
      ) purchases ON ii.id = purchases.inventory_item_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_sold
        FROM stock_reports 
        WHERE transaction_type = 'SALE'
        GROUP BY inventory_item_id
      ) sales ON ii.id = sales.inventory_item_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_returned
        FROM stock_reports 
        WHERE transaction_type = 'RETURN'
        GROUP BY inventory_item_id
      ) returns ON ii.id = returns.inventory_item_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_adjusted
        FROM stock_reports 
        WHERE transaction_type = 'ADJUSTMENT'
        GROUP BY inventory_item_id
      ) adjustments ON ii.id = adjustments.inventory_item_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_transferred_in
        FROM stock_reports 
        WHERE transaction_type = 'TRANSFER_IN'
        GROUP BY inventory_item_id
      ) transfers_in ON ii.id = transfers_in.inventory_item_id
      LEFT JOIN (
        SELECT inventory_item_id, SUM(quantity_change) as total_transferred_out
        FROM stock_reports 
        WHERE transaction_type = 'TRANSFER_OUT'
        GROUP BY inventory_item_id
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
    
    // Get product details
    const [productResult] = await pool.execute(`
      SELECT * FROM inventory_items WHERE id = ?
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
    
    // Get stock reports for the specific scope
    const [reportsResult] = await pool.execute(`
      SELECT 
        it.*,
        ii.name as item_name,
        ii.sku as item_sku,
        ii.category as item_category,
        u.username as user_name,
        u.role as user_role
      FROM stock_reports it
      LEFT JOIN inventory_items ii ON it.inventory_item_id = ii.id
      LEFT JOIN users u ON it.user_id = u.id
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