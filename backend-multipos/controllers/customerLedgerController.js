
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
      offset = 0
    } = req.query;

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

    // Main query to get all customer transactions
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
        CASE 
          WHEN s.payment_status = 'COMPLETED' THEN s.payment_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.payment_amount
          WHEN s.payment_status = 'PENDING' THEN s.payment_amount
          ELSE 0
        END as paid_amount,
        CASE 
          WHEN s.payment_status = 'PENDING' THEN s.credit_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.credit_amount
          ELSE 0
        END as credit_amount,
        -- Calculate total bill amount for new Total Amount column
        -- For COMPLETED sales: total = payment_amount (since credit_amount = 0)
        -- For PARTIAL/PENDING sales: total = payment_amount + credit_amount
        CASE 
          WHEN s.payment_status = 'COMPLETED' THEN s.payment_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.payment_amount + s.credit_amount
          WHEN s.payment_status = 'PENDING' THEN s.payment_amount + s.credit_amount
          ELSE s.payment_amount + s.credit_amount
        END as total_amount
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const [countResult] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM sales s
      ${whereClause}
    `, params);

    // Calculate invoice-specific old balance and balance (not cumulative)
    const transactionsWithBalance = transactions.map((transaction, index) => {
      const paid = parseFloat(transaction.paid_amount || 0);
      const credit = parseFloat(transaction.credit_amount || 0);
      const subtotal = parseFloat(transaction.subtotal || 0);
      const total = parseFloat(transaction.total || 0);
      
      // Calculate invoice-specific values:
      // - Old Balance: Outstanding amount that was included in this invoice (Total Amount - Amount)
      // - Balance: Remaining outstanding for THIS invoice after payment (Total Amount - Payment)
      const oldBalance = total - subtotal; // Outstanding that was included
      const invoiceBalance = total - paid; // Remaining outstanding for this invoice
      
      // Debug logging for all transactions
      console.log(`🔍 Transaction ${index + 1}:`, {
        invoice: transaction.invoice_no,
        subtotal,
        total,
        paid,
        credit,
        oldBalance,
        invoiceBalance
      });
      
      // For Customer Ledger display:
      // - Amount: Current bill amount (s.subtotal) ✅
      // - Total Amount: Total bill amount (s.total) ✅
      // - Old Balance: Outstanding included in this invoice (total - subtotal) ✅
      // - Payment: What customer paid (payment_amount) ✅
      // - Balance: Remaining outstanding for THIS invoice (total - paid) ✅
      
      return {
        ...transaction,
        old_balance: oldBalance,
        running_balance: invoiceBalance, // Use invoice-specific balance instead of cumulative
        transaction_type_display: getTransactionTypeDisplay(transaction),
        payment_status_display: getPaymentStatusDisplay(transaction.payment_status)
      };
    });
    
    const finalTransactions = transactionsWithBalance;

    // Get customer summary
    const customerSummary = await getCustomerSummary(customerId, req.user);

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
        summary: {
          totalTransactions: countResult[0].total,
          totalPaid: finalTransactions.reduce((sum, t) => sum + parseFloat(t.paid_amount || 0), 0),
          totalCredit: finalTransactions.reduce((sum, t) => sum + parseFloat(t.credit_amount || 0), 0),
          currentBalance: finalTransactions.length > 0 ? parseFloat(finalTransactions[finalTransactions.length - 1].running_balance || 0) : 0 // Use last transaction's running balance
        }
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
          SUM(CASE 
            WHEN s.payment_status = 'COMPLETED' THEN s.payment_amount
            WHEN s.payment_status = 'PARTIAL' THEN s.payment_amount
            WHEN s.payment_status = 'PENDING' THEN s.payment_amount
            ELSE 0
          END) as total_paid,
          SUM(CASE 
            WHEN s.payment_status = 'PENDING' THEN s.credit_amount
            WHEN s.payment_status = 'PARTIAL' THEN s.credit_amount
            ELSE 0
          END) as total_credit,
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
      let salesWhereClause = 'WHERE 1=1';
      
      if (branchFilter) {
        // Get branch name from branch ID for fallback query
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [branchFilter]);
        if (branches.length > 0) {
          salesWhereClause += ' AND s.scope_type = ? AND s.scope_id = ?';
          salesParams.push('BRANCH', branches[0].name);
        }
      } else if (warehouseFilter) {
        // Get warehouse name from warehouse ID for fallback query
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [warehouseFilter]);
        if (warehouses.length > 0) {
          salesWhereClause += ' AND s.scope_type = ? AND s.scope_id = ?';
          salesParams.push('WAREHOUSE', warehouses[0].name);
        }
      }
      
      if (search) {
        salesWhereClause += ' AND (s.customer_name LIKE ? OR s.customer_phone LIKE ? OR JSON_EXTRACT(s.customer_info, "$.name") LIKE ? OR JSON_EXTRACT(s.customer_info, "$.phone") LIKE ?)';
        const searchTerm = `%${search}%`;
        salesParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      [customers] = await pool.execute(`
      SELECT 
        COALESCE(s.customer_name, JSON_EXTRACT(s.customer_info, "$.name")) as customer_name,
        COALESCE(s.customer_phone, JSON_EXTRACT(s.customer_info, "$.phone")) as customer_phone,
        COUNT(DISTINCT s.id) as total_transactions,
        SUM(CASE 
          WHEN s.payment_status = 'COMPLETED' THEN s.payment_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.payment_amount
            WHEN s.payment_status = 'PENDING' THEN s.payment_amount
          ELSE 0
        END) as total_paid,
        SUM(CASE 
            WHEN s.payment_status = 'PENDING' THEN s.credit_amount
          WHEN s.payment_status = 'PARTIAL' THEN s.credit_amount
          ELSE 0
        END) as total_credit,
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
      const totalCredit = parseFloat(customer.total_credit || 0);
      const currentBalance = totalCredit - totalPaid;

      // Debug logging for ali nawaz
      if (customer.customer_name === 'ali nawaz') {
        console.log('🔍 DEBUG ali nawaz calculation:', {
          customer_name: customer.customer_name,
          total_paid: customer.total_paid,
          total_credit: customer.total_credit,
          total_transactions: customer.total_transactions,
          parsed_total_paid: totalPaid,
          parsed_total_credit: totalCredit,
          calculated_balance: currentBalance
        });
      }

      return {
        ...customer,
        current_balance: currentBalance,
        has_outstanding_balance: currentBalance > 0
      };
    });

    // Filter by balance if requested
    const filteredCustomers = hasBalance === 'true' 
      ? customersWithBalance.filter(c => c.has_outstanding_balance)
      : customersWithBalance;

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
          data: detailedLedgerData
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
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
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
    LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
    LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
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

  return detailedTransactions;
};

