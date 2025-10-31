const { pool } = require('../config/database');

const isAllCustomersRequest = (customerId) => {
  if (!customerId || typeof customerId !== 'string') {
    return false;
  }

  const normalized = customerId.trim().toLowerCase();
  return normalized === '__all__' || normalized === 'all';
};

const extractCustomerIdentity = (transaction = {}) => {
  let name = transaction.customer_name || null;
  let phone = transaction.customer_phone || null;

  if ((!name || !phone) && transaction.customer_info) {
    try {
      const info = typeof transaction.customer_info === 'string'
        ? JSON.parse(transaction.customer_info)
        : transaction.customer_info;

      if (!name && info && typeof info === 'object') {
        name = info.name || null;
      }

      if (!phone && info && typeof info === 'object') {
        phone = info.phone || null;
      }
    } catch (error) {
      // Ignore parse errors; fall back to existing fields
    }
  }

  return {
    name: name || 'Unknown Customer',
    phone: phone || null
  };
};

// @desc    Get comprehensive customer ledger
// @route   GET /api/customer-ledger/:customerId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getCustomerLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { 
      startDate, 
      endDate, 
      transactionType, 
      paymentMethod,
      limit = 100,
      offset = 0,
      detailed = false
    } = req.query;

    const isAllCustomers = isAllCustomersRequest(customerId);

    console.log('🔍 CUSTOMER LEDGER DEBUG - Query params:', req.query);
    console.log('🔍 CUSTOMER LEDGER DEBUG - detailed parameter:', detailed, 'type:', typeof detailed);

    // Build WHERE conditions for role-based access
    let whereConditions = [];
    let params = [];
    let scopeFilter = null;

    // Role-based filtering - handle both branch_id and branchId for backward compatibility
    const userBranchId = req.user.branch_id || req.user.branchId;
    const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
    
    if (req.user.role === 'CASHIER' && userBranchId) {
      // For cashiers, we need to match by branch name since sales store scope_id as string
      // First get the branch name from the branch_id
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
      if (branches.length > 0) {
        scopeFilter = { type: 'BRANCH', value: branches[0].name };
        whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        params.push(scopeFilter.type, scopeFilter.value);
        console.log('🔍 CASHIER filtering by branch:', scopeFilter.value);
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      // For warehouse keepers, we need to match by warehouse name since sales store scope_id as string
      // First get the warehouse name from the warehouse_id
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
      if (warehouses.length > 0) {
        scopeFilter = { type: 'WAREHOUSE', value: warehouses[0].name };
        whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        params.push(scopeFilter.type, scopeFilter.value);
        console.log('🔍 WAREHOUSE_KEEPER filtering by warehouse:', scopeFilter.value);
      }
    }
    // Admin can see all transactions (no scope restrictions)

    // Customer filtering
    if (!isAllCustomers) {
      whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
      params.push(customerId, customerId, customerId, customerId);
    }

    // Date filtering
    if (startDate) {
      whereConditions.push('s.created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push('s.created_at <= ?');
      params.push(endDate);
    }

    // Transaction type filtering
    if (transactionType && transactionType !== 'all') {
      whereConditions.push('s.payment_status = ?');
      params.push(transactionType);
    }

    // Payment method filtering
    if (paymentMethod && paymentMethod !== 'all') {
      whereConditions.push('s.payment_method = ?');
      params.push(paymentMethod);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build WHERE conditions for returns (simpler - only customer and date filtering)
    let returnsWhereConditions = [];
    let returnsParams = [];

    if (scopeFilter) {
      returnsWhereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      returnsParams.push(scopeFilter.type, scopeFilter.value);
    }

    // Customer filtering for returns
    if (!isAllCustomers) {
      returnsWhereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
      returnsParams.push(customerId, customerId, customerId, customerId);
    }

    // Date filtering for returns (use sr.created_at)
    if (startDate) {
      returnsWhereConditions.push('sr.created_at >= ?');
      returnsParams.push(startDate);
    }
    if (endDate) {
      returnsWhereConditions.push('sr.created_at <= ?');
      returnsParams.push(endDate);
    }

    const returnsWhereClause = returnsWhereConditions.length > 0 ? `WHERE ${returnsWhereConditions.join(' AND ')}` : '';

    // Main query to get all customer transactions (sales + returns)
    const [transactions] = await pool.execute(`
      SELECT 
        s.id as transaction_id,
        s.invoice_no,
        s.scope_type,
        s.scope_id,
        s.created_at as transaction_date,
        s.payment_method,
        s.payment_type,
        s.payment_status,
        s.payment_amount,
        s.credit_amount,
        s.subtotal,
        s.total,
        s.customer_name,
        s.customer_phone,
        s.customer_info,
        s.notes,
        s.status,
        u.username as cashier_name,
        b.name as branch_name,
        w.name as warehouse_name,
        CASE 
          WHEN s.payment_type = 'OUTSTANDING_SETTLEMENT' THEN 'SETTLEMENT'
          ELSE 'SALE'
        END as transaction_type,
        -- Use actual payment_amount and credit_amount from database
        s.payment_amount as paid_amount,
        s.credit_amount as credit_amount,
        -- Amount is the current bill subtotal only
        s.subtotal as amount,
        NULL as return_id,
        NULL as return_reason,
        NULL as return_refund_amount
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
      ${whereClause}
      
      UNION ALL
      
      SELECT 
        sr.id as transaction_id,
        CONCAT('RET-', sr.id) as invoice_no,
        s.scope_type,
        s.scope_id,
        sr.created_at as transaction_date,
        'REFUND' as payment_method,
        'REFUND' as payment_type,
        'COMPLETED' as payment_status,
        -sr.total_refund as payment_amount,
        0 as credit_amount,
        -sr.total_refund as subtotal,
        -sr.total_refund as total,
        s.customer_name,
        s.customer_phone,
        s.customer_info,
        sr.notes,
        sr.status,
        u.username as cashier_name,
        b.name as branch_name,
        w.name as warehouse_name,
        'RETURN' as transaction_type,
        -sr.total_refund as paid_amount,
        0 as credit_amount,
        -sr.total_refund as amount,
        sr.id as return_id,
        sr.reason as return_reason,
        sr.total_refund as return_refund_amount
      FROM sales_returns sr
      LEFT JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.processed_by = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
      ${returnsWhereClause}
      
      ORDER BY transaction_date DESC
      LIMIT ? OFFSET ?
    `, [...params, ...returnsParams, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination (sales + returns)
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM (
        SELECT s.id FROM sales s ${whereClause}
        UNION ALL
        SELECT sr.id FROM sales_returns sr
        LEFT JOIN sales s ON sr.original_sale_id = s.id
        ${returnsWhereClause}
      ) as combined_transactions
    `, [...params, ...returnsParams]);

    // Sort transactions in ascending order by date to process them chronologically
    const sortedTransactions = [...transactions].sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at);
      const dateB = new Date(b.transaction_date || b.created_at);
      return dateA - dateB; // Ascending order (oldest first)
    });
    
    console.log('🔍 Sorted transactions for balance calculation:', sortedTransactions.map(t => ({
      invoice: t.invoice_no,
      date: t.transaction_date || t.created_at,
      type: t.transaction_type,
      amount: t.amount,
      credit_amount: t.credit_amount,
      payment_method: t.payment_method
    })));
    
    const includeItems = detailed === 'true';

    let detailedTransactions = [];
    let summaryStats;
    let totalCredit = 0;
    let groupedLedgers = null;

    if (isAllCustomers) {
      const groupedResult = await buildGroupedLedgerStructure(sortedTransactions, { includeItems });
      groupedLedgers = groupedResult.groupedLedgers;
      summaryStats = groupedResult.aggregatedSummary;
      totalCredit = summaryStats.totalCredit || 0;
      detailedTransactions = groupedResult.flattenedTransactions;
    } else {
      const normalizedAsc = normalizeLedgerTransactions(sortedTransactions).map(transaction => ({
        ...transaction,
        transaction_type_display: getTransactionTypeDisplay(transaction),
        payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
      }));

      let transactionsDesc = [...normalizedAsc].sort((a, b) => {
        const dateA = new Date(a.transaction_date || a.created_at);
        const dateB = new Date(b.transaction_date || b.created_at);
        return dateB - dateA;
      });

      detailedTransactions = includeItems ? await attachItemsToTransactions(transactionsDesc) : transactionsDesc;

      summaryStats = computeLedgerSummary(normalizedAsc);
      totalCredit = normalizedAsc.reduce((sum, transaction) => {
        if (transaction.transaction_type === 'SALE') {
          return sum + parseFloat(transaction.credit_amount || 0);
        }
        return sum;
      }, 0);

      const identity = normalizedAsc.length > 0
        ? extractCustomerIdentity(normalizedAsc[0])
        : { name: customerId, phone: null };

      groupedLedgers = [{
        customer: {
          ...identity,
          key: `${identity.name}|||${identity.phone || ''}`
        },
        summary: {
          ...summaryStats,
          totalCredit
        },
        transactions: detailedTransactions
      }];
    }

    const customerSummary = isAllCustomers
      ? {
          name: 'All Customers',
          phone: null,
          total_transactions: summaryStats.totalTransactions,
          current_balance: summaryStats.outstandingBalance,
          total_amount: summaryStats.totalAmount,
          total_paid: summaryStats.totalPaid,
          total_credit: totalCredit,
          unique_customers: groupedLedgers ? groupedLedgers.length : 0
        }
      : await getCustomerSummary(customerId, req.user);

    console.log('🔍 FINAL RESPONSE - Number of transactions:', detailedTransactions.length);
    console.log('🔍 FINAL RESPONSE - First transaction has items?', detailedTransactions[0]?.items ? 'YES' : 'NO');
    console.log('🔍 FINAL RESPONSE - First transaction items count:', detailedTransactions[0]?.items?.length || 0);

    res.json({
      success: true,
      data: {
        customer: customerSummary,
        transactions: detailedTransactions,
        groupedLedgers,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + transactions.length) < countResult[0].total
        },
        summary: {
          totalTransactions: summaryStats.totalTransactions,
          totalAmount: summaryStats.totalAmount,
          totalPaid: summaryStats.totalPaid,
          totalCredit: totalCredit,
          outstandingBalance: summaryStats.outstandingBalance
        }
      }
    });
  } catch (error) {
    console.error('❌ Error in getCustomerLedger:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving customer ledger',
      error: error.message
    });
  }
};
// @desc    Get all customers with their transaction summaries (FIXED VERSION)
// @route   GET /api/customer-ledger/customers
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getAllCustomersWithSummaries = async (req, res) => {
  try {
    const { 
      search, 
      customerType,
      hasBalance,
      limit = 50,
      offset = 0
    } = req.query;

    console.log('🔍 CUSTOMER LIST DEBUG - Query params:', { search, customerType, hasBalance, limit, offset });

    // Role-based filtering
    let branchFilter = null;
    let warehouseFilter = null;
    
    const userBranchId = req.user.branch_id || req.user.branchId;
    const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
    
    if (req.user.role === 'CASHIER' && userBranchId) {
      branchFilter = userBranchId;
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      warehouseFilter = userWarehouseId;
    }

    // Build base conditions
    let baseWhereConditions = [];
    let baseParams = [];

    // Scope filtering - SIMPLIFIED APPROACH
    if (branchFilter) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchFilter]);
      if (branches.length > 0) {
        baseWhereConditions.push('s.scope_type = ? AND s.scope_id = ?');
        baseParams.push('BRANCH', branches[0].name);
      }
    } else if (warehouseFilter) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseFilter]);
      if (warehouses.length > 0) {
        baseWhereConditions.push('s.scope_type = ? AND s.scope_id = ?');
        baseParams.push('WAREHOUSE', warehouses[0].name);
      }
    }

    // Search filtering
    if (search) {
      baseWhereConditions.push('(s.customer_name LIKE ? OR s.customer_phone LIKE ?)');
      const searchTerm = `%${search}%`;
      baseParams.push(searchTerm, searchTerm);
    }

    const baseWhereClause = baseWhereConditions.length > 0 ? `WHERE ${baseWhereConditions.join(' AND ')}` : '';

    // SIMPLIFIED QUERY - Remove the complex subquery that's causing the issue
    const query = `
      SELECT 
        s.customer_name,
        s.customer_phone,
        COUNT(*) as total_transactions,
        -- Sum of actual payment amounts (excluding FULLY_CREDIT and negative payments)
        SUM(CASE 
          WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 
          ELSE GREATEST(s.payment_amount, 0) 
        END) as total_paid,
        -- Sum of subtotal amounts (actual bill amounts)
        SUM(s.subtotal) as total_amount,
        -- Use the latest running_balance for current balance (SIMPLIFIED)
        (
          SELECT s2.running_balance 
          FROM sales s2 
          WHERE s2.customer_name = s.customer_name 
            AND s2.customer_phone = s.customer_phone
          ORDER BY s2.created_at DESC, s2.id DESC 
          LIMIT 1
        ) as current_balance,
        MAX(s.created_at) as last_transaction_date,
        MIN(s.created_at) as first_transaction_date
      FROM sales s
      ${baseWhereClause}
      GROUP BY s.customer_name, s.customer_phone
      HAVING total_transactions > 0
      ORDER BY last_transaction_date DESC
      LIMIT ? OFFSET ?
    `;

    console.log('🔍 SIMPLIFIED CUSTOMER LIST QUERY:', query);
    console.log('🔍 SIMPLIFIED CUSTOMER LIST PARAMS:', [...baseParams, parseInt(limit), parseInt(offset)]);

    const [customers] = await pool.execute(query, [...baseParams, parseInt(limit), parseInt(offset)]);

    console.log('✅ SIMPLIFIED QUERY - Found customers:', customers.length);

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT CONCAT(customer_name, '|', customer_phone)) as total
      FROM sales s
      ${baseWhereClause}
    `;
    
    const [countResult] = await pool.execute(countQuery, baseParams);

    // Process customers
    const customersWithBalance = customers.map(customer => {
      const totalPaid = parseFloat(customer.total_paid || 0);
      const totalAmount = parseFloat(customer.total_amount || 0);
      const currentBalance = parseFloat(customer.current_balance || 0);

      console.log(`🔍 Customer ${customer.customer_name}:`, {
        totalPaid,
        totalAmount,
        currentBalance
      });

      return {
        customer_id: customer.customer_name,
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone,
        total_transactions: customer.total_transactions,
        total_amount: totalAmount,
        total_paid: totalPaid,
        current_balance: currentBalance,
        last_transaction_date: customer.last_transaction_date,
        first_transaction_date: customer.first_transaction_date,
        has_outstanding_balance: Math.abs(currentBalance) > 0.01
      };
    });

    // Filter by balance if requested
    let filteredCustomers = customersWithBalance;
    if (hasBalance === 'true') {
      filteredCustomers = customersWithBalance.filter(c => Math.abs(c.current_balance) > 0.01);
      console.log(`🔍 Filtered to ${filteredCustomers.length} customers with balance`);
    } else if (hasBalance === 'false') {
      filteredCustomers = customersWithBalance.filter(c => Math.abs(c.current_balance) <= 0.01);
      console.log(`🔍 Filtered to ${filteredCustomers.length} customers without balance`);
    }

    res.json({
      success: true,
      data: {
        customers: filteredCustomers,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + customers.length) < countResult[0].total
        }
      }
    });
  } catch (error) {
    console.error('❌ Error in getAllCustomersWithSummaries:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving customers',
      error: error.message
    });
  }
};

