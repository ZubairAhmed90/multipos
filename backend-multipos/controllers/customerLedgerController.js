const { pool } = require('../config/database');

const buildCustomerKey = (name, phone) => {
  const safeName = name ?? '';
  const safePhone = phone ?? '';
  return `${safeName}|${safePhone}`;
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

    console.log('🔍 CUSTOMER LEDGER DEBUG - Query params:', req.query);
    console.log('🔍 CUSTOMER LEDGER DEBUG - detailed parameter:', detailed, 'type:', typeof detailed);
    console.log('🔍 CUSTOMER LEDGER DEBUG - customerId:', customerId);

    // ✅ FIX: Handle "all" customers case - when customerId is "all" or special value
    const isAllCustomers = customerId === 'all' || 
                          customerId === 'All Customers' || 
                          customerId === 'all-customers' || 
                          customerId === 'all_customers' ||
                          customerId === '__all__';
    console.log('🔍 CUSTOMER LEDGER DEBUG - isAllCustomers:', isAllCustomers);

    // Build WHERE conditions for role-based access
    let whereConditions = [];
    let params = [];

    // Role-based filtering - handle both branch_id and branchId for backward compatibility
    const userBranchId = req.user.branch_id || req.user.branchId;
    const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
    
    if (req.user.role === 'CASHIER' && userBranchId) {
      // For cashiers, we need to match by branch name since sales store scope_id as string
      // First get the branch name from the branch_id
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
      if (branches.length > 0) {
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        params.push('BRANCH', branches[0].name);
        console.log('🔍 CASHIER filtering by branch:', branches[0].name);
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      // For warehouse keepers, we need to match by warehouse name since sales store scope_id as string
      // First get the warehouse name from the warehouse_id
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
      if (warehouses.length > 0) {
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        params.push('WAREHOUSE', warehouses[0].name);
        console.log('🔍 WAREHOUSE_KEEPER filtering by warehouse:', warehouses[0].name);
      }
    }
    // Admin can see all transactions (no scope restrictions)

    // Customer filtering - skip if viewing all customers
    // Use case-insensitive matching and handle both name and phone
    if (!isAllCustomers) {
      whereConditions.push('(LOWER(TRIM(s.customer_name)) = LOWER(TRIM(?)) OR s.customer_phone = ? OR LOWER(TRIM(JSON_EXTRACT(s.customer_info, "$.name"))) = LOWER(TRIM(?)) OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
      params.push(customerId, customerId, customerId, customerId);
      console.log('🔍 Customer filter added for:', customerId);
    }

    // Date filtering — use sale_date when set, else fall back to created_at
    if (startDate) {
      whereConditions.push('COALESCE(s.sale_date, s.created_at) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push('COALESCE(s.sale_date, s.created_at) <= ?');
      params.push(endDate);
    }

    // Transaction type filtering
    // Map frontend values to database payment_status values
    if (transactionType && transactionType !== 'all') {
      let paymentStatusFilter = transactionType;
      
      // Map frontend display values to database values
      const statusMapping = {
        'Paid': 'COMPLETED',
        'Credit': 'PENDING',
        'Partial': 'PARTIAL',
        'Pending': 'PENDING',
        'Completed': 'COMPLETED'
      };
      
      // Use mapped value if available, otherwise use the original value
      paymentStatusFilter = statusMapping[transactionType] || transactionType;
      
      whereConditions.push('s.payment_status = ?');
      params.push(paymentStatusFilter);
      
      console.log('🔍 Transaction type filter:', {
        frontendValue: transactionType,
        mappedValue: paymentStatusFilter
      });
    }

    // Payment method filtering
    if (paymentMethod && paymentMethod !== 'all') {
      whereConditions.push('s.payment_method = ?');
      params.push(paymentMethod);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Build WHERE conditions for returns (with scope filtering)
    // Returns are now stored as sale records, so use s_return alias
    let returnsWhereConditions = [];
    let returnsParams = [];

    // Apply scope filtering for returns (same as sales)
    if (req.user.role === 'CASHIER' && userBranchId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
      if (branches.length > 0) {
        returnsWhereConditions.push('(s_return.scope_type = ? AND s_return.scope_id = ?)');
        returnsParams.push('BRANCH', branches[0].name);
        console.log('🔍 CASHIER filtering returns by branch:', branches[0].name);
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
      if (warehouses.length > 0) {
        returnsWhereConditions.push('(s_return.scope_type = ? AND s_return.scope_id = ?)');
        returnsParams.push('WAREHOUSE', warehouses[0].name);
        console.log('🔍 WAREHOUSE_KEEPER filtering returns by warehouse:', warehouses[0].name);
      }
    }

    // Customer filtering for returns (skip if viewing all customers)
    if (!isAllCustomers) {
      returnsWhereConditions.push('(s_return.customer_name = ? OR s_return.customer_phone = ? OR JSON_EXTRACT(s_return.customer_info, "$.name") = ? OR JSON_EXTRACT(s_return.customer_info, "$.phone") = ?)');
      returnsParams.push(customerId, customerId, customerId, customerId);
    }

    // Date filtering for returns (use s_return.created_at)
    if (startDate) {
      returnsWhereConditions.push('s_return.created_at >= ?');
      returnsParams.push(startDate);
    }
    if (endDate) {
      returnsWhereConditions.push('s_return.created_at <= ?');
      returnsParams.push(endDate);
    }

    const returnsWhereClause = returnsWhereConditions.length > 0 ? `AND ${returnsWhereConditions.join(' AND ')}` : '';

    console.log('🔍 Customer ID:', customerId);
    console.log('🔍 WHERE clause:', whereClause);
    console.log('🔍 Params:', params);
    
    // Debug: Check if returns exist for this customer (with case-insensitive matching)
    if (!isAllCustomers) {
      const [debugReturns] = await pool.execute(`
        SELECT 
          s.id,
          s.invoice_no,
          s.payment_method,
          s.payment_type,
          s.customer_name,
          s.customer_phone,
          s.created_at,
          sr.id as return_id,
          sr.return_no,
          s.old_balance,
          s.running_balance
        FROM sales s
        LEFT JOIN sales_returns sr ON s.invoice_no = sr.return_no
        WHERE s.payment_method = 'REFUND' 
          AND s.payment_type = 'REFUND'
          AND (LOWER(TRIM(s.customer_name)) = LOWER(TRIM(?)) OR s.customer_phone = ? OR LOWER(TRIM(JSON_EXTRACT(s.customer_info, "$.name"))) = LOWER(TRIM(?)) OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)
        ORDER BY s.created_at DESC
        LIMIT 10
      `, [customerId, customerId, customerId, customerId]);
      console.log('🔍 DEBUG - Returns found for customer:', debugReturns.length);
      if (debugReturns.length > 0) {
        console.log('🔍 DEBUG - Sample returns:', debugReturns.map(r => ({
          id: r.id,
          invoice_no: r.invoice_no,
          return_no: r.return_no,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          created_at: r.created_at,
          old_balance: r.old_balance,
          running_balance: r.running_balance
        })));
      } else {
        // Also check all returns to see if any exist
        const [allReturns] = await pool.execute(`
          SELECT 
            s.id,
            s.invoice_no,
            s.customer_name,
            s.customer_phone,
            sr.return_no
          FROM sales s
          LEFT JOIN sales_returns sr ON s.invoice_no = sr.return_no
          WHERE s.payment_method = 'REFUND' AND s.payment_type = 'REFUND'
          ORDER BY s.created_at DESC
          LIMIT 5
        `);
        console.log('🔍 DEBUG - All returns in system (sample):', allReturns.map(r => ({
          invoice_no: r.invoice_no,
          return_no: r.return_no,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone
        })));
      }
    }

    // Main query to get all customer transactions (sales + returns)
    // Returns are now stored as sale records with payment_method = 'REFUND'
    const [transactions] = await pool.execute(`
      SELECT 
        s.id as transaction_id,
        s.invoice_no,
        s.scope_type,
        s.scope_id,
        COALESCE(s.sale_date, s.created_at) as transaction_date,
        s.payment_method,
        s.payment_type,
        s.payment_status,
        s.payment_amount,
        s.credit_amount,
        s.old_balance, 
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
          WHEN s.payment_method = 'REFUND' AND s.payment_type = 'REFUND' THEN 'RETURN'
          ELSE 'SALE'
        END as transaction_type,
        -- Use actual payment_amount and credit_amount from database
        s.payment_amount as paid_amount,
        s.credit_amount as credit_amount,
        -- Amount is the current bill subtotal only
        s.subtotal as amount,
        sr.id as return_id,
        sr.reason as return_reason,
        CASE 
          WHEN s.payment_method = 'REFUND' THEN ABS(s.total)
          ELSE NULL
        END as return_refund_amount
      FROM sales s
      LEFT JOIN sales_returns sr ON s.invoice_no = sr.return_no
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
      ${whereClause}

      ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    console.log('🔍 Total transactions found:', transactions.length);
    const returnTransactions = transactions.filter(t => t.transaction_type === 'RETURN' || (t.payment_method === 'REFUND' && t.payment_type === 'REFUND'));
    console.log('🔍 Return transactions found:', returnTransactions.length);
    console.log('🔍 All transaction types:', transactions.map(t => ({
      invoice: t.invoice_no,
      type: t.transaction_type,
      payment_method: t.payment_method,
      payment_type: t.payment_type,
      customer_name: t.customer_name,
      customer_phone: t.customer_phone,
      return_id: t.return_id
    })));
    if (returnTransactions.length > 0) {
      console.log('🔍 Return transactions details:', returnTransactions.map(t => ({
        invoice: t.invoice_no,
        return_id: t.return_id,
        amount: t.amount,
        old_balance: t.old_balance,
        running_balance: t.running_balance,
        customer_name: t.customer_name
      })));
    }

    // Get total count for pagination (sales + returns)
    // Returns are now included in the main sales query, so just count sales
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total FROM sales s
      LEFT JOIN sales_returns sr ON s.invoice_no = sr.return_no
      ${whereClause}
    `, params);

    // Sort transactions in ascending order by date to process them chronologically
    // Use transaction_date (= COALESCE(sale_date, created_at)) so backdated sales appear in correct sequence
const sortedTransactions = [...transactions].sort((a, b) => {
  const dateA = new Date(a.transaction_date || a.created_at || 0);
  const dateB = new Date(b.transaction_date || b.created_at || 0);
  if (dateA.getTime() === dateB.getTime()) return (a.transaction_id || 0) - (b.transaction_id || 0);
  return dateA - dateB;
});
    
    console.log('🔍 Sorted transactions for balance calculation:', sortedTransactions.map(t => ({
      invoice: t.invoice_no,
      date: t.transaction_date || t.created_at,
      type: t.transaction_type,
      amount: t.amount,
      credit_amount: t.credit_amount,
      payment_method: t.payment_method
    })));
    
    const normalizedAsc = normalizeLedgerTransactions(sortedTransactions).map(transaction => ({
      ...transaction,
      transaction_type_display: getTransactionTypeDisplay(transaction),
      payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
    }));

    // Sort back to descending order for display (newest first)
const finalTransactions = [...normalizedAsc].sort((a, b) => {
  const dateA = new Date(a.transaction_date || a.created_at || 0);
  const dateB = new Date(b.transaction_date || b.created_at || 0);
  if (dateA.getTime() === dateB.getTime()) return (b.transaction_id || 0) - (a.transaction_id || 0);
  return dateB - dateA;
});

    // If detailed is requested, fetch items for each transaction
    let detailedTransactions = finalTransactions;
    console.log('🔍 CHECKING DETAILED CONDITION - detailed:', detailed, 'detailed === "true":', detailed === 'true');
    if (detailed === 'true') {
      console.log('✅ DETAILED LEDGER REQUESTED for customer:', customerId)
      detailedTransactions = await Promise.all(
        finalTransactions.map(async (transaction) => {
          try {
            console.log(`Fetching items for transaction ${transaction.transaction_id}, type: ${transaction.transaction_type}`)
            
            let items = [];
            
            // Check if this is a return transaction
            if (transaction.transaction_type === 'RETURN' || transaction.return_id) {
              // Fetch return items from sales_return_items
              const [returnItems] = await pool.execute(`
                SELECT 
                  sri.*,
                  ii.name as item_name,
                  ii.sku,
                  ii.selling_price as catalog_price,
                  ii.cost_price,
                  ii.category
                FROM sales_return_items sri
                LEFT JOIN inventory_items ii ON sri.inventory_item_id = ii.id
                WHERE sri.return_id = ?
                ORDER BY sri.id
              `, [transaction.return_id || transaction.transaction_id]);
              
              // Transform return items to match sale_items format
              items = returnItems.map(item => ({
                id: item.id,
                sale_id: item.return_id, // Map return_id to sale_id for compatibility
                inventory_item_id: item.inventory_item_id,
                item_name: item.item_name || item.name || 'Unknown Item',
                name: item.item_name || item.name || 'Unknown Item',
                sku: item.sku || 'N/A',
                quantity: parseFloat(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                original_price: parseFloat(item.unit_price) || 0,
                discount: 0,
                total: parseFloat(item.refund_amount) || 0,
                refund_amount: parseFloat(item.refund_amount) || 0,
                catalog_price: parseFloat(item.catalog_price) || 0,
                cost_price: parseFloat(item.cost_price) || 0,
                category: item.category || null
              }));
              
              console.log(`Return transaction ${transaction.transaction_id} has ${items.length} return items`);
            } else {
              // Fetch sale items from sale_items
              const [saleItems] = await pool.execute(`
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
              
              items = saleItems;
              console.log(`Sale transaction ${transaction.transaction_id} has ${items.length} items`);
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
    }

    // Get customer summary
    const customerSummary = await getCustomerSummary(customerId, req.user);

    console.log('🔍 FINAL RESPONSE - Number of transactions:', detailedTransactions.length);
    console.log('🔍 FINAL RESPONSE - First transaction has items?', detailedTransactions[0]?.items ? 'YES' : 'NO');
    console.log('🔍 FINAL RESPONSE - First transaction items count:', detailedTransactions[0]?.items?.length || 0);

    // CORRECTED Summary Calculation
    const summaryStats = computeLedgerSummary(normalizedAsc);

    const totalCredit = normalizedAsc.reduce((sum, t) => {
      if (t.transaction_type === 'SALE') {
        return sum + parseFloat(t.credit_amount || 0);
      }
      return sum;
    }, 0);

    // ✅ FIX: Group transactions by customer when viewing all customers
    let responseData = {
      customer: customerSummary,
      transactions: detailedTransactions,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + transactions.length) < countResult[0].total
      },
      summary: {
        totalTransactions: summaryStats.totalTransactions,
        totalAmount: summaryStats.totalAmount, // Sum of Amount column only (sales - returns)
        totalPaid: summaryStats.totalPaid, // Sum of positive payments
        totalRefunded: summaryStats.totalRefunded,
        netPaid: summaryStats.netPaid,
        totalCredit: totalCredit, // Sum of Credit amounts
        outstandingBalance: summaryStats.outstandingBalance // Final running balance from last transaction
      }
    };

    // If viewing all customers, group transactions by customer
    if (isAllCustomers) {
      console.log('🔍 Grouping transactions by customer for all customers view');
      
      // Group transactions by customer
      const customerGroups = new Map();
      
      detailedTransactions.forEach(transaction => {
        const customerKey = buildCustomerKey(
          transaction.customer_name || 'Unknown Customer',
          transaction.customer_phone || ''
        );
        
        if (!customerGroups.has(customerKey)) {
          customerGroups.set(customerKey, {
            customer: {
              name: transaction.customer_name || 'Unknown Customer',
              phone: transaction.customer_phone || '',
              key: customerKey
            },
            transactions: []
          });
        }
        
        customerGroups.get(customerKey).transactions.push(transaction);
      });
      
      // Calculate summary for each customer group
      const groupedLedgers = Array.from(customerGroups.values()).map(group => {
        const groupTransactions = group.transactions;
        const groupSummary = computeLedgerSummary(groupTransactions);
        
        const groupTotalCredit = groupTransactions.reduce((sum, t) => {
          if (t.transaction_type === 'SALE') {
            return sum + parseFloat(t.credit_amount || 0);
          }
          return sum;
        }, 0);
        
        return {
          customer: group.customer,
          transactions: groupTransactions,
          summary: {
            totalTransactions: groupSummary.totalTransactions,
            totalAmount: groupSummary.totalAmount,
            totalPaid: groupSummary.totalPaid,
            totalRefunded: groupSummary.totalRefunded,
            netPaid: groupSummary.netPaid,
            totalCredit: groupTotalCredit,
            outstandingBalance: groupSummary.outstandingBalance
          }
        };
      });
      
      // Sort by customer name
      groupedLedgers.sort((a, b) => {
        const nameA = (a.customer?.name || '').toLowerCase();
        const nameB = (b.customer?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      responseData.groupedLedgers = groupedLedgers;
      responseData.customer = {
        ...customerSummary,
        unique_customers: groupedLedgers.length
      };
      
      console.log('🔍 Grouped ledger data:', {
        totalGroups: groupedLedgers.length,
        sampleGroup: groupedLedgers[0] ? {
          customer: groupedLedgers[0].customer,
          transactionCount: groupedLedgers[0].transactions.length,
          summary: groupedLedgers[0].summary
        } : null
      });
    }

    // Add debug info to response (only in development or if explicitly requested)
    const includeDebug = req.query.debug === 'true' || process.env.NODE_ENV === 'development';
    const responseWithDebug = {
      ...responseData,
      ...(includeDebug ? {
        debug: {
          customerId,
          totalTransactions: transactions.length,
          returnTransactionsCount: returnTransactions.length,
          returnTransactions: returnTransactions.map(t => ({
            invoice: t.invoice_no,
            return_id: t.return_id,
            customer_name: t.customer_name,
            customer_phone: t.customer_phone,
            old_balance: t.old_balance,
            running_balance: t.running_balance
          })),
          whereClause,
          paramsCount: params.length
        }
      } : {})
    };

    res.json({
      success: true,
      data: responseWithDebug
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
        -- Sum of actual payment amounts (excluding FULLY_CREDIT, but including negative for returns)
        -- Note: This is recalculated later using computeLedgerSummary, so this is just for initial grouping
        SUM(CASE 
          WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 
          WHEN s.payment_method = 'REFUND' THEN 0  -- Returns will be handled in computeLedgerSummary
          ELSE GREATEST(s.payment_amount, 0) 
        END) as total_paid,
        -- Sum of subtotal amounts (actual bill amounts, includes negative for returns)
        SUM(s.subtotal) as total_amount,
        -- Use the latest running_balance for current balance (SIMPLIFIED)
        (
          SELECT s2.running_balance
          FROM sales s2
          WHERE s2.customer_name = s.customer_name
            AND s2.customer_phone = s.customer_phone
            ORDER BY COALESCE(s2.sale_date, s2.created_at) DESC, s2.id DESC
          LIMIT 1
        ) as current_balance,
        MAX(COALESCE(s.sale_date, s.created_at)) as last_transaction_date,
        MIN(COALESCE(s.sale_date, s.created_at)) as first_transaction_date
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

    if (customers.length === 0) {
      return res.json({
        success: true,
        data: {
          customers: [],
          pagination: {
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: false
          }
        }
      });
    }

    const customerKeys = customers.map(customer =>
      buildCustomerKey(customer.customer_name, customer.customer_phone)
    );

    const keyPlaceholders = customerKeys.map(() => '?').join(', ');

    let transactionsByCustomer = new Map();

    if (customerKeys.length > 0) {
      const baseConditionString = baseWhereConditions.join(' AND ');
      const scopedSalesCondition = baseWhereConditions.length > 0
        ? `${baseConditionString} AND CONCAT(IFNULL(s.customer_name,''),'|',IFNULL(s.customer_phone,'')) IN (${keyPlaceholders})`
        : `CONCAT(IFNULL(s.customer_name,''),'|',IFNULL(s.customer_phone,'')) IN (${keyPlaceholders})`;

      // For returns, we query from sales s_return, so use s_return alias
      const returnsScopeCondition = baseWhereConditions.length > 0
        ? `${baseConditionString.replace(/s\./g, 's_return.')} AND CONCAT(IFNULL(s_return.customer_name,''),'|',IFNULL(s_return.customer_phone,'')) IN (${keyPlaceholders})`
        : `CONCAT(IFNULL(s_return.customer_name,''),'|',IFNULL(s_return.customer_phone,'')) IN (${keyPlaceholders})`;

      // ✅ FIXED: Returns are already stored in sales table, so we don't need UNION ALL
      // Just query sales table and exclude returns from the first part, or include them once
      // Since returns are in sales table with payment_method='REFUND', we can query them directly
      const transactionsQuery = `
        SELECT
          CASE 
            WHEN s.payment_method = 'REFUND' AND s.payment_type = 'REFUND' THEN 'RETURN'
            ELSE 'SALE'
          END as source,
          s.id as transaction_id,
          s.invoice_no,
          s.subtotal as amount,
          s.total as total,
          s.payment_amount,
          s.credit_amount,
          s.payment_method,
          s.payment_type,
          s.payment_status,
          s.running_balance,
          COALESCE(s.sale_date, s.created_at) as transaction_date,
          s.customer_name,
          s.customer_phone,
          CONCAT(IFNULL(s.customer_name,''),'|',IFNULL(s.customer_phone,'')) as customer_key
        FROM sales s
        WHERE ${scopedSalesCondition}

        ORDER BY transaction_date ASC, transaction_id ASC
      `;

      // ✅ FIXED: Simplified params since we removed the UNION ALL (no longer need duplicate params)
      const transactionsParams = [
        ...baseParams,
        ...customerKeys
      ];

      const [transactionRows] = await pool.execute(transactionsQuery, transactionsParams);

      // ✅ FIXED: Remove duplicate transactions (returns can appear multiple times due to JOIN)
      // Use a Set to track unique transaction IDs per customer
      const seenTransactions = new Map(); // Map<customer_key, Set<transaction_id>>
      
      transactionsByCustomer = transactionRows.reduce((map, row) => {
        const key = row.customer_key;
        if (!map.has(key)) {
          map.set(key, []);
          seenTransactions.set(key, new Set());
        }

        // Check if we've already seen this transaction for this customer
        const transactionId = `${row.transaction_id}_${row.invoice_no}`;
        const seenSet = seenTransactions.get(key);
        
        if (seenSet.has(transactionId)) {
          // Skip duplicate transaction
          console.log(`⚠️ Skipping duplicate transaction: ${transactionId} for customer ${key}`);
          return map;
        }
        
        seenSet.add(transactionId);

        const isReturn = row.source === 'RETURN' || row.payment_method === 'REFUND' || row.payment_type === 'REFUND';
        
        map.get(key).push({
          ...row,
          transaction_type: isReturn ? 'RETURN' : 'SALE',
          subtotal: row.amount,
          total: row.total ?? row.amount,
          amount: row.amount,
          paid_amount: row.payment_amount,
          payment_amount: row.payment_amount, // Ensure both fields are present
          payment_method: isReturn ? 'REFUND' : (row.payment_method || 'CASH'),
          payment_type: isReturn ? 'REFUND' : (row.payment_type || 'FULL_PAYMENT')
        });
        return map;
      }, new Map());
    }

    // Process customers with normalized ledger data (includes returns and settlements)
    const customersWithBalance = customers.map(customer => {
      const key = buildCustomerKey(customer.customer_name, customer.customer_phone);
      const customerTransactions = transactionsByCustomer.get(key) || [];

      const normalizedTransactions = normalizeLedgerTransactions(customerTransactions);
      const summaryStats = computeLedgerSummary(normalizedTransactions);

      const totalCredit = normalizedTransactions.reduce((sum, transaction) => {
        if (transaction.transaction_type === 'SALE') {
          const creditValue = parseFloat(transaction.credit_amount || 0);
          return sum + (Number.isFinite(creditValue) ? creditValue : 0);
        }
        return sum;
      }, 0);

      const lastTransactionDate = normalizedTransactions.length > 0
        ? normalizedTransactions[normalizedTransactions.length - 1].transaction_date || normalizedTransactions[normalizedTransactions.length - 1].created_at
        : customer.last_transaction_date;

      const firstTransactionDate = normalizedTransactions.length > 0
        ? normalizedTransactions[0].transaction_date || normalizedTransactions[0].created_at
        : customer.first_transaction_date;

      // Debug logging for summary calculation
      if (customer.customer_name === 'rab nawaz' || customer.customer_name === 'Latif') {
        const returnTransactions = normalizedTransactions.filter(t => t.transaction_type === 'RETURN');
        const saleTransactions = normalizedTransactions.filter(t => t.transaction_type === 'SALE');
        const numeric = (value) => {
          const num = parseFloat(value);
          return Number.isFinite(num) ? num : 0;
        };
        
        console.log(`🔍 Summary for ${customer.customer_name}:`, {
          transactionCount: normalizedTransactions.length,
          returnCount: returnTransactions.length,
          saleCount: saleTransactions.length,
          summaryStats,
          allTransactions: normalizedTransactions.map(t => ({
            invoice: t.invoice_no,
            type: t.transaction_type,
            amount: t.amount,
            subtotal: t.subtotal,
            paid: t.paid_amount || t.payment_amount,
            payment_method: t.payment_method,
            payment_type: t.payment_type,
            running_balance: t.running_balance || t.balance
          })),
          calculatedTotalAmount: normalizedTransactions.reduce((sum, t) => sum + numeric(t.amount), 0),
          calculatedTotalPaid: normalizedTransactions.reduce((sum, t) => {
            const payment = numeric(t.corrected_paid ?? t.paid_amount ?? t.payment_amount);
            const isReturn = t.transaction_type === 'RETURN' || t.payment_method === 'REFUND' || t.payment_type === 'REFUND';
            if (isReturn) return sum;
            if (payment > 0) return sum + payment;
            return sum;
          }, 0)
        });
      }

      // Add debug info for specific customers (can be removed later)
      const debugInfo = (customer.customer_name === 'rab nawaz' || customer.customer_name === 'Latif') ? {
        _debug: {
          transactionCount: normalizedTransactions.length,
          returnCount: normalizedTransactions.filter(t => t.transaction_type === 'RETURN').length,
          saleCount: normalizedTransactions.filter(t => t.transaction_type === 'SALE').length,
          transactionAmounts: normalizedTransactions.map(t => ({
            invoice: t.invoice_no,
            type: t.transaction_type,
            amount: t.amount,
            subtotal: t.subtotal
          }))
        }
      } : {};

      return {
        customer_id: customer.customer_name,
        customer_name: customer.customer_name,
        customer_phone: customer.customer_phone,
        total_transactions: summaryStats.totalTransactions || customer.total_transactions,
        total_amount: summaryStats.totalAmount,
        total_paid: summaryStats.totalPaid,
        net_paid: summaryStats.netPaid,
        total_refunded: summaryStats.totalRefunded,
        total_credit: totalCredit,
        current_balance: summaryStats.outstandingBalance,
        last_transaction_date: lastTransactionDate,
        first_transaction_date: firstTransactionDate,
        has_outstanding_balance: Math.abs(summaryStats.outstandingBalance) > 0.01,
        ...debugInfo
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
// @desc    Export customer ledger to PDF
// @route   GET /api/customer-ledger/:customerId/export
// @access  Private (Admin, Cashier, Warehouse Keeper)
const exportCustomerLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate, format = 'pdf', detailed = 'false' } = req.query;

    // Get customer ledger data (same as getCustomerLedger but without pagination)
    const ledgerData = await getCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });
    const processedLedgerAsc = normalizeLedgerTransactions(ledgerData).map((transaction) => ({
      ...transaction,
      transaction_type_display: transaction.transaction_type_display || getTransactionTypeDisplay(transaction),
      payment_status_display: transaction.payment_status_display || getPaymentStatusDisplay(transaction.payment_status)
    }));
    const processedLedgerDesc = [...processedLedgerAsc].sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at);
      const dateB = new Date(b.transaction_date || b.created_at);
      return dateB - dateA;
    });

    // If detailed export is requested, fetch items for each transaction
    if (detailed === 'true') {
      console.log('Detailed export requested for customer:', customerId);
      
      // Use the FIXED function for detailed data
      const detailedLedgerData = await getDetailedCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });
      
      console.log('Detailed ledger data:', detailedLedgerData.length, 'transactions');
      
      // ✅ IMPORTANT: Normalize the detailed transactions (this will calculate balances correctly)
      const normalizedTransactions = normalizeLedgerTransactions(detailedLedgerData);
      
      // Add display fields
      const processedWithDisplay = normalizedTransactions.map((transaction) => ({
        ...transaction,
        transaction_type_display: getTransactionTypeDisplay(transaction),
        payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
      }));
      
      // Sort back to descending order for display
      const processedDetailedDesc = [...processedWithDisplay].sort((a, b) => {
        const dateA = new Date(a.transaction_date || a.created_at);
        const dateB = new Date(b.transaction_date || b.created_at);
        return dateB - dateA;
      });

      if (format === 'pdf') {
        // Generate HTML content for detailed PDF
        const htmlContent = generateDetailedCustomerLedgerPDF(processedWithDisplay);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="detailed-customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
        res.send(htmlContent);
      } else {
        // Return detailed JSON data for other formats
        res.json({
          success: true,
          data: {
            customer: await getCustomerSummary(customerId, req.user),
            transactions: processedDetailedDesc,
            pagination: {
              total: processedDetailedDesc.length,
              limit: 1000,
              offset: 0
            }
          }
        });
      }
    } else {
      // Original export functionality for non-detailed exports
      if (format === 'pdf') {
        // Generate HTML content for PDF (frontend will handle PDF generation)
        const htmlContent = generateCustomerLedgerPDF(processedLedgerAsc);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
        res.send(htmlContent);
      } else {
        // Return JSON data for other formats
        res.json({
          success: true,
          data: processedLedgerDesc
        });
      }
    }
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

    // If not found, get summary from sales data (with scope filtering)
    let summaryWhereConditions = ['(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)'];
    let summaryParams = [customerId, customerId, customerId, customerId];

    // Apply scope filtering if user is not admin
    const userBranchId = user.branch_id || user.branchId;
    const userWarehouseId = user.warehouse_id || user.warehouseId;
    
    if (user.role === 'CASHIER' && userBranchId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
      if (branches.length > 0) {
        summaryWhereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        summaryParams.push('BRANCH', branches[0].name);
      }
    } else if (user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
      if (warehouses.length > 0) {
        summaryWhereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
        summaryParams.push('WAREHOUSE', warehouses[0].name);
      }
    }

    const summaryWhereClause = `WHERE ${summaryWhereConditions.join(' AND ')}`;

    const [sales] = await pool.execute(`
      SELECT 
        COALESCE(s.customer_name, JSON_EXTRACT(s.customer_info, "$.name")) as name,
        COALESCE(s.customer_phone, JSON_EXTRACT(s.customer_info, "$.phone")) as phone,
        COUNT(*) as total_transactions,
        SUM(s.total) as total_sales,
        SUM(s.credit_amount) as current_balance, -- Fallback: sum of credit_amount
        MAX(s.created_at) as last_transaction
      FROM sales s
      ${summaryWhereClause}
      GROUP BY name, phone
      LIMIT 1
    `, summaryParams);

    // Attempt to find the latest running_balance from sales for this customer - this provides
    // a more accurate 'outstanding' / current balance than simple aggregates.
    try {
      const [latestRows] = await pool.execute(`
        SELECT running_balance FROM sales ${summaryWhereClause} ORDER BY COALESCE(sale_date, created_at) DESC, id DESC LIMIT 1
      `, summaryParams);

      const latestRunningBalance = latestRows && latestRows.length > 0 ? latestRows[0].running_balance : null;

      if (latestRunningBalance !== null && latestRunningBalance !== undefined) {
        // If we have an aggregated sales summary row, override its current_balance with the latest running balance
        if (sales && sales[0]) {
          sales[0].current_balance = latestRunningBalance;
        }

        // Return with running balance if no aggregate row was found
        if (!sales || sales.length === 0) {
          return { name: customerId, phone: '', total_transactions: 0, current_balance: latestRunningBalance };
        }
      }
    } catch (rbError) {
      console.warn('Could not resolve latest running_balance for customer summary:', rbError && rbError.message);
    }

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

  // Handle both branch_id and branchId for backward compatibility
  const userBranchId = user.branch_id || user.branchId;
  const userWarehouseId = user.warehouse_id || user.warehouseId;
  
  if (user.role === 'CASHIER' && userBranchId) {
    // For cashiers, we need to match by branch name since sales store scope_id as string
    const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
    if (branches.length > 0) {
    whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push('BRANCH', branches[0].name);
    }
  } else if (user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
    // For warehouse keepers, we need to match by warehouse name since sales store scope_id as string
    const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
    if (warehouses.length > 0) {
    whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push('WAREHOUSE', warehouses[0].name);
    }
  }

  whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
  params.push(customerId, customerId, customerId, customerId);

  if (startDate) {
    whereConditions.push('COALESCE(s.sale_date, s.created_at) >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push('COALESCE(s.sale_date, s.created_at) <= ?');
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const [transactions] = await pool.execute(`
    SELECT
      s.id as transaction_id,
      s.invoice_no,
      s.scope_type,
      s.scope_id,
      COALESCE(s.sale_date, s.created_at) as transaction_date,
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
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
    ${whereClause}
    ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
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
// Helper function to get detailed customer ledger data with items (FIXED VERSION)
// Helper function to get detailed customer ledger data with items (FIXED VERSION)
// Helper function to get detailed customer ledger data with items (FIXED VERSION)
const getDetailedCustomerLedgerData = async (customerId, user, options = {}) => {
  const { startDate, endDate, limit = 1000 } = options;
  
  // Build WHERE conditions (same logic as getCustomerLedger)
  let whereConditions = [];
  let params = [];

  // Handle both branch_id and branchId for backward compatibility
  const userBranchId = user.branch_id || user.branchId;
  const userWarehouseId = user.warehouse_id || user.warehouseId;
  
  if (user.role === 'CASHIER' && userBranchId) {
    const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [userBranchId]);
    if (branches.length > 0) {
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push('BRANCH', branches[0].name);
    }
  } else if (user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
    const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
    if (warehouses.length > 0) {
      whereConditions.push('(s.scope_type = ? AND s.scope_id = ?)');
      params.push('WAREHOUSE', warehouses[0].name);
    }
  }

  whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
  params.push(customerId, customerId, customerId, customerId);

  if (startDate) {
    whereConditions.push('COALESCE(s.sale_date, s.created_at) >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push('COALESCE(s.sale_date, s.created_at) <= ?');
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // ✅ FIXED: USE EXACT SAME QUERY AS getCustomerLedger (including the LEFT JOIN sales_returns)
  const [transactions] = await pool.execute(`
    SELECT
      s.id as transaction_id,
      s.invoice_no,
      s.scope_type,
      s.scope_id,
      COALESCE(s.sale_date, s.created_at) as transaction_date,
      s.payment_method,
      s.payment_type,
      s.payment_status,
      s.payment_amount,
      s.credit_amount,
      s.old_balance, 
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
        WHEN s.payment_method = 'REFUND' AND s.payment_type = 'REFUND' THEN 'RETURN'
        ELSE 'SALE'
      END as transaction_type,
      -- Use actual payment_amount and credit_amount from database
      s.payment_amount as paid_amount,
      s.credit_amount as credit_amount,
      -- Amount is the current bill subtotal only
      s.subtotal as amount,
      sr.id as return_id,
      sr.reason as return_reason,
      CASE 
        WHEN s.payment_method = 'REFUND' THEN ABS(s.total)
        ELSE NULL
      END as return_refund_amount
    FROM sales s
    LEFT JOIN sales_returns sr ON s.invoice_no = sr.return_no  -- ✅ CRITICAL: This was missing!
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
    ${whereClause}
    ORDER BY COALESCE(s.sale_date, s.created_at) ASC, s.id ASC
    LIMIT ?
  `, [...params, limit]);

  console.log(`🔍 Detailed ledger: Found ${transactions.length} transactions for ${customerId}`);
  console.log('🔍 Sample transaction from detailed query:', transactions[0] ? {
    invoice: transactions[0].invoice_no,
    type: transactions[0].transaction_type,
    old_balance: transactions[0].old_balance,
    amount: transactions[0].amount,
    running_balance: transactions[0].running_balance,
    return_id: transactions[0].return_id
  } : null);

  // Sort transactions by date in ascending order before processing items
  // Use transaction_date (COALESCE of sale_date, created_at) so backdated sales are in correct sequence
transactions.sort((a, b) => {
  const dateA = new Date(a.transaction_date || a.created_at || 0);
  const dateB = new Date(b.transaction_date || b.created_at || 0);
  if (dateA.getTime() === dateB.getTime()) return (a.transaction_id || 0) - (b.transaction_id || 0);
  return dateA - dateB;
});

  // For each transaction, get the detailed items
  const detailedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      try {
        console.log(`Fetching items for transaction ${transaction.transaction_id}, type: ${transaction.transaction_type}, return_id: ${transaction.return_id}`);
        
        let items = [];
        
        // Check if this is a return transaction - use the CORRECT condition
        if (transaction.transaction_type === 'RETURN' || transaction.return_id) {
          // For returns, fetch from sales_return_items
          console.log(`Fetching return items for transaction ${transaction.transaction_id}, return_id: ${transaction.return_id}`);
          
          const [returnItems] = await pool.execute(`
            SELECT 
              sri.*,
              ii.name as item_name,
              ii.sku,
              ii.selling_price as catalog_price,
              ii.cost_price,
              ii.category
            FROM sales_return_items sri
            LEFT JOIN inventory_items ii ON sri.inventory_item_id = ii.id
            WHERE sri.return_id = ? OR sri.sale_id = ?
            ORDER BY sri.created_at ASC, sri.id ASC  -- ✅ Order items chronologically
          `, [transaction.return_id || transaction.transaction_id, transaction.transaction_id]);
          
          // Transform return items to match sale_items format
          items = returnItems.map(item => ({
            id: item.id,
            sale_id: transaction.transaction_id,
            inventory_item_id: item.inventory_item_id,
            item_name: item.item_name || item.name || 'Unknown Item',
            name: item.item_name || item.name || 'Unknown Item',
            sku: item.sku || 'N/A',
            quantity: parseFloat(item.quantity) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            original_price: parseFloat(item.unit_price) || 0,
            discount: 0,
            total: parseFloat(item.refund_amount) || 0,
            refund_amount: parseFloat(item.refund_amount) || 0,
            catalog_price: parseFloat(item.catalog_price) || 0,
            cost_price: parseFloat(item.cost_price) || 0,
            category: item.category || null,
            created_at: item.created_at || transaction.transaction_date  // Preserve item creation time
          }));
          
          console.log(`Return transaction ${transaction.transaction_id} has ${items.length} return items`);
        } else {
          // Fetch sale items from sale_items
          console.log(`Fetching sale items for transaction ${transaction.transaction_id}`);
          
          const [saleItems] = await pool.execute(`
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
            ORDER BY si.created_at ASC, si.id ASC  -- ✅ Order items chronologically
          `, [transaction.transaction_id]);
          
          items = saleItems.map(item => ({
            ...item,
            created_at: item.created_at || transaction.transaction_date  // Preserve item creation time
          }));
          console.log(`Sale transaction ${transaction.transaction_id} has ${items.length} items`);
        }

        // Sort items within each transaction by creation date (oldest first)
        items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Return transaction with items - DO NOT RECALCULATE BALANCES HERE
        // The normalizeLedgerTransactions function will handle balance calculations
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

  // ✅ Ensure final array is sorted by transaction date (ascending - oldest first)
  // Use transaction_date so backdated sales appear in correct chronological position
detailedTransactions.sort((a, b) => {
  const dateA = new Date(a.transaction_date || a.created_at || 0);
  const dateB = new Date(b.transaction_date || b.created_at || 0);
  if (dateA.getTime() === dateB.getTime()) return (a.transaction_id || 0) - (b.transaction_id || 0);
  return dateA - dateB;
});
  // ✅ CRITICAL: DO NOT RECALCULATE BALANCES HERE!
  // Just return the transactions with items, let normalizeLedgerTransactions handle the balances
  // This ensures consistency with getCustomerLedger
  console.log('🔍 Detailed ledger processing complete - returning transactions in ascending order');
  
  // Optional: Log the date range for verification
  if (detailedTransactions.length > 0) {
    console.log(`📅 Date range: ${detailedTransactions[0].transaction_date} (oldest) to ${detailedTransactions[detailedTransactions.length - 1].transaction_date} (newest)`);
  }
  
  return detailedTransactions;
};/**
 * Normalize ledger transactions following REAL ACCOUNTING LEDGER principles.
 * 
 * CRITICAL RULES:
 * 1. OLD ROWS MUST NEVER BE MODIFIED - if running_balance exists in DB, keep all original values
 * 2. ONLY NEW ROWS SHOULD BE CALCULATED - old_balance = previous_row.running_balance
 * 3. DO NOT RECALCULATE THE ENTIRE LEDGER - only compute for new rows
 * 4. Ledger must always behave sequentially without altering history
 */
const normalizeLedgerTransactions = (transactions = []) => {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  // Sort transactions chronologically (oldest first) - required for sequential processing
  // IMPORTANT: use transaction_date (= COALESCE(sale_date, created_at)) so that backdated sales
  // slot into the correct position in the running balance chain, not by insertion time.
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateA = new Date(a.transaction_date || a.created_at || 0);
    const dateB = new Date(b.transaction_date || b.created_at || 0);
    if (dateA.getTime() === dateB.getTime()) {
      const idA = a.transaction_id || a.id || 0;
      const idB = b.transaction_id || b.id || 0;
      return idA - idB;
    }
    return dateA - dateB;
  });

  const normalized = [];
  let previousBalance = null;

  for (let i = 0; i < sortedTransactions.length; i++) {
    const transaction = sortedTransactions[i];
    
    // Check if this is an existing row (has running_balance in DB)
    const storedRunningBalance = parseFloat(
      transaction.running_balance ??
      transaction.runningBalance ??
      transaction.balance ??
      null
    );
    
    const isExistingRow = Number.isFinite(storedRunningBalance);

    if (isExistingRow) {
      // ✅ RULE 1: OLD ROW - DO NOT MODIFY
      // Keep all original values from database
      const existingOldBalance = parseFloat(
        transaction.old_balance ??
        transaction.oldBalance ??
        0
      );
      
      // Preserve original transaction data
      const {
        old_balance: _,
        total_amount: __,
        corrected_paid: ___,
        balance: ____,
        ...transactionBase
      } = transaction;

      // Determine transaction type for display
    const paymentMethod = transaction.payment_method;
    const paymentType = transaction.payment_type || transaction.paymentType || null;
    const rawTransactionType = (transaction.transaction_type || transaction.transactionType || '').toUpperCase();

      let normalizedType = rawTransactionType;
      if (!normalizedType) {
        if (paymentMethod === 'REFUND') {
          normalizedType = 'RETURN';
        } else if (paymentType === 'OUTSTANDING_SETTLEMENT') {
          normalizedType = 'SETTLEMENT';
        } else {
          normalizedType = 'SALE';
        }
      }

      // Extract original values
      const originalAmount = parseFloat(
        transaction.amount ??
        transaction.subtotal ??
        transaction.total ??
        0
      ) || 0;

      const originalPayment = parseFloat(
        transaction.corrected_paid ??
        transaction.paid_amount ??
        transaction.payment_amount ??
        0
      ) || 0;

      // Keep original old_balance or use 0 if not stored
      const preservedOldBalance = Number.isFinite(existingOldBalance) ? existingOldBalance : 0;
      
      // Calculate total_amount for display (old_balance + amount)
      const totalAmount = preservedOldBalance + originalAmount;

      normalized.push({
        ...transactionBase,
        payment_type: paymentType,
        transaction_type: normalizedType,
        old_balance: preservedOldBalance, // Keep original old_balance from DB
        amount: originalAmount, // Keep original amount
        total_amount: totalAmount, // Calculate for display only
        corrected_paid: originalPayment, // Keep original payment
        paid_amount: originalPayment, // Alias for compatibility
        running_balance: storedRunningBalance, // ✅ Keep original running_balance from DB
        balance: storedRunningBalance // Alias for compatibility
      });

      // Update previousBalance to this row's running_balance for next iteration
      previousBalance = storedRunningBalance;
      continue;
    }

    // ✅ RULE 2: NEW ROW - CALCULATE
    // This row doesn't have running_balance in DB, so calculate it
    
    const paymentMethod = transaction.payment_method;
    const paymentType = transaction.payment_type || transaction.paymentType || null;
    const rawTransactionType = (transaction.transaction_type || transaction.transactionType || '').toUpperCase();

    // Extract payment amount
    const paid = parseFloat(
      transaction.corrected_paid ??
      transaction.paid_amount ??
      transaction.payment_amount ??
      0
    ) || 0;

    // Extract amount (bill amount for this transaction)
    const amount = parseFloat(
      transaction.amount ??
      transaction.subtotal ??
      transaction.total ??
      0
    ) || 0;

    // Determine transaction type
    let normalizedType = rawTransactionType;
    if (!normalizedType) {
      if (paymentMethod === 'REFUND') {
        normalizedType = 'RETURN';
      } else if (paymentType === 'OUTSTANDING_SETTLEMENT') {
        normalizedType = 'SETTLEMENT';
      } else {
        normalizedType = 'SALE';
      }
    }

    // Calculate old_balance from previous row's running_balance
    const oldBalance = previousBalance ?? 0;

    // Calculate values based on transaction type
    let currentBillAmount = amount;
    let actualPayment = paid;
    let newBalance;

    if (paymentType === 'OUTSTANDING_SETTLEMENT' || normalizedType === 'SETTLEMENT') {
      // Settlement: amount = 0, payment reduces balance
      currentBillAmount = 0;
      if (paymentMethod === 'FULLY_CREDIT') {
        actualPayment = 0;
        }
      newBalance = oldBalance - actualPayment;
    } else if (normalizedType === 'RETURN' || paymentMethod === 'REFUND') {
      // Return: amount is negative, reduces balance
      currentBillAmount = amount; // Already negative
      actualPayment = 0; // Returns typically have no payment
      newBalance = oldBalance + currentBillAmount; // old_balance + (negative return)
    } else {
      // Sale: amount increases balance, payment reduces it
      currentBillAmount = amount;
      if (paymentMethod === 'FULLY_CREDIT' && paymentType !== 'OUTSTANDING_SETTLEMENT') {
        actualPayment = 0;
      }
      // ✅ RULE 4: new_balance = old_balance + amount - payment
      newBalance = oldBalance + currentBillAmount - actualPayment;
    }

    // Calculate total_amount for display
    const totalAmountDue = oldBalance + currentBillAmount;

    // Remove any existing calculated fields to avoid conflicts
    const {
      old_balance: _,
      total_amount: __,
      corrected_paid: ___,
      balance: ____,
      ...transactionBase
    } = transaction;

    // Create normalized transaction for new row
    normalized.push({
      ...transactionBase,
      payment_type: paymentType,
      transaction_type: normalizedType,
      old_balance: oldBalance, // Previous row's running_balance
      amount: currentBillAmount, // Bill amount for this transaction
      total_amount: totalAmountDue, // old_balance + amount
      corrected_paid: actualPayment, // Payment amount
      paid_amount: actualPayment, // Alias for compatibility
      running_balance: newBalance, // ✅ Calculated new balance
      balance: newBalance // Alias for compatibility
    });
    
    // Update previousBalance for next iteration
    previousBalance = newBalance;
  }

  return normalized;
};

const computeLedgerSummary = (transactions = []) => {
  const numeric = (value) => {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  };

  const totalTransactions = transactions.length;
  
  // ✅ FIXED: Calculate totalAmount correctly - sum of all amounts (sales are positive, returns are negative)
  // Use the normalized 'amount' field which is already correctly set for returns (negative) and sales (positive)
  const totalAmount = transactions.reduce((sum, transaction) => {
    // The 'amount' field from normalized transactions is already correct:
    // - For sales: positive (subtotal)
    // - For returns: negative (subtotal, which is negative in DB)
    const amount = numeric(transaction.amount);
    return sum + amount;
  }, 0);

  let totalPaid = 0;
  let totalRefunded = 0;

  transactions.forEach((transaction) => {
    // For returns, payment_amount is negative (represents refund)
    // For sales, payment_amount is positive (represents payment received)
    const payment = numeric(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount);
    const isReturn = transaction.transaction_type === 'RETURN' || 
                     transaction.payment_method === 'REFUND' || 
                     transaction.payment_type === 'REFUND';

    if (isReturn) {
      // Returns have negative payment_amount, add to refunded
      totalRefunded += Math.abs(payment);
    } else if (payment > 0) {
      // Regular payments (positive)
      totalPaid += payment;
    } else if (payment < 0) {
      // Negative payments (shouldn't happen for sales, but handle it)
      totalRefunded += Math.abs(payment);
    }
  });

  // Net paid = total paid - total refunded
  const netPaid = totalPaid - totalRefunded;
  
  // Outstanding balance = running_balance of the chronologically LATEST transaction.
  // We find it explicitly rather than trusting array order, so backdated sales that
  // appear early in the sorted array don't accidentally become the "last" item.
  let outstandingBalance = 0;
  if (totalTransactions > 0) {
    const latest = transactions.reduce((max, t) => {
      const tDate = new Date(t.transaction_date || t.created_at || 0).getTime();
      const mDate = new Date(max.transaction_date || max.created_at || 0).getTime();
      if (tDate > mDate) return t;
      if (tDate === mDate) {
        // same date → higher id wins
        return (t.transaction_id || t.id || 0) > (max.transaction_id || max.id || 0) ? t : max;
      }
      return max;
    });
    outstandingBalance = numeric(latest.balance ?? latest.running_balance);
  }

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
    totalRefunded,
    netPaid,
    outstandingBalance,
    completedTransactions,
    pendingTransactions,
    partialTransactions
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

// @desc    Update customer info (name + phone) in ledger and linked tables
// @route   PUT /api/customer-ledger/:customerId/update-info
// @access  Private (Admin only)
const updateCustomerLedgerInfo = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { name, phone } = req.body;

    if (!name && !phone) {
      return res.status(400).json({
        success: false,
        message: 'At least one of name or phone must be provided'
      });
    }

    // Build update fields for sales table
    const salesFields = [];
    const salesValues = [];
    if (name) {
      salesFields.push('customer_name = ?');
      salesValues.push(name);
    }
    if (phone) {
      salesFields.push('customer_phone = ?');
      salesValues.push(phone);
    }

    // 1. Find what type this customer is (branch customer or warehouse retailer)
    //    by looking at existing sales records
    const [existingSales] = await pool.execute(
      `SELECT DISTINCT customer_id, retailer_id, scope_type
       FROM sales
       WHERE customer_name = ? OR customer_phone = ?
       LIMIT 1`,
      [customerId, customerId]
    );

    let updatedCustomerRecord = null;
    let updatedRetailerRecord = null;

    if (existingSales.length > 0) {
      const { customer_id, retailer_id, scope_type } = existingSales[0];

      // 2a. If this is a branch customer, update the customers table
      if (customer_id) {
        const customerUpdateFields = [];
        const customerUpdateValues = [];
        if (name) { customerUpdateFields.push('name = ?'); customerUpdateValues.push(name); }
        if (phone) { customerUpdateFields.push('phone = ?'); customerUpdateValues.push(phone); }
        if (customerUpdateFields.length > 0) {
          customerUpdateValues.push(customer_id);
          await pool.execute(
            `UPDATE customers SET ${customerUpdateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            customerUpdateValues
          );
          const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [customer_id]);
          updatedCustomerRecord = rows[0] || null;
        }
      }

      // 2b. If this is a warehouse retailer, update the retailers table
      if (retailer_id) {
        const retailerUpdateFields = [];
        const retailerUpdateValues = [];
        if (name) { retailerUpdateFields.push('name = ?'); retailerUpdateValues.push(name); }
        if (phone) { retailerUpdateFields.push('phone = ?'); retailerUpdateValues.push(phone); }
        if (retailerUpdateFields.length > 0) {
          retailerUpdateValues.push(retailer_id);
          await pool.execute(
            `UPDATE retailers SET ${retailerUpdateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            retailerUpdateValues
          );
          const [rows] = await pool.execute('SELECT * FROM retailers WHERE id = ?', [retailer_id]);
          updatedRetailerRecord = rows[0] || null;
        }
      }
    }

    // 3. Always cascade update customer_name / customer_phone in sales
    const whereClause = 'customer_name = ? OR customer_phone = ?';
    salesValues.push(customerId, customerId);
    const [updateResult] = await pool.execute(
      `UPDATE sales SET ${salesFields.join(', ')} WHERE ${whereClause}`,
      salesValues
    );

    res.json({
      success: true,
      message: 'Customer info updated successfully',
      data: {
        salesUpdated: updateResult.affectedRows,
        customerRecord: updatedCustomerRecord,
        retailerRecord: updatedRetailerRecord
      }
    });
  } catch (error) {
    console.error('❌ Error in updateCustomerLedgerInfo:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer info',
      error: error.message
    });
  }
};

module.exports = {
  getCustomerLedger,
  getAllCustomersWithSummaries,
  exportCustomerLedger,
  updateCustomerLedgerInfo
};