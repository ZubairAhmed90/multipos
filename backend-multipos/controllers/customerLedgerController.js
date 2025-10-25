
const { pool } = require('../config/database');

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

    // Customer filtering
    whereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
    params.push(customerId, customerId, customerId, customerId);

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

    // Customer filtering for returns
    returnsWhereConditions.push('(s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)');
    returnsParams.push(customerId, customerId, customerId, customerId);

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
        'SALE' as transaction_type,
        -- Use actual payment_amount and credit_amount from database
        s.payment_amount as paid_amount,
        s.credit_amount as credit_amount,
        -- Calculate total bill amount for new Total Amount column
        CASE 
          WHEN s.payment_status = 'COMPLETED' THEN s.payment_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.payment_amount + s.credit_amount
          WHEN s.payment_status = 'PENDING' THEN s.payment_amount + s.credit_amount
          ELSE s.payment_amount + s.credit_amount
        END as total_amount,
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
        -sr.total_refund as total_amount,
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
      amount: t.subtotal
    })));
    
    // Calculate running balance with proper carry-forward logic
    let runningBalance = 0;
    const transactionsWithBalance = sortedTransactions.map((transaction, index) => {
      const paid = parseFloat(transaction.paid_amount || 0);
      const credit = parseFloat(transaction.credit_amount || 0);
      const subtotal = parseFloat(transaction.subtotal || 0);
      const total = parseFloat(transaction.total || 0);
      
      // Store the old balance before processing this transaction
      const oldBalance = runningBalance;
      
      // Calculate the current transaction's total amount (including old balance)
      const currentTotalAmount = subtotal + oldBalance;
      
      // Calculate the new balance after this transaction
      if (transaction.payment_method === 'FULLY_CREDIT') {
        // For FULLY_CREDIT: No payment, so balance increases by the current total amount
        runningBalance = currentTotalAmount;
      } else {
        // For other payment methods: Subtract payment from current total amount
        runningBalance = currentTotalAmount - paid;
      }
      
      // Debug logging for all transactions
      console.log(`🔍 Transaction ${index + 1}:`, {
        invoice: transaction.invoice_no,
        subtotal: subtotal, // Current bill amount (what they're buying now)
        oldBalance: oldBalance, // Outstanding from previous transactions
        currentTotalAmount: currentTotalAmount, // Total they owe (current + old)
        paid: paid, // What they paid now (0 for FULLY_CREDIT)
        payment_method: transaction.payment_method,
        newBalance: runningBalance // Remaining outstanding after this transaction
      });
      
      // Customer Ledger Display Logic:
      // - Amount: Current bill subtotal (what they're buying now) ✅
      // - Old Balance: Outstanding amount from previous transactions ✅
      // - Total Amount: Amount + Old Balance (total they owe) ✅
      // - Payment: What they paid now (0 for FULLY_CREDIT) ✅
      // - Balance: Remaining outstanding after this transaction ✅
      
      return {
        ...transaction,
        old_balance: oldBalance,
        total_amount: currentTotalAmount, // Total they owe (current + old)
        paid_amount: transaction.payment_method === 'FULLY_CREDIT' ? 0 : paid, // Override payment for FULLY_CREDIT
        running_balance: runningBalance, // Remaining outstanding after this transaction
        transaction_type_display: getTransactionTypeDisplay(transaction),
        payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
      };
    });
    
    // Sort back to descending order for display (newest first)
    const finalTransactions = transactionsWithBalance.sort((a, b) => {
      const dateA = new Date(a.transaction_date || a.created_at);
      const dateB = new Date(b.transaction_date || b.created_at);
      return dateB - dateA; // Descending order (newest first)
    });

    // If detailed is requested, fetch items for each transaction
    console.log('🔍 CHECKING DETAILED CONDITION - detailed:', detailed, 'detailed === "true":', detailed === 'true');
    if (detailed === 'true') {
      console.log('✅ DETAILED LEDGER REQUESTED for customer:', customerId)
      finalTransactions = await Promise.all(
        finalTransactions.map(async (transaction) => {
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

    console.log('🔍 FINAL RESPONSE - Number of transactions:', finalTransactions.length);
    console.log('🔍 FINAL RESPONSE - First transaction has items?', finalTransactions[0]?.items ? 'YES' : 'NO');
    console.log('🔍 FINAL RESPONSE - First transaction items count:', finalTransactions[0]?.items?.length || 0);

    res.json({
      success: true,
      data: {
        customer: customerSummary,
        transactions: finalTransactions,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + transactions.length) < countResult[0].total
        },
        summary: (() => {
          // Sum of "Amount" column only (current bill amounts, not including old balances)
          const totalAmount = finalTransactions.reduce((sum, t) => sum + parseFloat(t.subtotal || 0), 0);
          const totalPaid = finalTransactions.reduce((sum, t) => {
            // Use corrected payment amount (0 for FULLY_CREDIT)
            const correctedPaid = t.payment_method === 'FULLY_CREDIT' ? 0 : parseFloat(t.paid_amount || 0);
            return sum + correctedPaid;
          }, 0);
          const outstandingBalance = totalAmount - totalPaid; // Can be + or -
          
          console.log('📊 Summary Calculation:', {
            totalAmount, // Sum of Amount column only
            totalPaid,   // Sum of Payment column (corrected)
            outstandingBalance, // Total Amount - Total Paid (can be + or -)
            transactions: finalTransactions.length
          });
          
          return {
            totalTransactions: countResult[0].total,
            totalAmount: totalAmount, // Sum of Amount column only
            totalPaid: totalPaid, // Sum of Payment column (corrected for FULLY_CREDIT)
            totalCredit: finalTransactions.reduce((sum, t) => sum + parseFloat(t.credit_amount || 0), 0),
            outstandingBalance: outstandingBalance // Total Amount - Total Paid (can be + or -)
          };
        })()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving customer ledger',
      error: error.message
    });
  }
};

// @desc    Get all customers with their transaction summaries
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

    console.log('Query params:', { search, customerType, hasBalance, limit, offset })

    // Role-based filtering - will be applied differently based on query type
    let branchFilter = null;
    let warehouseFilter = null;
    
    // Handle both branch_id and branchId for backward compatibility
    const userBranchId = req.user.branch_id || req.user.branchId;
    const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
    
    if (req.user.role === 'CASHIER' && userBranchId) {
      console.log('✅ Applying CASHIER branch filter:', userBranchId)
      branchFilter = userBranchId;
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && userWarehouseId) {
      console.log('✅ Applying WAREHOUSE_KEEPER warehouse filter:', userWarehouseId)
      warehouseFilter = userWarehouseId;
    } else {
      console.log('❌ No scope filtering applied - user role:', req.user.role, 'branch_id:', userBranchId, 'warehouse_id:', userWarehouseId)
    }
    
    console.log('🔍 Final filters - branchFilter:', branchFilter, 'warehouseFilter:', warehouseFilter)

    // First, let's check if there are ANY sales records at all
    const [totalSalesCheck] = await pool.execute('SELECT COUNT(*) as total FROM sales')
    console.log('🔍 BACKEND DEBUG - Total sales in database:', totalSalesCheck[0].total)
    
    // Check sales by scope type
    const [branchSalesCheck] = await pool.execute('SELECT COUNT(*) as total FROM sales WHERE scope_type = ?', ['BRANCH'])
    console.log('🔍 BACKEND DEBUG - Total BRANCH sales:', branchSalesCheck[0].total)
    
    const [warehouseSalesCheck] = await pool.execute('SELECT COUNT(*) as total FROM sales WHERE scope_type = ?', ['WAREHOUSE'])
    console.log('🔍 BACKEND DEBUG - Total WAREHOUSE sales:', warehouseSalesCheck[0].total)

    // Check if customer_id column exists in sales table
    let customers;
    try {
      // Try the new query with customer_id column
      const customerParams = [];
      let customerWhereClause = 'WHERE c.status = \'ACTIVE\'';
      
      if (branchFilter) {
        customerWhereClause += ' AND c.branch_id = ?';
        customerParams.push(branchFilter);
      } else if (warehouseFilter) {
        customerWhereClause += ' AND c.warehouse_id = ?';
        customerParams.push(warehouseFilter);
      }
      
    if (search) {
        customerWhereClause += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      const searchTerm = `%${search}%`;
        customerParams.push(searchTerm, searchTerm);
      }
      
      [customers] = await pool.execute(`
        SELECT 
          c.id as customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          COUNT(DISTINCT s.id) as total_transactions,
          SUM(CASE WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 ELSE s.payment_amount END) as total_paid,
          SUM(s.subtotal) as total_amount,
          SUM(s.subtotal) - SUM(CASE WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 ELSE s.payment_amount END) as current_balance,
          MAX(s.created_at) as last_transaction_date,
          MIN(s.created_at) as first_transaction_date
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        ${customerWhereClause}
        GROUP BY c.id, c.name, c.phone
        HAVING total_transactions > 0
        ORDER BY last_transaction_date DESC
        LIMIT ? OFFSET ?
      `, [...customerParams, parseInt(limit), parseInt(offset)]);
      console.log('✅ Used customer_id column query');
      console.log('🔍 Primary query found customers:', customers.length);
      customers.forEach(c => {
        console.log('  - Primary:', c.customer_name, '| Phone:', c.customer_phone, '| Total Paid:', c.total_paid, '| Total Credit:', c.total_credit, '| Transactions:', c.total_transactions);
        if (c.customer_name === 'ali nawaz') {
          console.log('🔍 DETAILED ali nawaz data:', c);
        }
      });
    } catch (error) {
      console.log('⚠️ customer_id column not found, using fallback query');
      // Fallback to the old query structure
      const salesParams = [];
      let salesWhereConditions = [];
      
      if (branchFilter) {
        // Get branch name from branch ID for fallback query
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchFilter]);
        if (branches.length > 0) {
          salesWhereConditions.push('s.scope_type = ? AND s.scope_id = ?');
          salesParams.push('BRANCH', branches[0].name);
        }
      } else if (warehouseFilter) {
        // Get warehouse name from warehouse ID for fallback query
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseFilter]);
        if (warehouses.length > 0) {
          salesWhereConditions.push('s.scope_type = ? AND s.scope_id = ?');
          salesParams.push('WAREHOUSE', warehouses[0].name);
        }
      }
      
      if (search) {
        salesWhereConditions.push('(s.customer_name LIKE ? OR s.customer_phone LIKE ? OR JSON_EXTRACT(s.customer_info, "$.name") LIKE ? OR JSON_EXTRACT(s.customer_info, "$.phone") LIKE ?)');
        const searchTerm = `%${search}%`;
        salesParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      const salesWhereClause = salesWhereConditions.length > 0 ? `WHERE ${salesWhereConditions.join(' AND ')}` : '';
      
      [customers] = await pool.execute(`
      SELECT 
        COALESCE(s.customer_name, JSON_EXTRACT(s.customer_info, "$.name")) as customer_name,
        COALESCE(s.customer_phone, JSON_EXTRACT(s.customer_info, "$.phone")) as customer_phone,
        COUNT(DISTINCT s.id) as total_transactions,
        SUM(CASE WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 ELSE s.payment_amount END) as total_paid,
        SUM(s.subtotal) as total_amount,
        SUM(s.subtotal) - SUM(CASE WHEN s.payment_method = 'FULLY_CREDIT' THEN 0 ELSE s.payment_amount END) as current_balance,
        MAX(s.created_at) as last_transaction_date,
        MIN(s.created_at) as first_transaction_date
      FROM sales s
        ${salesWhereClause}
      GROUP BY customer_name, customer_phone
      ORDER BY last_transaction_date DESC
      LIMIT ? OFFSET ?
      `, [...salesParams, parseInt(limit), parseInt(offset)]);
      console.log('🔍 Fallback query found customers:', customers.length);
      customers.forEach(c => {
        console.log('  - Fallback:', c.customer_name, '| Phone:', c.customer_phone, '| Total Paid:', c.total_paid, '| Total Credit:', c.total_credit, '| Transactions:', c.total_transactions);
        if (c.customer_name === 'ali nawaz') {
          console.log('🔍 DETAILED ali nawaz fallback data:', c);
        }
      });
    }

    console.log('🔍 BACKEND DEBUG - Query executed, found customers:', customers.length)
    console.log('🔍 BACKEND DEBUG - Sample customer data:', customers.slice(0, 2))

    // Get total count with fallback
    let countResult;
    try {
      const countParams = [];
      let countWhereClause = 'WHERE c.status = \'ACTIVE\'';
      
      if (branchFilter) {
        countWhereClause += ' AND c.branch_id = ?';
        countParams.push(branchFilter);
      } else if (warehouseFilter) {
        countWhereClause += ' AND c.warehouse_id = ?';
        countParams.push(warehouseFilter);
      }
      
      if (search) {
        countWhereClause += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm);
      }
      
      [countResult] = await pool.execute(`
        SELECT COUNT(DISTINCT c.id) as total
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        ${countWhereClause}
        AND EXISTS (SELECT 1 FROM sales s2 WHERE s2.customer_id = c.id)
      `, countParams);
    } catch (error) {
      // Fallback count query
      const salesCountParams = [];
      let salesCountWhereClause = 'WHERE 1=1';
      
      if (branchFilter) {
        // Get branch name from branch ID for fallback count query
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchFilter]);
        if (branches.length > 0) {
          salesCountWhereClause += ' AND s.scope_type = ? AND s.scope_id = ?';
          salesCountParams.push('BRANCH', branches[0].name);
        }
      } else if (warehouseFilter) {
        // Get warehouse name from warehouse ID for fallback count query
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseFilter]);
        if (warehouses.length > 0) {
          salesCountWhereClause += ' AND s.scope_type = ? AND s.scope_id = ?';
          salesCountParams.push('WAREHOUSE', warehouses[0].name);
        }
      }
      
      if (search) {
        salesCountWhereClause += ' AND (s.customer_name LIKE ? OR s.customer_phone LIKE ? OR JSON_EXTRACT(s.customer_info, "$.name") LIKE ? OR JSON_EXTRACT(s.customer_info, "$.phone") LIKE ?)';
        const searchTerm = `%${search}%`;
        salesCountParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      [countResult] = await pool.execute(`
      SELECT COUNT(DISTINCT CONCAT(COALESCE(s.customer_name, JSON_EXTRACT(s.customer_info, "$.name")), '|', COALESCE(s.customer_phone, JSON_EXTRACT(s.customer_info, "$.phone")))) as total
      FROM sales s
        ${salesCountWhereClause}
      `, salesCountParams);
    }

    // Calculate current balance for each customer
    const customersWithBalance = customers.map(customer => {
      const totalPaid = parseFloat(customer.total_paid || 0);
      const totalAmount = parseFloat(customer.total_amount || 0);
      const currentBalance = totalAmount - totalPaid;

      // Debug logging for ali nawaz
      if (customer.customer_name === 'ali nawaz') {
        console.log('🔍 DEBUG ali nawaz calculation:', {
          customer_name: customer.customer_name,
          total_paid: customer.total_paid,
          total_amount: customer.total_amount,
          total_transactions: customer.total_transactions,
          parsed_total_paid: totalPaid,
          parsed_total_amount: totalAmount,
          calculated_balance: currentBalance
        });
      }

      return {
        ...customer,
        total_amount: totalAmount,
        total_paid: totalPaid,
        current_balance: currentBalance,
        has_outstanding_balance: currentBalance > 0
      };
    });

    // Filter by balance if requested
    let filteredCustomers = customersWithBalance;
    if (hasBalance === 'true') {
      // Show only customers with outstanding balance
      filteredCustomers = customersWithBalance.filter(c => c.has_outstanding_balance)
    } else if (hasBalance === 'false') {
      // Show only customers with no outstanding balance
      filteredCustomers = customersWithBalance.filter(c => !c.has_outstanding_balance)
    }
    // If hasBalance is undefined or 'all', show all customers

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

    // Get customer ledger data (same as getCustomerLedger but without pagination)
    const ledgerData = await getCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });

    // If detailed export is requested, fetch items for each transaction
    if (detailed === 'true') {
      console.log('Detailed export requested for customer:', customerId)
      const detailedLedgerData = await getDetailedCustomerLedgerData(customerId, req.user, { startDate, endDate, limit: 1000 });
      console.log('Detailed ledger data:', detailedLedgerData.length, 'transactions')
      console.log('First transaction items:', detailedLedgerData[0]?.items?.length || 0, 'items')
      
      if (format === 'pdf') {
        // Generate HTML content for detailed PDF
        const htmlContent = generateDetailedCustomerLedgerPDF(detailedLedgerData);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="detailed-customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
        res.send(htmlContent);
      } else {
        // Return detailed JSON data for other formats
        res.json({
          success: true,
          data: {
            customer: await getCustomerSummary(customerId, req.user),
            transactions: detailedLedgerData,
            pagination: {
              total: detailedLedgerData.length,
              limit: 1000,
              offset: 0
            }
          }
        });
      }
    } else {
      // Original export functionality
    if (format === 'pdf') {
      // Generate HTML content for PDF (frontend will handle PDF generation)
      const htmlContent = generateCustomerLedgerPDF(ledgerData);
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.html"`);
      res.send(htmlContent);
    } else {
      // Return JSON data for other formats
      res.json({
        success: true,
        data: ledgerData
      });
      }
    }
  } catch (error) {
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
        MAX(s.created_at) as last_transaction
      FROM sales s
      WHERE (s.customer_name = ? OR s.customer_phone = ? OR JSON_EXTRACT(s.customer_info, "$.name") = ? OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)
      GROUP BY name, phone
      LIMIT 1
    `, [customerId, customerId, customerId, customerId]);

    return sales[0] || { name: customerId, phone: '', total_transactions: 0 };
  } catch (error) {
    return { name: customerId, phone: '', total_transactions: 0 };
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
      s.payment_amount,
      s.credit_amount,
      s.total,
      s.customer_name,
      s.customer_phone,
      s.customer_info,
      s.notes,
      s.status,
      u.username as cashier_name,
      b.name as branch_name,
      w.name as warehouse_name
    FROM sales s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT ?
  `, [...params, limit]);

  return transactions;
};