// @desc    Export customer ledger to PDF
// @route   GET /api/customer-ledger/:customerId/export
// @access  Private (Admin, Cashier, Warehouse Keeper)
const exportCustomerLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, format = 'pdf', detailed = 'false' } = req.query;

    const includeItems = detailed === 'true';
    const isAllCustomers = isAllCustomersRequest(customerId);

    // Load ledger data without pagination
    const ledgerData = await getCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });
    const ledgerDataAsc = [...ledgerData].sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at || 0);
      const dateB = new Date(b.transaction_date || b.created_at || 0);
      return dateA - dateB;
    });

    if (isAllCustomers) {
      const groupedResult = await buildGroupedLedgerStructure(ledgerDataAsc, { includeItems });

      if (format === 'pdf') {
        const htmlContent = generateAllCustomersLedgerPDF(groupedResult.groupedLedgers, { includeItems });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="all-customers-ledger-${new Date().toISOString().split('T')[0]}.html"`);
        return res.send(htmlContent);
      }

      return res.json({
        success: true,
        data: {
          groupedLedgers: groupedResult.groupedLedgers,
          transactions: groupedResult.flattenedTransactions,
          summary: groupedResult.aggregatedSummary
        }
      });
    }

    const processedLedgerAsc = normalizeLedgerTransactions(ledgerDataAsc).map((transaction) => ({
      ...transaction,
      transaction_type_display: transaction.transaction_type_display || getTransactionTypeDisplay(transaction),
      payment_status_display: transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status)
    }));

    const processedLedgerDesc = [...processedLedgerAsc].sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at || 0);
      const dateB = new Date(b.transaction_date || b.created_at || 0);
      return dateB - dateA;
    });

    if (includeItems) {
      const detailedLedgerData = await getDetailedCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });
      const processedDetailedAsc = normalizeLedgerTransactions(detailedLedgerData).map((transaction) => ({
        ...transaction,
        transaction_type_display: transaction.transaction_type_display || getTransactionTypeDisplay(transaction),
        payment_status_display: transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status)
      }));

      if (format === 'pdf') {
        const htmlContent = generateDetailedCustomerLedgerPDF(processedDetailedAsc);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="detailed-customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
        return res.send(htmlContent);
      }

      const processedDetailedDesc = [...processedDetailedAsc].sort((a, b) => {
        const dateA = new Date(a.transaction_date || a.created_at || 0);
        const dateB = new Date(b.transaction_date || b.created_at || 0);
        return dateB - dateA;
      });

      return res.json({
        success: true,
        data: {
          customer: await getCustomerSummary(customerId, req.user),
          transactions: processedDetailedDesc,
          summary: computeLedgerSummary(processedDetailedAsc)
        }
      });
    }

    if (format === 'pdf') {
      const htmlContent = generateCustomerLedgerPDF(processedLedgerAsc);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
      return res.send(htmlContent);
    }

    return res.json({
      success: true,
      data: processedLedgerDesc,
      summary: computeLedgerSummary(processedLedgerAsc)
    });
  } catch (error) {
    console.error('❌ Error in exportCustomerLedger:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting customer ledger',
      error: error.message
    });
  }
};

// Helper function to get customer summary
const getCustomerSummary = async (customerId, user) => {
  try {
    // Try to find customer in customers table first
    const [customers] = await pool.execute(
      'SELECT * FROM customers WHERE name = ? OR phone = ?',
      [customerId, customerId]
    );

    if (customers.length > 0) {
      return customers[0];
    }

    // If not found, get summary from sales data
    const [sales] = await pool.execute(`
      SELECT 
        COALESCE(s.customer_name, JSON_EXTRACT(s.customer_info, "$.name")) as name,
        COALESCE(s.customer_phone, JSON_EXTRACT(s.customer_info, "$.phone")) as phone,
        COUNT(*) as total_transactions,
        SUM(s.total) as total_sales,
        SUM(s.credit_amount) as current_balance, -- Use sum of credit_amount for balance
        MAX(s.created_at) as last_transaction
      FROM sales s
      WHERE (s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)
      GROUP BY name, phone
      LIMIT 1
    `, [customerId, customerId, customerId, customerId]);

    return sales[0] || { name: customerId, phone: '', total_transactions: 0, current_balance: 0 };
  } catch (error) {
    console.error('Error in getCustomerSummary:', error);
    return { name: customerId, phone: '', total_transactions: 0, current_balance: 0 };
  }
};

// Helper function to get customer ledger data
const getCustomerLedgerData = async (customerId, user, options = {}) => {
  const { startDate, endDate, limit = 1000 } = options;
  
  // Build WHERE conditions (same logic as getCustomerLedger)
  let whereConditions = [];
  let params = [];
  let scopeFilter = null;
  const isAllCustomers = isAllCustomersRequest(customerId);

  // Handle both branch_id and branchId for backward compatibility
  const userBranchId = user.branch_id || user.branchId;
  const userWarehouseId = user.warehouse_id || user.warehouseId;
  
  if (user.role === 'CASHIER' && userBranchId) {
    // For cashiers, we need to match by branch name since sales store scope_id as string
    const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
    if (branches.length > 0) {
      scopeFilter = { type: 'BRANCH', value: branches[0].name };
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push(scopeFilter.type, scopeFilter.value);
    }
  } else if (user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
    // For warehouse keepers, we need to match by warehouse name since sales store scope_id as string
    const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
    if (warehouses.length > 0) {
      scopeFilter = { type: 'WAREHOUSE', value: warehouses[0].name };
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push(scopeFilter.type, scopeFilter.value);
    }
  }

  if (!isAllCustomers) {
    whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
    params.push(customerId, customerId, customerId, customerId);
  }

  if (startDate) {
    whereConditions.push('s.created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push('s.created_at <= ?');
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const [transactions] = await pool.execute(`
    SELECT 
      s.id as transaction_id,
      s.invoice_no,
      s.scope_type,
      s.scope_id,
      s.created_at as transaction_date,
      s.payment_method,
      s.payment_status,
      s.payment_type,
      s.payment_amount,
      s.credit_amount,
      s.running_balance,
      s.subtotal,
      s.total,
      s.customer_name,
      s.customer_phone,
      s.customer_info,
      s.notes,
      s.status,
      u.username as cashier_name,
      b.name as branch_name,
      w.name as warehouse_name,
      CASE 
        WHEN s.payment_type = 'OUTSTANDING_SETTLEMENT' THEN 'SETTLEMENT'
        ELSE 'SALE'
      END as transaction_type
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ?
  `, [...params, limit]);

  // Map payment_amount to paid_amount for PDF generation compatibility
  return transactions.map(t => ({
    ...t,
    paid_amount: t.payment_amount,
    amount: t.subtotal // Add amount field for consistency
  }));
};

// Helper function to get detailed customer ledger data with items
const getDetailedCustomerLedgerData = async (customerId, user, options = {}) => {
  const { startDate, endDate, limit = 1000 } = options;
  
  // Build WHERE conditions (same logic as getCustomerLedger)
  let whereConditions = [];
  let params = [];
  let scopeFilter = null;
  const isAllCustomers = isAllCustomersRequest(customerId);

  // Handle both branch_id and branchId for backward compatibility
  const userBranchId = user.branch_id || user.branchId;
  const userWarehouseId = user.warehouse_id || user.warehouseId;
  
  if (user.role === 'CASHIER' && userBranchId) {
    // For cashiers, we need to match by branch name since sales store scope_id as string
    const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
    if (branches.length > 0) {
      scopeFilter = { type: 'BRANCH', value: branches[0].name };
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push(scopeFilter.type, scopeFilter.value);
    }
  } else if (user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
    // For warehouse keepers, we need to match by warehouse name since sales store scope_id as string
    const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
    if (warehouses.length > 0) {
      scopeFilter = { type: 'WAREHOUSE', value: warehouses[0].name };
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push(scopeFilter.type, scopeFilter.value);
    }
  }

  if (!isAllCustomers) {
    whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
    params.push(customerId, customerId, customerId, customerId);
  }

  if (startDate) {
    whereConditions.push('s.created_at >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push('s.created_at <= ?');
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get transactions with basic info
  const [transactions] = await pool.execute(`
    SELECT 
      s.id as transaction_id,
      s.invoice_no,
      s.scope_type,
      s.scope_id,
      s.created_at as transaction_date,
      s.payment_method,
      s.payment_status,
      s.payment_type,
      s.payment_amount,
      s.credit_amount,
      s.running_balance,
      s.subtotal,
      s.total,
      s.customer_name,
      s.customer_phone,
      s.customer_info,
      s.notes,
      s.status,
      u.username as cashier_name,
      b.name as branch_name,
      w.name as warehouse_name,
      CASE 
        WHEN s.payment_type = 'OUTSTANDING_SETTLEMENT' THEN 'SETTLEMENT'
        ELSE 'SALE'
      END as transaction_type
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ?
  `, [...params, limit]);

  // For each transaction, get the detailed items
  const detailedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      try {
        console.log(`Fetching items for transaction ${transaction.transaction_id}`)
        // Get items for this transaction
        const [items] = await pool.execute(`
          SELECT 
            si.*,
            ii.name as item_name,
            ii.sku,
            ii.selling_price as catalog_price,
            ii.cost_price,
            ii.category
          FROM sale_items si
          LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
          WHERE si.sale_id = ?
          ORDER BY si.id
        `, [transaction.transaction_id]);

        console.log(`Transaction ${transaction.transaction_id} has ${items.length} items`)
        if (items.length > 0) {
          console.log('Sample item:', items[0])
        }

        return {
          ...transaction,
          items: items || []
        };
      } catch (error) {
        console.error(`Error fetching items for transaction ${transaction.transaction_id}:`, error);
        return {
          ...transaction,
          items: []
        };
      }
    })
  );

  // Sort transactions by date in ascending order for balance calculation
  const sortedTransactions = detailedTransactions.sort((a, b) => {
    const dateA = new Date(a.transaction_date || a.created_at);
    const dateB = new Date(b.transaction_date || b.created_at);
    return dateA - dateB;
  });

  // CORRECTED: Calculate running balance with proper accounting logic
  let runningBalance = 0;
  const transactionsWithBalance = sortedTransactions.map((transaction, index) => {
    const paid = parseFloat(transaction.payment_amount || 0);
    const credit = parseFloat(transaction.credit_amount || 0);
    const amount = parseFloat(transaction.subtotal || transaction.total || 0);
    
    // Store the old balance before processing this transaction
    const oldBalance = runningBalance;
    
    // Calculate current bill amount (what they're buying now)
    const currentBillAmount = amount;
    
    // Calculate total amount due (current bill + old balance)
    const totalAmountDue = currentBillAmount + oldBalance;
    
    // Calculate actual payment for this transaction
    let actualPayment = paid;
    if (transaction.payment_method === 'FULLY_CREDIT') {
      actualPayment = 0; // No cash payment for fully credit
    }
    
    // CORRECTED: Calculate new balance based on transaction type
    // All transactions are sales, so calculate new balance = old balance + current bill - actual payment
    runningBalance = totalAmountDue - actualPayment;
    
    console.log(`🔍 CORRECTED Balance Calculation ${index + 1}:`, {
      invoice: transaction.invoice_no,
      type: transaction.transaction_type,
      oldBalance,
      currentBillAmount,
      actualPayment,
      payment_method: transaction.payment_method,
      newRunningBalance: runningBalance
    });
    
    return {
      ...transaction,
      old_balance: oldBalance,
      amount: currentBillAmount,
      total_amount: totalAmountDue,
      paid_amount: actualPayment,
      running_balance: runningBalance,
      transaction_type: 'SALE',
      transaction_type_display: getTransactionTypeDisplay(transaction),
      payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
    };
  });

  return transactionsWithBalance;
};

// Normalize ledger transactions by applying consistent running balance logic (including settlements)
const normalizeLedgerTransactions = (transactions = []) => {
  if (!Array.isArray(transactions)) {
    return [];
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transaction_date || a.created_at || a.date || 0);
    const dateB = new Date(b.transaction_date || b.created_at || b.date || 0);
    return dateA - dateB;
  });

  let runningBalance = 0;

  return sortedTransactions.map((transaction) => {
    const paymentMethod = transaction.payment_method;
    const paymentType = transaction.payment_type || transaction.paymentType || null;
    const rawTransactionType = (transaction.transaction_type || transaction.transactionType || '').toUpperCase();

    const paid = parseFloat(
      transaction.corrected_paid ??
      transaction.paid_amount ??
      transaction.payment_amount ??
      0
    ) || 0;

    const hasExplicitCredit = transaction.credit_amount !== undefined && transaction.credit_amount !== null && !Number.isNaN(parseFloat(transaction.credit_amount));
    const credit = hasExplicitCredit ? parseFloat(transaction.credit_amount) : 0;
    const amount = parseFloat(
      transaction.amount ??
      transaction.subtotal ??
      transaction.total ??
      0
    ) || 0;

    const oldBalance = runningBalance;
    let currentBillAmount = amount;
    let totalAmountDue = oldBalance + currentBillAmount;
    let actualPayment = paid;

    if (paymentMethod === 'FULLY_CREDIT' && paymentType !== 'OUTSTANDING_SETTLEMENT') {
      actualPayment = 0;
    }

    let normalizedType = rawTransactionType || (paymentMethod === 'REFUND' ? 'RETURN' : 'SALE');

    if (paymentType === 'OUTSTANDING_SETTLEMENT' || normalizedType === 'SETTLEMENT') {
      const settlementRunningBalance = parseFloat(
        transaction.running_balance ??
        transaction.runningBalance ??
        transaction.post_balance ??
        transaction.new_balance
      );

      currentBillAmount = 0;
      totalAmountDue = oldBalance;
      actualPayment = paid;
      if (Number.isFinite(settlementRunningBalance)) {
        runningBalance = settlementRunningBalance;
      } else if (hasExplicitCredit) {
        runningBalance = credit;
      } else {
        runningBalance = oldBalance - actualPayment;
      }

      normalizedType = 'SETTLEMENT';
    } else if (normalizedType === 'RETURN' || paymentMethod === 'REFUND') {
      runningBalance = oldBalance - Math.abs(amount);
      normalizedType = 'RETURN';
    } else {
      const totalDue = oldBalance + currentBillAmount;
      runningBalance = totalDue - actualPayment;
      normalizedType = 'SALE';
    }

    const balance = runningBalance;

    return {
      ...transaction,
      payment_type: paymentType,
      transaction_type: normalizedType,
      old_balance: oldBalance,
      amount: currentBillAmount,
      total_amount: totalAmountDue,
      corrected_paid: actualPayment,
      paid_amount: actualPayment,
      running_balance: balance,
      balance
    };
  });
};

const computeLedgerSummary = (transactions = []) => {
  const numeric = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, transaction) => sum + numeric(transaction.amount), 0);
  const totalPaid = transactions.reduce((sum, transaction) => sum + numeric(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount), 0);
  const outstandingBalance = totalTransactions > 0
    ? numeric(transactions[transactions.length - 1].balance ?? transactions[transactions.length - 1].running_balance)
    : 0;

  const completedTransactions = transactions.filter((transaction) => {
    const balance = numeric(transaction.balance ?? transaction.running_balance);
    return balance <= 0;
  }).length;

  const pendingTransactions = transactions.filter((transaction) => {
    const balance = numeric(transaction.balance ?? transaction.running_balance);
    const payment = numeric(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount);
    if (balance <= 0) {
      return false;
    }
    if (transaction.payment_method === 'FULLY_CREDIT') {
      return true;
    }
    return payment === 0;
  }).length;

  const partialTransactions = transactions.filter((transaction) => {
    const balance = numeric(transaction.balance ?? transaction.running_balance);
    const payment = numeric(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount);
    return balance > 0 && payment > 0 && transaction.payment_method !== 'FULLY_CREDIT';
  }).length;

  return {
    totalTransactions,
    totalAmount,
    totalPaid,
    outstandingBalance,
    completedTransactions,
    pendingTransactions,
    partialTransactions
  };
};

const getTransactionItems = async (transactionId) => {
  try {
    const [items] = await pool.execute(
      `SELECT 
        si.*, 
        ii.name as item_name,
        ii.sku,
        ii.selling_price as catalog_price,
        ii.cost_price,
        ii.category
      FROM sale_items si
      LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
      WHERE si.sale_id = ?
      ORDER BY si.id`,
      [transactionId]
    );
    return items || [];
  } catch (error) {
    console.error(`Error fetching items for transaction ${transactionId}:`, error);
    return [];
  }
};

const attachItemsToTransactions = async (transactions = []) => {
  return Promise.all(transactions.map(async (transaction) => {
    const items = await getTransactionItems(transaction.transaction_id);
    return {
      ...transaction,
      items
    };
  }));
};

const buildGroupedLedgerStructure = async (transactionsAsc = [], { includeItems = false } = {}) => {
  const groupedMap = new Map();

  transactionsAsc.forEach((transaction) => {
    const identity = extractCustomerIdentity(transaction);
    const key = `${identity.name}|||${identity.phone || ''}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        identity: {
          ...identity,
          key
        },
        transactions: []
      });
    }

    groupedMap.get(key).transactions.push(transaction);
  });

  const groupedLedgers = [];
  const flattenedTransactions = [];

  const aggregatedSummary = {
    totalTransactions: 0,
    totalAmount: 0,
    totalPaid: 0,
    outstandingBalance: 0,
    completedTransactions: 0,
    pendingTransactions: 0,
    partialTransactions: 0,
    totalCredit: 0
  };

  for (const group of groupedMap.values()) {
    const normalizedGroupAsc = normalizeLedgerTransactions(group.transactions).map((transaction) => ({
      ...transaction,
      customer_name: transaction.customer_name || group.identity.name,
      customer_phone: transaction.customer_phone || group.identity.phone,
      transaction_type_display: getTransactionTypeDisplay(transaction),
      payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
    }));

    const groupSummary = computeLedgerSummary(normalizedGroupAsc);
    const groupCredit = normalizedGroupAsc.reduce((sum, transaction) => {
      if (transaction.transaction_type === 'SALE') {
        return sum + parseFloat(transaction.credit_amount || 0);
      }
      return sum;
    }, 0);

    let groupTransactionsDesc = [...normalizedGroupAsc].sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at || 0);
      const dateB = new Date(b.transaction_date || b.created_at || 0);
      return dateB - dateA;
    });

    if (includeItems) {
      groupTransactionsDesc = await attachItemsToTransactions(groupTransactionsDesc);
    }

    groupedLedgers.push({
      customer: group.identity,
      summary: {
        ...groupSummary,
        totalCredit: groupCredit
      },
      transactions: groupTransactionsDesc
    });

    aggregatedSummary.totalTransactions += groupSummary.totalTransactions;
    aggregatedSummary.totalAmount += groupSummary.totalAmount;
    aggregatedSummary.totalPaid += groupSummary.totalPaid;
    aggregatedSummary.outstandingBalance += groupSummary.outstandingBalance;
    aggregatedSummary.completedTransactions += groupSummary.completedTransactions;
    aggregatedSummary.pendingTransactions += groupSummary.pendingTransactions;
    aggregatedSummary.partialTransactions += groupSummary.partialTransactions;
    aggregatedSummary.totalCredit += groupCredit;

    flattenedTransactions.push(...groupTransactionsDesc);
  }

  groupedLedgers.sort((a, b) => {
    const dateA = new Date(a.transactions[0]?.transaction_date || a.transactions[0]?.created_at || 0);
    const dateB = new Date(b.transactions[0]?.transaction_date || b.transactions[0]?.created_at || 0);
    return dateB - dateA;
  });

  return {
    groupedLedgers,
    aggregatedSummary,
    flattenedTransactions
  };
};

