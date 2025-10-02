const { pool } = require('../config/database');

// @desc    Get reports summary
// @route   GET /api/reports/summary
// @access  Private (Admin, Warehouse Keeper)
const getReportsSummary = async (req, res) => {
  try {
    const user = req.user;
    
    // Simple summary data for now
    const summary = {
      totalSales: 0,
      totalRevenue: 0,
      totalCustomers: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalInventory: 0,
      totalCompanies: 0,
      totalTransfers: 0,
      totalLedgerEntries: 0,
      totalBillingRecords: 0
    };

    // Get counts from different tables
    try {
      // Count companies - filter by warehouse for warehouse keepers
      let companiesQuery = 'SELECT COUNT(*) as count FROM companies';
      let companiesParams = [];
      
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        companiesQuery += ' WHERE warehouse_id = ?';
        companiesParams.push(user.warehouseId);
      }
      
      const [companiesResult] = await pool.execute(companiesQuery, companiesParams);
      summary.totalCompanies = companiesResult[0]?.count || 0;

      // Count ledger entries - filter by warehouse for warehouse keepers
      let ledgerQuery = 'SELECT COUNT(*) as count FROM ledger';
      let ledgerParams = [];
      
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        ledgerQuery += ' WHERE warehouse_id = ?';
        ledgerParams.push(user.warehouseId);
      }
      
      const [ledgerResult] = await pool.execute(ledgerQuery, ledgerParams);
      summary.totalLedgerEntries = ledgerResult[0]?.count || 0;

      // Count sales (if sales table exists) - filter by warehouse for warehouse keepers
      try {
        let salesQuery = 'SELECT COUNT(*) as count FROM sales';
        let salesParams = [];
        
        if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          salesQuery += ' WHERE warehouse_id = ?';
          salesParams.push(user.warehouseId);
        }
        
        const [salesResult] = await pool.execute(salesQuery, salesParams);
        summary.totalSales = salesResult[0]?.count || 0;
      } catch (error) {
        // Sales table might not exist
        summary.totalSales = 0;
      }

      // Count inventory items (if inventory_items table exists) - filter by warehouse for warehouse keepers
      try {
        let inventoryQuery = 'SELECT COUNT(*) as count FROM inventory_items';
        let inventoryParams = [];
        
        if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
          inventoryQuery += ' WHERE scope_type = ? AND scope_id = ?';
          inventoryParams.push('WAREHOUSE', user.warehouseId);
        }
        
        const [inventoryResult] = await pool.execute(inventoryQuery, inventoryParams);
        summary.totalProducts = inventoryResult[0]?.count || 0;
      } catch (error) {
        // Inventory table might not exist
        summary.totalProducts = 0;
      }

      // Count transfers (if transfers table exists)
      try {
        const [transfersResult] = await pool.execute('SELECT COUNT(*) as count FROM transfers');
        summary.totalTransfers = transfersResult[0]?.count || 0;
      } catch (error) {
        // Transfers table might not exist
        summary.totalTransfers = 0;
      }

    } catch (error) {
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving reports summary',
      error: error.message
    });
  }
};