// Helper function to get detailed customer ledger data with items
const getDetailedCustomerLedgerData = async (customerId, user, options = {}) => {
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
      s.payment_amount,
      s.credit_amount,
      s.total,
      s.customer_name,
      s.customer_phone,
      s.customer_info,
      s.notes,
      s.status,
      u.username as cashier_name,
      b.name as branch_name,
      w.name as warehouse_name
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

  // Calculate running balance for each transaction
  let runningBalance = 0;
  const transactionsWithBalance = detailedTransactions.map(transaction => {
    const total = parseFloat(transaction.total || 0);
    const paid = parseFloat(transaction.payment_amount || 0);
    const credit = parseFloat(transaction.credit_amount || 0);
    
    // Calculate old balance (balance before this transaction)
    const oldBalance = runningBalance;
    
    // Calculate invoice-specific balance (remaining amount for this specific invoice)
    const invoiceBalance = total - paid;
    
    // Update running balance: add credit amount, subtract paid amount
    runningBalance += credit;
    runningBalance -= paid;
    
    return {
      ...transaction,
      old_balance: oldBalance,
      running_balance: runningBalance,
      invoice_balance: invoiceBalance, 
      paid_amount: paid,
      subtotal: total - credit 
    };
  });

  return transactionsWithBalance;
};