// Helper function to generate PDF content
const generateCustomerLedgerPDF = (ledgerData = []) => {
  const transactionsWithBalance = normalizeLedgerTransactions(ledgerData).map((transaction) => ({
    ...transaction,
    transaction_type_display: transaction.transaction_type_display || getTransactionTypeDisplay(transaction),
    payment_status_display: transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status)
  }));

  const summary = computeLedgerSummary(transactionsWithBalance);

  const customerName = transactionsWithBalance[0]?.customer_name || ledgerData[0]?.customer_name || 'Unknown Customer';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Customer Ledger Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 12px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
          }
          .summary { 
            background: #f5f5f5; 
            padding: 15px; 
            margin-bottom: 20px; 
            border-radius: 5px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 10px;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
            font-size: 11px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 6px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold;
          }
          .total-row { 
            font-weight: bold; 
            background-color: #e6f3ff; 
          }
          .status-completed { color: #28a745; }
          .status-pending { color: #ffc107; }
          .status-partial { color: #fd7e14; }
          .amount { text-align: right; }
          @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Customer Ledger Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Customer: ${customerName}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <span>Total Transactions:</span>
            <span>${summary.totalTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Amount:</span>
            <span>${summary.totalAmount.toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Completed:</span>
            <span>${summary.completedTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Pending:</span>
            <span>${summary.pendingTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Partial:</span>
            <span>${summary.partialTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Outstanding:</span>
            <span>${summary.outstandingBalance.toFixed(2)}</span>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Amount</th>
              <th>Old Balance</th>
              <th>Total Amount</th>
              <th>Payment</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsWithBalance.map(transaction => `
              <tr>
                <td>${new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}</td>
                <td>${transaction.invoice_no || 'N/A'}</td>
                <td class="amount">${parseFloat(transaction.amount || 0).toFixed(2)}</td>
                <td class="amount">${(transaction.old_balance || 0).toFixed(2)}</td>
                <td class="amount">${(transaction.total_amount || 0).toFixed(2)}</td>
                <td class="amount">${(transaction.corrected_paid || 0).toFixed(2)}</td>
                <td>${transaction.payment_method || 'N/A'}</td>
                <td class="status-${transaction.payment_method === 'FULLY_CREDIT' ? 'pending' : ((transaction.balance || 0) <= 0 ? 'completed' : 'partial')}">
                  ${transaction.payment_method === 'FULLY_CREDIT' ? 'Credit' : ((transaction.balance || 0) <= 0 ? 'Paid' : 'Partial')}
                </td>
                <td class="amount">${(transaction.balance || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Totals</strong></td>
              <td class="amount"><strong>-</strong></td>
              <td class="amount"><strong>${summary.totalAmount.toFixed(2)}</strong></td>
              <td class="amount"><strong>${summary.totalPaid.toFixed(2)}</strong></td>
              <td><strong>-</strong></td>
              <td><strong>-</strong></td>
              <td class="amount"><strong>${summary.outstandingBalance.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  return html;
};

// Helper function to generate detailed PDF content with items
const generateDetailedCustomerLedgerPDF = (detailedLedgerData = []) => {
  const transactionsWithBalance = normalizeLedgerTransactions(detailedLedgerData).map((transaction) => ({
    ...transaction,
    transaction_type_display: transaction.transaction_type_display || getTransactionTypeDisplay(transaction),
    payment_status_display: transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status)
  }));

  const summary = computeLedgerSummary(transactionsWithBalance);
  const totalItems = transactionsWithBalance.reduce((sum, transaction) => sum + (transaction.items?.length || 0), 0);
  const customerName = transactionsWithBalance[0]?.customer_name || detailedLedgerData[0]?.customer_name || 'Unknown Customer';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Detailed Customer Ledger Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 15px; 
            font-size: 10px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            border-bottom: 2px solid #333; 
            padding-bottom: 15px; 
          }
          .summary { 
            background: #f5f5f5; 
            padding: 10px; 
            margin-bottom: 15px; 
            border-radius: 3px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            font-size: 9px;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
          }
          .main-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          .main-table th {
            background-color: #f2f2f2;
            font-weight: bold;
            padding: 6px 4px;
            border: 1px solid #ddd;
            text-align: left;
            font-size: 8px;
          }
          .main-table td {
            padding: 4px;
            border: 1px solid #ddd;
            vertical-align: top;
          }
          .transaction-row {
            background-color: #f8f9fa;
            border-bottom: 2px solid #dee2e6;
          }
          .item-row {
            background-color: #ffffff;
            font-size: 8px;
            border-bottom: 1px solid #e9ecef;
          }
          .items-cell {
            padding: 6px 8px;
            font-size: 7px;
            line-height: 1.3;
            vertical-align: top;
            min-width: 200px;
            max-width: 300px;
            word-wrap: break-word;
          }
          .item-line {
            margin-bottom: 3px;
            padding: 2px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          .item-line:last-child {
            margin-bottom: 0;
            border-bottom: none;
          }
          .amount { 
            text-align: right; 
          }
          .status-completed { 
            color: green; 
            font-weight: bold; 
          }
          .status-pending { 
            color: red; 
            font-weight: bold; 
          }
          .status-partial { 
            color: orange; 
            font-weight: bold; 
          }
          .type-chip {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 7px;
            font-weight: bold;
            color: white;
          }
          .type-walkin { background-color: #e91e63; }
          .type-retailer { background-color: #2196f3; }
          .status-chip {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 7px;
            font-weight: bold;
            color: white;
          }
          .status-paid { background-color: #4caf50; }
          .status-credit { background-color: #f44336; }
          .status-partial { background-color: #ff9800; }
          .no-items {
            padding: 8px;
            text-align: center;
            color: #666;
            font-style: italic;
            font-size: 8px;
          }
          @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
            .main-table { page-break-inside: auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Detailed Customer Ledger Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Customer: ${customerName}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <span>Total Transactions:</span>
            <span>${summary.totalTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Amount:</span>
            <span>${summary.totalAmount.toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Outstanding:</span>
            <span>${formatCurrency(summary.outstandingBalance)}</span>
          </div>
          <div class="summary-item">
            <span>Completed:</span>
            <span class="status-completed">${summary.completedTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Pending:</span>
            <span class="status-pending">${summary.pendingTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Partial:</span>
            <span class="status-partial">${summary.partialTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Items:</span>
            <span>${totalItems}</span>
          </div>
        </div>
        
        <table class="main-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Old Balance</th>
              <th>Total Amount</th>
              <th>Payment</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsWithBalance.map(transaction => `
              <tr class="transaction-row">
                <td>${formatDate(transaction.transaction_date || transaction.created_at)}</td>
                <td><strong>${transaction.invoice_no || 'N/A'}</strong></td>
                <td class="items-cell">
                  ${transaction.items && transaction.items.length > 0 
                    ? transaction.items.map(item => {
                        const unitPrice = parseFloat(item.unit_price || 0);
                        const quantity = parseFloat(item.quantity || 0);
                        const discount = parseFloat(item.discount || 0);
                        const itemTotal = parseFloat(item.total || 0);
                        
                        // Format: Item Name (Qty x) @ UnitPrice = Total
                        let itemLine = `${item.item_name || item.name || 'N/A'} (${quantity}x) @ ${formatCurrency(unitPrice)}`;
                        
                        // Add discount if applicable
                        if (discount > 0) {
                          itemLine += ` - ${formatCurrency(discount)}`;
                        }
                        
                        itemLine += ` = ${formatCurrency(itemTotal)}`;
                        
                        return `<div class="item-line">${itemLine}</div>`;
                      }).join('')
                    : '<div class="item-line">No items</div>'
                  }
                </td>
                <td class="amount">${formatCurrency(transaction.amount || 0)}</td>
                <td class="amount">${formatCurrency(transaction.old_balance)}</td>
                <td class="amount"><strong>${formatCurrency(transaction.total_amount)}</strong></td>
                <td class="amount">${formatCurrency(transaction.corrected_paid)}</td>
                <td>${transaction.payment_method || 'N/A'}</td>
                <td>
                  <span class="status-chip status-${transaction.payment_method === 'FULLY_CREDIT' ? 'credit' : (transaction.balance < 0 ? 'credit' : (transaction.balance === 0 ? 'paid' : 'partial'))}">
                    ${transaction.payment_method === 'FULLY_CREDIT' ? 'Credit' : (transaction.balance < 0 ? 'Credit' : (transaction.balance === 0 ? 'Paid' : 'Partial'))}
                  </span>
                </td>
                <td class="amount">${formatCurrency(transaction.balance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  return html;
};

const generateAllCustomersLedgerPDF = (groupedLedgers = [], options = {}) => {
  const { includeItems = false } = options;

  const formatAmount = (value) => {
    const num = parseFloat(value || 0);
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
  };

  const sectionsHtml = groupedLedgers.map((group, index) => {
    const customer = group.customer || {};
    const summary = group.summary || {};
    const transactions = group.transactions || [];

    const transactionRows = transactions.map((transaction) => {
      const amount = formatAmount(transaction.amount || transaction.subtotal || transaction.total);
      const oldBalance = formatAmount(transaction.old_balance || transaction.previous_balance);
      const totalAmount = formatAmount(transaction.total_amount || transaction.total);
      const payment = formatAmount(transaction.corrected_paid || transaction.paid_amount || transaction.payment_amount);
      const balance = formatAmount(transaction.balance || transaction.running_balance);
      const statusDisplay = transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status);

      const itemsHtml = includeItems && transaction.items && transaction.items.length > 0
        ? `
            <tr class="items-row">
              <td colspan="9">
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>SKU</th>
                      <th class="amount">Quantity</th>
                      <th class="amount">Unit Price</th>
                      <th class="amount">Discount</th>
                      <th class="amount">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transaction.items.map((item) => `
                      <tr>
                        <td>${item.item_name || item.name || 'N/A'}</td>
                        <td>${item.sku || 'N/A'}</td>
                        <td class="amount">${formatAmount(item.quantity)}</td>
                        <td class="amount">${formatAmount(item.unit_price || item.unitPrice)}</td>
                        <td class="amount">${formatAmount(item.discount)}</td>
                        <td class="amount">${formatAmount(item.item_total || item.total)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </td>
            </tr>
          `
        : '';

      return `
        <tr>
          <td>${new Date(transaction.transaction_date || transaction.created_at || transaction.date || Date.now()).toLocaleDateString()}</td>
          <td>${transaction.invoice_no || 'N/A'}</td>
          <td class="amount">${amount}</td>
          <td class="amount">${oldBalance}</td>
          <td class="amount">${totalAmount}</td>
          <td class="amount">${payment}</td>
          <td>${transaction.payment_method || 'N/A'}</td>
          <td>${statusDisplay || 'N/A'}</td>
          <td class="amount">${balance}</td>
        </tr>
        ${itemsHtml}
      `;
    }).join('');

    return `
      <div class="customer-section${index > 0 ? ' page-break' : ''}">
        <div class="customer-header">
          <h2>${customer.name || 'Unknown Customer'}</h2>
          ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
        </div>
        <div class="summary">
          <div class="summary-item"><span>Total Transactions:</span><span>${summary.totalTransactions || 0}</span></div>
          <div class="summary-item"><span>Total Amount:</span><span>${formatAmount(summary.totalAmount)}</span></div>
          <div class="summary-item"><span>Total Paid:</span><span>${formatAmount(summary.totalPaid)}</span></div>
          <div class="summary-item"><span>Total Credit:</span><span>${formatAmount(summary.totalCredit)}</span></div>
          <div class="summary-item"><span>Outstanding:</span><span>${formatAmount(summary.outstandingBalance)}</span></div>
        </div>
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Amount</th>
              <th>Old Balance</th>
              <th>Total Amount</th>
              <th>Payment</th>
              <th>Payment Method</th>
              <th>Status</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows || '<tr><td colspan="9">No transactions available.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>All Customers Ledger Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .summary {
            background: #f5f5f5;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 10px;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
          }
          .ledger-table, .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          .amount {
            text-align: right;
          }
          .customer-section {
            margin-bottom: 40px;
          }
          .customer-header {
            margin-bottom: 10px;
          }
          .items-table {
            margin-top: 8px;
          }
          .items-row td {
            background: #fafafa;
          }
          .page-break {
            page-break-before: always;
          }
          @media print {
            body { margin: 0; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>All Customers Ledger Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Total Customers: ${groupedLedgers.length}</p>
        </div>
        ${groupedLedgers.length === 0 ? '<p>No transactions found for the selected filters.</p>' : sectionsHtml}
      </body>
    </html>
  `;

  return html;
};

// Helper functions for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  if (num % 1 === 0) {
    return num.toString(); // No decimal places for whole numbers
  }
  return num.toFixed(2);
};

const getTransactionTypeDisplay = (transaction) => {
  if (transaction.payment_type === 'OUTSTANDING_SETTLEMENT' || transaction.transaction_type === 'SETTLEMENT') {
    return 'Settlement Payment';
  }
  if (transaction.transaction_type === 'RETURN') {
    return 'Return';
  } else if (transaction.scope_type === 'WAREHOUSE') {
    return 'Retailer Sale';
  } else if (transaction.scope_type === 'BRANCH') {
    return 'Walk-in Sale';
  }
  return 'Sale';
};

const getPaymentStatusDisplay = (status) => {
  const statusMap = {
    'COMPLETED': 'Paid',
    'PARTIAL': 'Partial Payment',
    'PENDING': 'Credit',
    'CANCELLED': 'Cancelled'
  };
  return statusMap[status] || status;
};

module.exports = {
  getCustomerLedger,
  getAllCustomersWithSummaries,
  exportCustomerLedger
};