// @desc    Get sales reports
// @route   GET /api/reports/sales
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getSalesReports = async (req, res) => {
  try {
    const user = req.user;
    const { branch, cashier, startDate, endDate } = req.query;
    
    // Sales data structure
    const salesData = {
      totalSales: 0,
      totalRevenue: 0,
      totalTransactions: 0,
      averageTicket: 0,
      salesByBranch: {},
      salesByCashier: {},
      salesByDate: {},
      topProducts: [],
      recentSales: []
    };

    // Get sales data from database if available
    try {
      let query = 'SELECT * FROM sales WHERE 1=1';
      const params = [];
      
      // Filter by warehouse for warehouse keepers
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        query += ' AND warehouse_id = ?';
        params.push(user.warehouseId);
      }

      if (branch) {
        query += ' AND branch_id = ?';
        params.push(branch);
      }
      if (cashier) {
        query += ' AND cashier_id = ?';
        params.push(cashier);
      }
      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      const [salesResult] = await pool.execute(query, params);
      salesData.totalSales = salesResult.length;
      salesData.totalTransactions = salesResult.length;
      salesData.totalRevenue = salesResult.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      salesData.averageTicket = salesResult.length > 0 ? salesData.totalRevenue / salesResult.length : 0;
      
      // Process sales by branch
      salesResult.forEach(sale => {
        const branchId = sale.branch_id || 'Unknown';
        if (!salesData.salesByBranch[branchId]) {
          salesData.salesByBranch[branchId] = { sales: 0, transactions: 0 };
        }
        salesData.salesByBranch[branchId].sales += sale.total_amount || 0;
        salesData.salesByBranch[branchId].transactions += 1;
      });
      
      // Process sales by cashier
      salesResult.forEach(sale => {
        const cashierId = sale.cashier_id || 'Unknown';
        if (!salesData.salesByCashier[cashierId]) {
          salesData.salesByCashier[cashierId] = { sales: 0, transactions: 0 };
        }
        salesData.salesByCashier[cashierId].sales += sale.total_amount || 0;
        salesData.salesByCashier[cashierId].transactions += 1;
      });
      
      // Process sales by date
      salesResult.forEach(sale => {
        const date = sale.created_at ? sale.created_at.split('T')[0] : 'Unknown';
        if (!salesData.salesByDate[date]) {
          salesData.salesByDate[date] = { sales: 0, transactions: 0, avgTicket: 0 };
        }
        salesData.salesByDate[date].sales += sale.total_amount || 0;
        salesData.salesByDate[date].transactions += 1;
        salesData.salesByDate[date].avgTicket = salesData.salesByDate[date].sales / salesData.salesByDate[date].transactions;
      });
      
      // Convert salesByDate to array format for charts
      salesData.salesByDate = Object.entries(salesData.salesByDate).map(([date, data]) => ({
        date,
        sales: data.sales,
        transactions: data.transactions,
        avgTicket: data.avgTicket
      }));
      
      // Ensure salesByDate is always an array
      if (!Array.isArray(salesData.salesByDate)) {
        salesData.salesByDate = [];
      }
      
      // Recent sales with proper field mapping
      salesData.recentSales = salesResult.slice(0, 10).map(sale => ({
        date: sale.created_at ? sale.created_at.split('T')[0] : 'Unknown',
        created_at: sale.created_at,
        sales: sale.total_amount || 0,
        total_amount: sale.total_amount || 0,
        cashier: sale.cashier_id || 'Unknown',
        cashier_name: sale.cashier_id || 'Unknown',
        status: sale.status || 'Completed'
      }));
      
      // Ensure recentSales is always an array
      if (!Array.isArray(salesData.recentSales)) {
        salesData.recentSales = [];
      }
    } catch (error) {
      // Sales table might not exist
      // Ensure arrays are initialized even if sales table doesn't exist
      if (!Array.isArray(salesData.salesByDate)) {
        salesData.salesByDate = [];
      }
      if (!Array.isArray(salesData.recentSales)) {
        salesData.recentSales = [];
      }
    }

    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales reports',
      error: error.message
    });
  }
};

// @desc    Get inventory reports
// @route   GET /api/reports/inventory
// @access  Private (Admin, Warehouse Keeper, Cashier)
const getInventoryReports = async (req, res) => {
  try {
    const user = req.user;
    
    const inventoryData = {
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue: 0,
      turnoverRate: 0,
      itemsByCategory: {},
      lowStockList: [],
      outOfStockList: [],
      movementData: [],
      topSellingItems: []
    };

    // Get inventory data from database if available
    try {
      let inventoryQuery = 'SELECT * FROM inventory_items';
      let inventoryParams = [];
      
      // Filter by warehouse for warehouse keepers
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        inventoryQuery += ' WHERE scope_type = ? AND scope_id = ?';
        inventoryParams.push('WAREHOUSE', user.warehouseId);
      }
      
      const [inventoryResult] = await pool.execute(inventoryQuery, inventoryParams);
      inventoryData.totalItems = inventoryResult.length;
      
      inventoryData.lowStockItems = inventoryResult.filter(item => 
        item.quantity <= (item.min_stock_level || 10)
      ).length;
      
      inventoryData.outOfStockItems = inventoryResult.filter(item => 
        item.quantity <= 0
      ).length;
      
      inventoryData.totalValue = inventoryResult.reduce((sum, item) => 
        sum + (item.quantity * (item.cost_price || 0)), 0
      );
      
      // Process low stock items
      const lowStockItems = inventoryResult.filter(item => 
        item.quantity <= (item.min_stock_level || 10)
      );
      
      inventoryData.lowStockList = lowStockItems.slice(0, 10).map(item => ({
        name: item.name,
        item_name: item.name,
        current: item.quantity,
        current_stock: item.quantity,
        quantity: item.quantity,
        min: item.min_stock_level || 10,
        min_stock_level: item.min_stock_level || 10,
        category: item.category
      }));
      
      inventoryData.outOfStockList = inventoryResult.filter(item => 
        item.quantity <= 0
      ).slice(0, 10);
      
      // Calculate items by category
      inventoryResult.forEach(item => {
        const category = item.category || 'Uncategorized';
        inventoryData.itemsByCategory[category] = (inventoryData.itemsByCategory[category] || 0) + 1;
      });
      
      // Calculate turnover rate (simplified)
      inventoryData.turnoverRate = inventoryData.totalItems > 0 ? 
        (inventoryData.totalValue / inventoryData.totalItems / 1000).toFixed(1) : 0;
      
      // Get real movement data from sales and inventory transactions
      try {
        const movementQuery = `
          SELECT 
            DATE(created_at) as date,
            SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) as received,
            SUM(CASE WHEN transaction_type = 'OUT' THEN quantity ELSE 0 END) as sold,
            SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity ELSE 0 END) as returned
          FROM inventory_transactions 
          WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          GROUP BY DATE(created_at)
          ORDER BY date
        `;
        const [movementResult] = await pool.execute(movementQuery);
        
        if (movementResult.length > 0) {
          inventoryData.movementData = movementResult.map(row => ({
            date: row.date,
            received: row.received || 0,
            sold: row.sold || 0,
            returned: row.returned || 0
          }));
        } else {
          // If no transaction data, show empty movement
          inventoryData.movementData = [];
        }
      } catch (error) {
        inventoryData.movementData = [];
      }
      
      // Get real top selling items from sales data
      try {
        const topSellingQuery = `
          SELECT 
            i.name,
            i.item_name,
            SUM(si.quantity) as sold,
            SUM(si.quantity * si.price) as revenue
          FROM sales_items si
          JOIN inventory_items i ON si.inventory_item_id = i.id
          JOIN sales s ON si.sale_id = s.id
          WHERE s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
          GROUP BY i.id, i.name, i.item_name
          ORDER BY sold DESC
          LIMIT 5
        `;
        const [topSellingResult] = await pool.execute(topSellingQuery);
        
        if (topSellingResult.length > 0) {
          inventoryData.topSellingItems = topSellingResult.map(item => ({
            name: item.name,
            item_name: item.name,
            sold: item.sold || 0,
            quantity_sold: item.sold || 0,
            revenue: item.revenue || 0
          }));
        } else {
          // If no sales data, show empty list
          inventoryData.topSellingItems = [];
        }
      } catch (error) {
        inventoryData.topSellingItems = [];
      }
    } catch (error) {
      // Inventory table might not exist
    }

    res.json({
      success: true,
      data: inventoryData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving inventory reports',
      error: error.message
    });
  }
};