// Helper function to generate PDF content
const generateCustomerLedgerPDF = (ledgerData) => {
  // Sort data in ascending order by date
  const sortedData = ledgerData.sort((a, b) => {
    const dateA = new Date(a.transaction_date || a.created_at);
    const dateB = new Date(b.transaction_date || b.created_at);
    return dateA - dateB;
  });

  // Calculate running balance with proper carry-forward logic (same as main ledger)
  let runningBalance = 0;
  const transactionsWithBalance = sortedData.map((transaction, index) => {
    const paid = parseFloat(transaction.paid_amount || 0);
    const credit = parseFloat(transaction.credit_amount || 0);
    const subtotal = parseFloat(transaction.subtotal || 0);
    const total = parseFloat(transaction.total || 0);
    
    // Store the old balance before processing this transaction
    const oldBalance = runningBalance;
    
    // Calculate the current transaction's total amount (including old balance)
    const currentTotalAmount = subtotal + oldBalance;
    
    // Calculate the new balance after this transaction
    if (transaction.payment_method === 'FULLY_CREDIT') {
      // For FULLY_CREDIT: No payment, so balance increases by the current total amount
      runningBalance = currentTotalAmount;
    } else {
      // For other payment methods: Subtract payment from current total amount
      runningBalance = currentTotalAmount - paid;
    }
    
    return {
      ...transaction,
      old_balance: oldBalance,
      total_amount: currentTotalAmount,
      balance: runningBalance,
      corrected_paid: transaction.payment_method === 'FULLY_CREDIT' ? 0 : paid
    };
  });

  // Calculate summary statistics
  const totalTransactions = transactionsWithBalance.length;
  const totalAmount = transactionsWithBalance.reduce((sum, transaction) => sum + parseFloat(transaction.subtotal || 0), 0);
  const totalPaid = transactionsWithBalance.reduce((sum, transaction) => sum + transaction.corrected_paid, 0);
  const outstandingBalance = totalAmount - totalPaid;
  
  const completedTransactions = transactionsWithBalance.filter(t => 
    t.payment_method === 'FULLY_CREDIT' || 
    (t.payment_method !== 'FULLY_CREDIT' && t.corrected_paid > 0 && t.balance <= 0)
  ).length;
  
  const pendingTransactions = transactionsWithBalance.filter(t => 
    t.payment_method === 'FULLY_CREDIT' && t.balance > 0
  ).length;
  
  const partialTransactions = transactionsWithBalance.filter(t => 
    t.payment_method !== 'FULLY_CREDIT' && t.corrected_paid > 0 && t.balance > 0
  ).length;

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
            grid-template-columns: 1fr 1fr;
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
          <p>Customer: ${ledgerData[0]?.customer_name || 'Unknown Customer'}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <span>Total Transactions:</span>
            <span>${totalTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Amount:</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Completed:</span>
            <span>${completedTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Pending:</span>
            <span>${pendingTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Partial:</span>
            <span>${partialTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Outstanding:</span>
            <span>${outstandingBalance.toFixed(2)}</span>
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
                <td class="amount">${parseFloat(transaction.subtotal || 0).toFixed(2)}</td>
                <td class="amount">${transaction.old_balance.toFixed(2)}</td>
                <td class="amount">${transaction.total_amount.toFixed(2)}</td>
                <td class="amount">${transaction.corrected_paid.toFixed(2)}</td>
                <td>${transaction.payment_method || 'N/A'}</td>
                <td class="status-${transaction.payment_method === 'FULLY_CREDIT' ? 'pending' : (transaction.balance <= 0 ? 'completed' : 'partial')}">
                  ${transaction.payment_method === 'FULLY_CREDIT' ? 'Credit' : (transaction.balance <= 0 ? 'Paid' : 'Partial')}
                </td>
                <td class="amount">${transaction.balance.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Totals</strong></td>
              <td class="amount"><strong>${totalAmount.toFixed(2)}</strong></td>
              <td class="amount"><strong>-</strong></td>
              <td class="amount"><strong>${totalAmount.toFixed(2)}</strong></td>
              <td class="amount"><strong>${totalPaid.toFixed(2)}</strong></td>
              <td colspan="2"><strong>-</strong></td>
              <td class="amount"><strong>${outstandingBalance.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
  
  return html;
};

// Helper function to generate detailed PDF content with items
const generateDetailedCustomerLedgerPDF = (detailedLedgerData) => {
  // Sort data in ascending order by date
  const sortedData = detailedLedgerData.sort((a, b) => {
    const dateA = new Date(a.transaction_date || a.created_at);
    const dateB = new Date(b.transaction_date || b.created_at);
    return dateA - dateB;
  });

  // Calculate running balance with proper carry-forward logic (same as main ledger)
  let runningBalance = 0;
  const transactionsWithBalance = sortedData.map((transaction, index) => {
    const paid = parseFloat(transaction.paid_amount || 0);
    const credit = parseFloat(transaction.credit_amount || 0);
    const subtotal = parseFloat(transaction.subtotal || 0);
    const total = parseFloat(transaction.total || 0);
    
    // Store the old balance before processing this transaction
    const oldBalance = runningBalance;
    
    // Calculate the current transaction's total amount (including old balance)
    const currentTotalAmount = subtotal + oldBalance;
    
    // Calculate the new balance after this transaction
    if (transaction.payment_method === 'FULLY_CREDIT') {
      // For FULLY_CREDIT: No payment, so balance increases by the current total amount
      runningBalance = currentTotalAmount;
    } else {
      // For other payment methods: Subtract payment from current total amount
      runningBalance = currentTotalAmount - paid;
    }
    
    return {
      ...transaction,
      old_balance: oldBalance,
      total_amount: currentTotalAmount,
      balance: runningBalance,
      corrected_paid: transaction.payment_method === 'FULLY_CREDIT' ? 0 : paid
    };
  });

  // Calculate summary statistics
  const totalTransactions = transactionsWithBalance.length;
  const totalAmount = transactionsWithBalance.reduce((sum, transaction) => sum + parseFloat(transaction.subtotal || 0), 0);
  const totalPaid = transactionsWithBalance.reduce((sum, transaction) => sum + transaction.corrected_paid, 0);
  const outstandingBalance = totalAmount - totalPaid;
  
  const completedTransactions = transactionsWithBalance.filter(t => 
    t.payment_method === 'FULLY_CREDIT' || 
    (t.payment_method !== 'FULLY_CREDIT' && t.corrected_paid > 0 && t.balance <= 0)
  ).length;
  
  const pendingTransactions = transactionsWithBalance.filter(t => 
    t.payment_method === 'FULLY_CREDIT' && t.balance > 0
  ).length;
  
  const partialTransactions = transactionsWithBalance.filter(t => 
    t.payment_method !== 'FULLY_CREDIT' && t.corrected_paid > 0 && t.balance > 0
  ).length;
  
  // Calculate total items count
  const totalItems = transactionsWithBalance.reduce((sum, transaction) => sum + (transaction.items?.length || 0), 0);

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
            grid-template-columns: 1fr 1fr 1fr;
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
          <p>Customer: ${sortedData[0]?.customer_name || 'N/A'}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <span>Total Transactions:</span>
            <span>${totalTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Amount:</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
          <div class="summary-item">
            <span>Completed:</span>
            <span class="status-completed">${completedTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Pending:</span>
            <span class="status-pending">${pendingTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Partial:</span>
            <span class="status-partial">${partialTransactions}</span>
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
                <td class="amount">${formatCurrency(transaction.subtotal || 0)}</td>
                <td class="amount">${formatCurrency(transaction.old_balance)}</td>
                <td class="amount"><strong>${formatCurrency(transaction.total_amount)}</strong></td>
                <td class="amount">${formatCurrency(transaction.corrected_paid)}</td>
                <td>${transaction.payment_method || 'N/A'}</td>
                <td>
                  <span class="status-chip status-${transaction.payment_method === 'FULLY_CREDIT' ? 'credit' : (transaction.balance <= 0 ? 'paid' : 'partial')}">
                    ${transaction.payment_method === 'FULLY_CREDIT' ? 'Credit' : (transaction.balance <= 0 ? 'Paid' : 'Partial')}
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

const getTransactionTypeClass = (scopeType) => {
  switch (scopeType) {
    case 'BRANCH': return 'walkin';
    case 'WAREHOUSE': return 'retailer';
    default: return 'walkin';
  }
};

const getPaymentStatusClass = (paymentStatus) => {
  switch (paymentStatus) {
    case 'COMPLETED': return 'paid';
    case 'PENDING': return 'credit';
    case 'PARTIAL': return 'partial';
    default: return 'credit';
  }
};

const getTransactionTypeDisplay = (transaction) => {
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