// Helper function to generate PDF content
const generateCustomerLedgerPDF = (ledgerData) => {
  // Calculate summary statistics
  const totalTransactions = ledgerData.length;
  const totalAmount = ledgerData.reduce((sum, transaction) => sum + parseFloat(transaction.total || 0), 0);
  const completedTransactions = ledgerData.filter(t => t.payment_status === 'COMPLETED').length;
  const pendingTransactions = ledgerData.filter(t => t.payment_status === 'PENDING').length;
  const partialTransactions = ledgerData.filter(t => t.payment_status === 'PARTIAL').length;

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
            <span>${ledgerData
              .filter(t => t.payment_status === 'PENDING' || t.payment_status === 'PARTIAL')
              .reduce((sum, t) => sum + parseFloat(t.credit_amount || t.total || 0), 0)
              .toFixed(2)}</span>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice #</th>
              <th>Type</th>
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Credit Amount</th>
              <th>Payment Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerData.map(transaction => `
              <tr>
                <td>${new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}</td>
                <td>${transaction.invoice_no || 'N/A'}</td>
                <td>${getTransactionTypeDisplay(transaction)}</td>
                <td class="amount">${parseFloat(transaction.total || 0).toFixed(2)}</td>
                <td class="amount">${parseFloat(transaction.payment_amount || 0).toFixed(2)}</td>
                <td class="amount">${parseFloat(transaction.credit_amount || 0).toFixed(2)}</td>
                <td>${transaction.payment_method || 'N/A'}</td>
                <td class="status-${transaction.payment_status?.toLowerCase() || 'unknown'}">
                  ${getPaymentStatusDisplay(transaction.payment_status)}
                </td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>Totals</strong></td>
              <td class="amount"><strong>${totalAmount.toFixed(2)}</strong></td>
              <td class="amount"><strong>${ledgerData.reduce((sum, t) => sum + parseFloat(t.payment_amount || 0), 0).toFixed(2)}</strong></td>
              <td class="amount"><strong>${ledgerData.reduce((sum, t) => sum + parseFloat(t.credit_amount || 0), 0).toFixed(2)}</strong></td>
              <td colspan="2"></td>
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
  // Calculate summary statistics
  const totalTransactions = detailedLedgerData.length;
  const totalAmount = detailedLedgerData.reduce((sum, transaction) => sum + parseFloat(transaction.total || 0), 0);
  const completedTransactions = detailedLedgerData.filter(t => t.payment_status === 'COMPLETED').length;
  const pendingTransactions = detailedLedgerData.filter(t => t.payment_status === 'PENDING').length;
  const partialTransactions = detailedLedgerData.filter(t => t.payment_status === 'PARTIAL').length;
  
  // Calculate total items count
  const totalItems = detailedLedgerData.reduce((sum, transaction) => sum + (transaction.items?.length || 0), 0);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Detailed Customer Ledger Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 11px;
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
          .transaction-section {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            border-radius: 5px;
            overflow: hidden;
          }
          .transaction-header {
            background: #f8f9fa;
            padding: 10px;
            border-bottom: 1px solid #ddd;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 10px;
            font-weight: bold;
          }
          .transaction-items {
            padding: 0;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold; 
          }
          .items-table th {
            background-color: #e9ecef;
            font-size: 10px;
          }
          .items-table td {
            font-size: 10px;
            padding: 6px;
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
          .total-row { 
            background-color: #f8f9fa; 
            font-weight: bold; 
          }
          .transaction-total {
            background-color: #e9ecef;
            font-weight: bold;
            text-align: right;
          }
          .no-items {
            padding: 20px;
            text-align: center;
            color: #666;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Detailed Customer Ledger Report</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <p>Customer: ${detailedLedgerData[0]?.customer_name || 'Unknown Customer'}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <span>Total Transactions:</span>
            <span>${totalTransactions}</span>
          </div>
          <div class="summary-item">
            <span>Total Items:</span>
            <span>${totalItems}</span>
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
            <span>${detailedLedgerData
              .filter(t => t.payment_status === 'PENDING' || t.payment_status === 'PARTIAL')
              .reduce((sum, t) => sum + parseFloat(t.credit_amount || t.total || 0), 0)
              .toFixed(2)}</span>
          </div>
        </div>
        
        ${detailedLedgerData.map(transaction => `
          <div class="transaction-section">
            <div class="transaction-header">
              <div><strong>Invoice:</strong> ${transaction.invoice_no || 'N/A'}</div>
              <div><strong>Date:</strong> ${new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}</div>
              <div><strong>Total:</strong> ${parseFloat(transaction.total || 0).toFixed(2)}</div>
              <div><strong>Status:</strong> <span class="status-${transaction.payment_status?.toLowerCase() || 'unknown'}">${getPaymentStatusDisplay(transaction.payment_status)}</span></div>
            </div>
            <div class="transaction-items">
              ${transaction.items && transaction.items.length > 0 ? `
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Discount</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transaction.items.map(item => `
                      <tr>
                        <td>${item.item_name || item.name || 'N/A'}</td>
                        <td>${item.sku || 'N/A'}</td>
                        <td class="amount">${item.quantity || 0}</td>
                        <td class="amount">${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                        <td class="amount">${parseFloat(item.discount || 0).toFixed(2)}</td>
                        <td class="amount">${parseFloat(item.total || 0).toFixed(2)}</td>
                      </tr>
                    `).join('')}
                    <tr class="transaction-total">
                      <td colspan="5"><strong>Transaction Total:</strong></td>
                      <td class="amount"><strong>${parseFloat(transaction.total || 0).toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              ` : `
                <div class="no-items">No items found for this transaction</div>
              `}
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `;
  
  return html;
};

// Helper functions for display
const getTransactionTypeDisplay = (transaction) => {
  if (transaction.scope_type === 'WAREHOUSE') {
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