// @desc    Get ledger reports
// @route   GET /api/reports/ledger
// @access  Private (Admin, Warehouse Keeper)
const getLedgerReports = async (req, res) => {
  try {
    const user = req.user;
    const { startDate, endDate } = req.query;
    
    const ledgerData = {
      totalEntries: 0,
      totalDebit: 0,
      totalCredit: 0,
      balance: 0,
      entriesByType: {},
      recentEntries: []
    };

    // Get ledger data from database if available
    try {
      let query = 'SELECT * FROM ledger WHERE 1=1';
      const params = [];
      
      // Filter by warehouse for warehouse keepers
      if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
        query += ' AND warehouse_id = ?';
        params.push(user.warehouseId);
      }

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      const [ledgerResult] = await pool.execute(query, params);
      ledgerData.totalEntries = ledgerResult.length;
      
      ledgerData.totalDebit = ledgerResult.reduce((sum, entry) => 
        sum + (entry.debit_amount || 0), 0
      );
      
      ledgerData.totalCredit = ledgerResult.reduce((sum, entry) => 
        sum + (entry.credit_amount || 0), 0
      );
      
      ledgerData.balance = ledgerData.totalCredit - ledgerData.totalDebit;
      ledgerData.recentEntries = ledgerResult.slice(0, 10); // Last 10 entries
    } catch (error) {
      // Ledger table might not exist
    }

    res.json({
      success: true,
      data: ledgerData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving ledger reports',
      error: error.message
    });
  }
};

// @desc    Get financial reports
// @route   GET /api/reports/financial
// @access  Private (Admin)
const getFinancialReports = async (req, res) => {
  try {
    const { period, year, quarter, dateFrom, dateTo } = req.query;
    
    const financialData = {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      revenueByPeriod: {},
      expensesByPeriod: {},
      profitMargin: 0,
      cashFlow: 0
    };

    // Get financial data from database if available
    try {
      // This would typically involve complex queries across multiple tables
      // For now, return basic structure
      const [salesResult] = await pool.execute('SELECT SUM(total_amount) as total FROM sales');
      const [expenseResult] = await pool.execute('SELECT SUM(amount) as total FROM expenses');
      
      financialData.totalRevenue = salesResult[0]?.total || 0;
      financialData.totalExpenses = expenseResult[0]?.total || 0;
      financialData.netProfit = financialData.totalRevenue - financialData.totalExpenses;
      financialData.profitMargin = financialData.totalRevenue > 0 ? 
        (financialData.netProfit / financialData.totalRevenue) * 100 : 0;
    } catch (error) {
      // Financial tables might not exist
    }

    res.json({
      success: true,
      data: financialData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving financial reports',
      error: error.message
    });
  }
};

module.exports = {
  getReportsSummary,
  getSalesReports,
  getInventoryReports,
  getLedgerReports,
  getFinancialReports
};


