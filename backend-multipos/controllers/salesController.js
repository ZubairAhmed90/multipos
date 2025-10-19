const { validationResult } = require('express-validator');
const Sale = require('../models/Sale');
const SalesReturn = require('../models/SalesReturn');
const HeldBill = require('../models/HeldBill');
const InventoryItem = require('../models/InventoryItem');
const BranchLedger = require('../models/BranchLedger');
const FinancialVoucher = require('../models/FinancialVoucher');
const { pool } = require('../config/database');
const { createSaleTransaction, createReturnTransaction, createAdjustmentTransaction } = require('../middleware/stockTracking');
const InvoiceNumberService = require('../services/invoiceNumberService');
const LedgerService = require('../services/ledgerService');

// @desc    Create new sale
// @route   POST /api/sales
// @access  Private (Admin, Cashier)
const createSale = async (req, res, next) => {
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { items, scopeType, scopeId, paymentMethod, customerInfo, notes, subtotal, tax, discount, total, paymentStatus, status, paymentAmount, creditAmount, creditStatus } = req.body;

    // Debug: Log the received payment method
    console.log('[SalesController] Received paymentMethod:', paymentMethod, 'Type:', typeof paymentMethod);
    console.log('[SalesController] Received creditAmount:', creditAmount, 'Type:', typeof creditAmount);
    console.log('[SalesController] Received paymentAmount:', paymentAmount, 'Type:', typeof paymentAmount);
    console.log('[SalesController] Full request body:', JSON.stringify(req.body, null, 2));


    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Validate inventory items and enrich item data (skip manual items)
    const enrichedItems = [];
    for (const item of items) {
      if (!item.inventoryItemId) {
        // Handle manual items (no inventory validation needed)
        console.log(`[SalesController] Processing manual item: ${item.name}`);
        const enrichedItem = {
          ...item,
          sku: item.sku || `MANUAL-${Date.now()}`,
          name: item.name || item.itemName,
          unitPrice: item.unitPrice || 0
        };
        enrichedItems.push(enrichedItem);
        continue;
      }
      
      // Validate inventory items
      const inventoryItem = await InventoryItem.findById(item.inventoryItemId);
      if (!inventoryItem) {
        return res.status(400).json({
          success: false,
          message: `Inventory item with ID ${item.inventoryItemId} not found`
        });
      }
      console.log(`[SalesController] Validated item ${item.inventoryItemId}: ${inventoryItem.name}`);
      
      // Enrich item with inventory data
      const enrichedItem = {
        ...item,
        sku: item.sku || inventoryItem.sku || `SKU-${item.inventoryItemId}`,
        name: item.name || inventoryItem.name,
        unitPrice: item.unitPrice || inventoryItem.sellingPrice || 0
      };
      
      // Ensure SKU is never null
      if (!enrichedItem.sku) {
        enrichedItem.sku = `SKU-${item.inventoryItemId}`;
      }
      
      console.log(`[SalesController] Enriched item ${item.inventoryItemId}:`, {
        originalSku: item.sku,
        inventorySku: inventoryItem.sku,
        finalSku: enrichedItem.sku,
        name: enrichedItem.name,
        unitPrice: enrichedItem.unitPrice
      });
      
      enrichedItems.push(enrichedItem);
    }

    // Use provided totals or calculate them from items
    let finalSubtotal = parseFloat(subtotal) || 0;
    let finalTax = parseFloat(tax) || 0;
    let finalDiscount = parseFloat(discount) || 0;
    let finalTotal = parseFloat(total) || 0;

    // If totals are not provided, calculate them from enriched items
    if (subtotal === undefined || subtotal === null || subtotal === '' || tax === undefined || tax === null || tax === '' || total === undefined || total === null || total === '') {
      let calculatedSubtotal = 0;
      let calculatedDiscount = 0;

      // Calculate totals from enriched items
      for (const item of enrichedItems) {
        const inventoryItem = await InventoryItem.findById(item.inventoryItemId);

        // Check if item belongs to the correct scope
        if (inventoryItem.scopeType !== scopeType || inventoryItem.scopeId.toString() !== scopeId.toString()) {
          return res.status(400).json({
            success: false,
            message: `Item ${inventoryItem.name} does not belong to the specified scope`
          });
        }

        // Check stock availability
        if (inventoryItem.currentStock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.currentStock}`
          });
        }

        const itemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
        calculatedSubtotal += itemTotal;
        calculatedDiscount += item.discount || 0;
      }

      // Calculate tax (assuming 10% tax rate)
      const taxRate = 0.10;
      const calculatedTax = calculatedSubtotal * taxRate;
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      finalSubtotal = calculatedSubtotal;
      finalTax = calculatedTax;
      finalDiscount = calculatedDiscount;
      finalTotal = calculatedTotal;
    }

    // Generate invoice number using branch/warehouse code
    let invoiceNo;
    try {
      invoiceNo = await InvoiceNumberService.generateInvoiceNumber(scopeType, scopeId);
      console.log('[SalesController] Generated invoice number:', invoiceNo);
    } catch (invoiceError) {
      console.error('[SalesController] Error generating invoice number:', invoiceError);
      // Fallback to old method if new method fails
      invoiceNo = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      console.log('[SalesController] Using fallback invoice number:', invoiceNo);
    }

    // Extract customer name and phone from customerInfo
    const customerName = customerInfo?.name || '';
    const customerPhone = customerInfo?.phone || '';
    
    // Get branch/warehouse name for scope_id
    let scopeName = '';
    if (scopeType === 'BRANCH' && scopeId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [scopeId]);
      scopeName = branches[0]?.name || scopeId;
    } else if (scopeType === 'WAREHOUSE' && scopeId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [scopeId]);
      scopeName = warehouses[0]?.name || scopeId;
    } else {
      scopeName = scopeId || '';
    }
    
    // Calculate payment amounts - Enhanced partial payment logic
    let finalPaymentAmount, finalCreditAmount;
    
    if (paymentMethod === 'FULLY_CREDIT') {
      // For FULLY_CREDIT, payment amount is 0, credit amount is total
      finalPaymentAmount = 0;
      finalCreditAmount = finalTotal;
    } else {
      // For other payment methods, handle partial payments properly
      const providedPaymentAmount = paymentAmount !== undefined ? parseFloat(paymentAmount) : null;
      const providedCreditAmount = creditAmount !== undefined ? parseFloat(creditAmount) : null;
      
      if (providedPaymentAmount !== null && providedCreditAmount !== null) {
        // Both amounts provided - validate they add up to total
        const sum = providedPaymentAmount + providedCreditAmount;
        if (Math.abs(sum - finalTotal) > 0.01) { // Allow small rounding differences
          console.warn('[SalesController] Payment amounts don\'t add up to total. Adjusting credit amount.');
          finalPaymentAmount = providedPaymentAmount;
          finalCreditAmount = Math.max(0, finalTotal - providedPaymentAmount);
        } else {
          finalPaymentAmount = providedPaymentAmount;
          finalCreditAmount = providedCreditAmount;
        }
      } else if (providedPaymentAmount !== null) {
        // Only payment amount provided
        finalPaymentAmount = providedPaymentAmount;
        finalCreditAmount = Math.max(0, finalTotal - providedPaymentAmount);
      } else if (providedCreditAmount !== null) {
        // Only credit amount provided
        finalCreditAmount = providedCreditAmount;
        finalPaymentAmount = Math.max(0, finalTotal - providedCreditAmount);
      } else {
        // No amounts provided - assume full payment
        finalPaymentAmount = finalTotal;
        finalCreditAmount = 0;
      }
    }
    
    // Determine payment and credit status
    const finalCreditStatus = creditStatus || (finalCreditAmount > 0 ? 'PENDING' : 'NONE');
    
    // Enhanced payment status logic
    let finalPaymentStatus;
    if (paymentStatus) {
      // Use provided status if valid
      finalPaymentStatus = paymentStatus;
    } else if (paymentMethod === 'FULLY_CREDIT') {
      finalPaymentStatus = 'PENDING';  // ✅ Fixed: Fully credit sales should be PENDING
    } else if (finalCreditAmount > 0) {
      finalPaymentStatus = 'PENDING';  // ✅ Fixed: Partial payments should be PENDING
    } else {
      finalPaymentStatus = 'COMPLETED';
    }
    
    // Validate payment amounts
    if (finalPaymentAmount < 0 || finalCreditAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amounts cannot be negative'
      });
    }
    
    if (Math.abs((finalPaymentAmount + finalCreditAmount) - finalTotal) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount and credit amount must equal the total amount'
      });
    }
    
    // Validate partial payment logic
    if (finalPaymentStatus === 'PARTIAL' && finalCreditAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Partial payment requires a credit amount greater than 0'
      });
    }
    
    if (finalPaymentStatus === 'COMPLETED' && finalCreditAmount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Completed payment cannot have a credit amount'
      });
    }
    
    console.log('[SalesController] Calculated amounts:', {
      paymentMethod,
      finalTotal,
      finalPaymentAmount,
      finalCreditAmount,
      finalCreditStatus,
      finalPaymentStatus,
      validation: 'passed'
    });
    
    
    // Create customer record if customer name/phone is provided and doesn't exist
    let customerId = null;
    if (customerName || customerPhone) {
      try {
        console.log('🔍 Creating customer record for:', { customerName, customerPhone, scopeType, scopeId, scopeIdType: typeof scopeId });
        
        // Check if customer already exists
        const [existingCustomers] = await pool.execute(
          'SELECT id FROM customers WHERE name = ? OR phone = ?',
          [customerName, customerPhone]
        );
        
        if (existingCustomers.length === 0) {
          // Resolve scopeId to actual ID if it's a string (branch/warehouse name)
          let resolvedBranchId = null;
          let resolvedWarehouseId = null;
          
          if (scopeType === 'BRANCH') {
            if (typeof scopeId === 'number') {
              resolvedBranchId = scopeId;
            } else if (typeof scopeId === 'string') {
              // Look up branch ID by name
              try {
                const [branches] = await pool.execute('SELECT id FROM branches WHERE name = ?', [scopeId]);
                if (branches.length > 0) {
                  resolvedBranchId = branches[0].id;
                  console.log('🔍 Resolved branch name to ID:', scopeId, '->', resolvedBranchId);
                } else {
                  console.log('⚠️ Branch not found by name:', scopeId, 'using default branch ID 1');
                  resolvedBranchId = 1; // Default fallback
                }
              } catch (error) {
                console.error('❌ Error looking up branch:', error);
                resolvedBranchId = 1; // Default fallback
              }
            }
          } else if (scopeType === 'WAREHOUSE') {
            if (typeof scopeId === 'number') {
              resolvedWarehouseId = scopeId;
            } else if (typeof scopeId === 'string') {
              // Look up warehouse ID by name
              try {
                const [warehouses] = await pool.execute('SELECT id FROM warehouses WHERE name = ?', [scopeId]);
                if (warehouses.length > 0) {
                  resolvedWarehouseId = warehouses[0].id;
                  console.log('🔍 Resolved warehouse name to ID:', scopeId, '->', resolvedWarehouseId);
                } else {
                  console.log('⚠️ Warehouse not found by name:', scopeId, 'using default warehouse ID 1');
                  resolvedWarehouseId = 1; // Default fallback
                }
              } catch (error) {
                console.error('❌ Error looking up warehouse:', error);
                resolvedWarehouseId = 1; // Default fallback
              }
            }
          }
          
          // Create new customer record with proper branch/warehouse scope
          const customerData = {
            name: customerName || 'Walk-in Customer',
            email: customerInfo?.email || '',
            phone: customerPhone || '',
            address: customerInfo?.address || '',
            city: '',
            state: '',
            zip_code: '',
            customer_type: 'INDIVIDUAL',
            credit_limit: 0.00,
            current_balance: finalCreditAmount || 0.00,
            payment_terms: 'CASH',
            branch_id: resolvedBranchId,
            warehouse_id: resolvedWarehouseId,
            status: 'ACTIVE',
            notes: `Auto-created from POS sale`,
            created_at: new Date(),
            updated_at: new Date()
          };
          
          console.log('📝 Customer data to insert:', customerData);
          
          const [customerResult] = await pool.execute(`
            INSERT INTO customers (
              name, email, phone, address, city, state, zip_code, 
              customer_type, credit_limit, current_balance, payment_terms,
              branch_id, warehouse_id, status, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            customerData.name,
            customerData.email,
            customerData.phone,
            customerData.address,
            customerData.city,
            customerData.state,
            customerData.zip_code,
            customerData.customer_type,
            customerData.credit_limit,
            customerData.current_balance,
            customerData.payment_terms,
            customerData.branch_id,
            customerData.warehouse_id,
            customerData.status,
            customerData.notes,
            customerData.created_at,
            customerData.updated_at
          ]);
          
          customerId = customerResult.insertId;
          console.log('✅ Customer created successfully with ID:', customerId);
        } else {
          customerId = existingCustomers[0].id;
          console.log('ℹ️ Customer already exists with ID:', customerId);
          
          // Update existing customer's balance if there's credit
          if (finalCreditAmount > 0) {
            await pool.execute(
              'UPDATE customers SET current_balance = current_balance + ? WHERE id = ?',
              [finalCreditAmount, customerId]
            );
            console.log('💰 Updated customer balance by:', finalCreditAmount);
          }
        }
      } catch (customerError) {
        console.error('❌ Error creating/updating customer:', customerError);
        // Don't fail the sale if customer creation fails
      }
    }

    // Create sale
    const saleData = {
      invoiceNo: invoiceNo || null,
      scopeType: scopeType || null,
      scopeId: scopeId || null, // Store branch/warehouse ID instead of name
      userId: req.user.id || null,
      shiftId: req.body.shiftId || req.currentShift?.id || null,
      subtotal: finalSubtotal || 0,
      tax: finalTax || 0,
      discount: finalDiscount || 0,
      total: finalTotal || 0,
      paymentMethod: paymentMethod || null,
      paymentStatus: finalPaymentStatus || null,
      customerInfo: customerInfo ? JSON.stringify(customerInfo) : null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerId: customerId, // Add customer ID reference
      paymentAmount: finalPaymentAmount || 0,
      creditAmount: finalCreditAmount || 0,
      creditStatus: finalCreditStatus || 'NONE',
      creditDueDate: finalCreditAmount > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null, // 30 days from now
      notes: notes || null,
      status: status || 'COMPLETED',
      items: enrichedItems.map(item => ({
        inventoryItemId: item.inventoryItemId || null,
        sku: item.sku || null,
        name: item.name || null,
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        originalPrice: item.originalPrice || item.unitPrice || 0,
        discount: item.discount || 0,
        discountType: item.discountType || 'amount',
        total: (item.unitPrice * item.quantity) - (item.discount || 0)
      }))
    };


    // Validate required fields before creating sale
    if (!req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!scopeType) {
      return res.status(400).json({
        success: false,
        message: 'Scope type is required'
      });
    }

    if (!scopeName) {
      return res.status(400).json({
        success: false,
        message: 'Scope ID/Name is required'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    // Final validation - ensure no null SKUs
    for (const item of saleData.items) {
      if (!item.sku) {
        console.error('[SalesController] SKU is null for item:', item);
        return res.status(400).json({
          success: false,
          message: `SKU is required for item ${item.inventoryItemId}`,
          item: item
        });
      }
    }

    console.log('[SalesController] Creating sale with data:', saleData);
    console.log('[SalesController] Sale data items:', saleData.items);
    console.log('[SalesController] Payment method being stored:', saleData.paymentMethod);
    console.log('[SalesController] Credit amount being stored:', saleData.creditAmount);
    console.log('[SalesController] Payment status being stored:', saleData.paymentStatus);
    
    let sale;
    try {
      sale = await Sale.create(saleData);
      console.log('[SalesController] Sale created successfully:', sale.id);
    } catch (saleError) {
      console.error('[SalesController] Error in Sale.create:', saleError);
      throw saleError;
    }

    // Update inventory stock and create transaction records
    for (const item of enrichedItems) {
      try {
        // Skip manual items (they don't have inventoryItemId)
        if (!item.inventoryItemId) {
          console.log(`[SalesController] Skipping manual item in sale creation: ${item.name}`);
          continue;
        }
        
        console.log(`[SalesController] Updating stock for item ${item.inventoryItemId}, quantity change: ${-item.quantity}`);
        
        // Update stock first
      await InventoryItem.updateStock(item.inventoryItemId, -item.quantity);
        
        // Create transaction record for stock report
        console.log(`[SalesController] Creating stock transaction for item ${item.inventoryItemId}:`, {
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          userId: req.user.id,
          userName: req.user.name || req.user.username,
          userRole: req.user.role,
          saleId: sale.id
        });
        
        await createSaleTransaction(
          item.inventoryItemId,
          item.quantity,
          item.unitPrice,
          req.user.id,
          req.user.name || req.user.username, // Use username as fallback
          req.user.role,
          sale.id
        );
        
      } catch (error) {
        console.error(`[SalesController] Error updating stock for item ${item.inventoryItemId}:`, error);
        throw new Error(`Failed to update stock for item ${item.inventoryItemId}: ${error.message}`);
      }
    }

    // Record sale in ledger with proper debit/credit entries
    try {
      console.log('[SalesController] Starting ledger recording...');
      const ledgerResult = await LedgerService.recordSaleTransaction({
        saleId: sale.id,
        invoiceNo: invoiceNo,
        scopeType: scopeType,
        scopeId: scopeId,
        totalAmount: finalTotal,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        paymentMethod: paymentMethod,
        customerInfo: customerInfo,
        userId: req.user.id,
        items: enrichedItems
      });
      console.log('[SalesController] Sale recorded in ledger successfully:', ledgerResult);
    } catch (ledgerError) {
      console.error('[SalesController] CRITICAL ERROR recording sale in ledger:', ledgerError);
      console.error('[SalesController] Ledger error stack:', ledgerError.stack);
      console.error('[SalesController] Ledger error details:', {
        message: ledgerError.message,
        code: ledgerError.code,
        errno: ledgerError.errno,
        sqlState: ledgerError.sqlState,
        sqlMessage: ledgerError.sqlMessage
      });
      // Don't fail the sale if ledger recording fails, but log it properly
    }

    // Create financial voucher for the sale
    try {
      const voucherNo = `VCH-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const voucherData = {
        voucherNo: voucherNo,
        type: 'INCOME',
        category: 'SALES',
        paymentMethod: paymentMethod.toUpperCase(),
        amount: finalTotal,
        description: `Sale from POS Terminal - ${scopeType}: ${scopeName}`,
        reference: invoiceNo,
        scopeType: scopeType,
        scopeId: scopeId,
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        status: 'APPROVED' // Auto-approve sales from POS
      };

      await FinancialVoucher.create(voucherData);
    } catch (voucherError) {
      console.error('Error creating financial voucher for sale:', voucherError);
      // Don't fail the sale if voucher creation fails
    }

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: {
        ...sale,
        invoice_no: sale.invoiceNo  // Add snake_case version for frontend compatibility
      }
    });
  } catch (error) {
    console.error('[SalesController] Error creating sale:', error);
    console.error('[SalesController] Error stack:', error.stack);
    console.error('[SalesController] Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    res.status(500).json({
      success: false,
      message: 'Error creating sale',
      error: error.message,
      errorCode: error.code,
      sqlMessage: error.sqlMessage,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private (Admin, Cashier)
const getSales = async (req, res, next) => {
  try {
    const { scopeType, scopeId, startDate, endDate, paymentMethod, status, retailerId, customerPhone, customerName, creditStatus, paymentStatus } = req.query;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can always view sales (read-only access)
      // Get branch name if not already available
      let userBranchName = req.user.branchName;
      if (!userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (userBranchName) {
        // Handle both string and number comparisons for scope_id
        whereConditions.push('scope_type = ? AND (scope_id = ? OR scope_id = ?)');
        params.push('BRANCH', userBranchName, String(userBranchName));
      } else {
        whereConditions.push('scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // For testing: Show all warehouse sales, not just current warehouse
      whereConditions.push('scope_type = ?');
      params.push('WAREHOUSE');
      // whereConditions.push('scope_type = ? AND scope_id = ?');
      // params.push('WAREHOUSE', req.user.warehouseName);
    } else if (req.user.role === 'ADMIN') {
      // Admin can filter by scopeType and/or scopeId
      if (scopeType && scopeType !== 'all') {
        whereConditions.push('scope_type = ?');
        params.push(scopeType);
      }
      if (scopeId && scopeId !== 'all') {
        whereConditions.push('scope_id = ?');
        params.push(scopeId);
      }
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    if (paymentMethod) {
      whereConditions.push('payment_method = ?');
      params.push(paymentMethod);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (retailerId && retailerId !== 'all') {
      whereConditions.push('JSON_EXTRACT(customer_info, "$.id") = ?');
      params.push(retailerId);
    }

    if (customerPhone) {
      whereConditions.push('customer_phone = ?');
      params.push(customerPhone);
    }

    if (customerName) {
      whereConditions.push('customer_name LIKE ?');
      params.push(`%${customerName}%`);
    }

    if (creditStatus) {
      whereConditions.push('credit_status = ?');
      params.push(creditStatus);
    }

    if (paymentStatus) {
      whereConditions.push('payment_status = ?');
      params.push(paymentStatus);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';


    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        u.email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY s.created_at DESC
    `, params);

    // Debug: Log payment method values
    console.log('[SalesController] Debug - Payment methods in database:', 
      sales.map(s => ({ id: s.id, payment_method: s.payment_method, credit_amount: s.credit_amount, payment_status: s.payment_status }))
    );


    

    // Get sales items for each sale
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
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
      `, [sale.id]);

      const saleData = {
        ...sale,
        customerInfo: sale.customer_info ? JSON.parse(sale.customer_info) : null,
        items: items.map(item => ({
          id: item.id,
          inventoryItemId: item.inventory_item_id,
          itemName: item.item_name,
          name: item.item_name, // For compatibility
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price) || 0,
          originalPrice: parseFloat(item.original_price) || 0,
          discount: parseFloat(item.discount) || 0,
          discountType: item.discount_type || 'amount',
          total: parseFloat(item.total) || 0,
          category: item.category
        }))
      };
      
      return saleData;
    }));

    res.json({
      success: true,
      count: salesWithItems.length,
      data: salesWithItems
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales',
      error: error.message
    });
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private (Admin, Cashier)
const getSale = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Check access permissions
    if (req.user.role !== 'ADMIN') {
      // For cashiers, get branch name if not already available
      let userBranchName = req.user.branchName;
      if (req.user.role === 'CASHIER' && !userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (req.user.role === 'CASHIER' && 
          (sale.scopeType !== 'BRANCH' || sale.scopeId !== userBranchName)) {
        console.log('[SalesController] Permission check failed for cashier:', {
          userRole: req.user.role,
          userBranchId: req.user.branchId,
          userBranchName: userBranchName,
          saleScopeType: sale.scopeType,
          saleScopeId: sale.scopeId,
          comparison: sale.scopeId !== userBranchName
        });
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // For warehouse keepers, get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      if (req.user.role === 'WAREHOUSE_KEEPER' && !userWarehouseName && req.user.warehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
        userWarehouseName = warehouses[0]?.name || null;
      }
      
      if (req.user.role === 'WAREHOUSE_KEEPER' && 
          (sale.scopeType !== 'WAREHOUSE' || sale.scopeId !== userWarehouseName)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get sale items
    const saleItems = await Sale.getSaleItems(id);

    // Debug: Log the sale data being returned
    console.log('[SalesController] getSale - Sale data being returned:', {
      id: sale.id,
      payment_method: sale.paymentMethod,
      payment_status: sale.paymentStatus,
      credit_amount: sale.creditAmount,
      credit_status: sale.creditStatus
    });

    res.json({
      success: true,
      data: {
        ...sale,
        items: saleItems
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sale',
      error: error.message
    });
  }
};

// @desc    Update sale with inventory changes
// @route   PUT /api/sales/:id
// @access  Private (Admin, Cashier)
const updateSale = async (req, res, next) => {
  // Set a timeout for the entire operation
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
  });
  
  const updatePromise = async () => {
    const connection = await pool.getConnection();
    
    try {
      console.log('[SalesController] Starting updateSale for sale ID:', req.params.id);
      console.log('[SalesController] User:', req.user.role, req.user.branchName || req.user.warehouseName);
      
      await connection.beginTransaction();
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    const { items, inventoryChanges } = updateData;

    // Get sale with items
    const [saleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
    if (saleRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    const sale = saleRows[0];

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      // For cashiers, get branch name if not already available
      let userBranchName = req.user.branchName;
      if (req.user.role === 'CASHIER' && !userBranchName && req.user.branchId) {
        const [branches] = await connection.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (req.user.role === 'CASHIER' && 
          (sale.scope_type !== 'BRANCH' || sale.scope_id !== userBranchName)) {
        console.log('[SalesController] Update permission check failed for cashier:', {
          userRole: req.user.role,
          userBranchId: req.user.branchId,
          userBranchName: userBranchName,
          saleScopeType: sale.scope_type,
          saleScopeId: sale.scope_id,
          comparison: sale.scope_id !== userBranchName
        });
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Check if cashier has permission to edit sales
      if (req.user.role === 'CASHIER') {
        const Branch = require('../models/Branch');
        const branchSettings = await Branch.getSettings(sale.scope_id);
        if (!branchSettings?.allowCashierSalesEdit) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to edit sales. Contact your administrator.'
          });
        }
      }
    }

    // Get current sale items
    const [currentItems] = await connection.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [id]
    );

    // Handle inventory changes if provided
    if (inventoryChanges) {
      console.log('[SalesController] Processing inventory changes:', inventoryChanges);
      
      // Process added items (reduce stock)
      for (const change of inventoryChanges.added || []) {
        try {
          // Skip manual items (they don't have inventoryItemId)
          if (!change.inventoryItemId) {
            console.log(`[SalesController] Skipping manual item: ${change.itemName}`);
            continue;
          }
          
          console.log(`[SalesController] Adding item ${change.inventoryItemId}, reducing stock by ${Math.abs(change.quantityChange)}`);
          
          // Update inventory stock
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock - ? WHERE id = ?',
            [Math.abs(change.quantityChange), change.inventoryItemId]
          );
          
          // Create stock transaction record
          await createSaleTransaction(
            change.inventoryItemId,
            Math.abs(change.quantityChange),
            0, // Price will be updated when sale items are saved
            req.user.id,
            req.user.name || req.user.username,
            req.user.role,
            id
          );
          
        } catch (error) {
          console.error(`[SalesController] Error processing added item ${change.inventoryItemId}:`, error);
          throw error;
        }
      }
      
      // Process removed items (restore stock)
      for (const change of inventoryChanges.removed || []) {
        try {
          // Skip manual items (they don't have inventoryItemId)
          if (!change.inventoryItemId) {
            console.log(`[SalesController] Skipping manual item removal: ${change.itemName}`);
            continue;
          }
          
          console.log(`[SalesController] Removing item ${change.inventoryItemId}, restoring stock by ${change.quantityChange}`);
          
          // Update inventory stock
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
            [change.quantityChange, change.inventoryItemId]
          );
          
          // Create return transaction record
          await createReturnTransaction(
            change.inventoryItemId,
            change.quantityChange,
            0, // Price will be updated when sale items are saved
            req.user.id,
            req.user.name || req.user.username,
            req.user.role,
            null // No return ID for sale modifications
          );
          
        } catch (error) {
          console.error(`[SalesController] Error processing removed item ${change.inventoryItemId}:`, error);
          throw error;
        }
      }
      
      // Process modified items (adjust stock based on quantity difference)
      for (const change of inventoryChanges.modified || []) {
        try {
          // Skip manual items (they don't have inventoryItemId)
          if (!change.inventoryItemId) {
            console.log(`[SalesController] Skipping manual item modification: ${change.itemName}`);
            continue;
          }
          
          console.log(`[SalesController] Modifying item ${change.inventoryItemId}, quantity change: ${change.quantityChange}`);
          
          // Update inventory stock
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
            [change.quantityChange, change.inventoryItemId]
          );
          
          // Create adjustment transaction record
          // Get current stock for previousQuantity
          const [stockRows] = await connection.execute(
            'SELECT current_stock FROM inventory_items WHERE id = ?',
            [change.inventoryItemId]
          );
          const currentStock = stockRows[0]?.current_stock || 0;
          const newStock = currentStock + change.quantityChange;
          
          await createAdjustmentTransaction(
            change.inventoryItemId,
            currentStock,
            newStock,
            req.user.id,
            req.user.name || req.user.username,
            req.user.role,
            `Sale modification by ${req.user.name || req.user.username}`
          );
          
        } catch (error) {
          console.error(`[SalesController] Error processing modified item ${change.inventoryItemId}:`, error);
          throw error;
        }
      }
    }

    // Update sale items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      console.log('[SalesController] Processing items array with', items.length, 'items');
      
      // Delete existing sale items
      await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      
      // Insert new sale items
      for (const item of items) {
        console.log('[SalesController] Processing item for INSERT:', item)
        console.log('[SalesController] Item properties:', {
          inventoryItemId: item.inventoryItemId,
          sku: item.sku,
          name: item.name,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total
        })
        
        // Helper function to safely parse numeric values
        const safeParseFloat = (value) => {
          if (value === undefined || value === null || value === '') return 0;
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        };
        
        // Prepare values with comprehensive null checks
        const values = [
          id,
          item.inventoryItemId !== undefined && item.inventoryItemId !== null ? item.inventoryItemId : null, // Use null for manual items (database now supports it)
          item.sku !== undefined && item.sku !== null ? item.sku : null,
          (item.name || item.itemName) !== undefined && (item.name || item.itemName) !== null ? (item.name || item.itemName) : null,
          safeParseFloat(item.quantity),
          safeParseFloat(item.unitPrice),
          safeParseFloat(item.discount),
          safeParseFloat(item.total)
        ]
        
        console.log('[SalesController] Prepared values for INSERT:', values)
        console.log('[SalesController] Value types:', values.map(v => typeof v))
        
        // Check for undefined values before SQL execution
        const hasUndefined = values.some(val => val === undefined);
        if (hasUndefined) {
          console.error('[SalesController] ERROR: Found undefined values in INSERT:', values);
          throw new Error('Cannot insert sale item with undefined values');
        }
        
        await connection.execute(
          `INSERT INTO sale_items (
            sale_id, inventory_item_id, sku, name, quantity, 
            unit_price, discount, total, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          values
        );
      }
    } else if (items && Array.isArray(items) && items.length === 0) {
      console.log('[SalesController] Items array is empty, skipping item processing');
    }

    // Update sale details
    const allowedUpdates = [
      'subtotal', 'tax', 'discount', 'total', 
      'paymentMethod', 'paymentStatus', 'status', 'notes',
      'customerName', 'customerEmail', 'customerPhone', 'customerAddress',
      'creditStatus', 'creditAmount', 'paymentAmount'
    ];
    
    const updateFields = [];
    const updateValues = [];
    
    // Handle customer info
    if (updateData.customerName || updateData.customerPhone || updateData.customerEmail || updateData.customerAddress) {
      const customerInfo = {
        name: updateData.customerName || sale.customer_info?.name || 'Walk-in Customer',
        phone: updateData.customerPhone || sale.customer_info?.phone || '',
        email: updateData.customerEmail || sale.customer_info?.email || '',
        address: updateData.customerAddress || sale.customer_info?.address || ''
      };
      
      updateFields.push('customer_info = ?');
      updateValues.push(JSON.stringify(customerInfo));
    }
    
    // Handle other fields
    console.log('[SalesController] Processing updateData:', updateData)
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key) && !key.startsWith('customer')) {
        const value = updateData[key];
        console.log(`[SalesController] Processing field ${key}:`, value, 'type:', typeof value)
        // Skip undefined values to avoid SQL parameter errors
        if (value !== undefined && value !== null) {
          const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updateFields.push(`${dbKey} = ?`);
          
          // Handle different value types properly
          let sqlValue = value;
          if (typeof value === 'boolean') {
            sqlValue = value ? 1 : 0;
          } else if (typeof value === 'string' && value === '') {
            sqlValue = null;
          }
          
          updateValues.push(sqlValue);
          console.log(`[SalesController] Added field ${dbKey} = ${sqlValue} (original: ${value})`)
        } else {
          console.log(`[SalesController] Skipping undefined/null field: ${key}`)
        }
      }
    });
    
    if (updateFields.length > 0) {
      updateValues.push(id);
      
      // Check for undefined values before SQL execution
      const hasUndefined = updateValues.some(val => val === undefined);
      if (hasUndefined) {
        console.error('[SalesController] ERROR: Found undefined values in UPDATE:', updateValues);
        console.error('[SalesController] Update fields:', updateFields);
        throw new Error('Cannot update sale with undefined values');
      }
      
      console.log('[SalesController] Executing UPDATE with values:', updateValues);
      await connection.execute(
        `UPDATE sales SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        updateValues
      );
    }

    await connection.commit();

    // Get updated sale data
    const [updatedSaleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
    const [updatedItems] = await connection.execute('SELECT * FROM sale_items WHERE sale_id = ?', [id]);

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: {
        ...updatedSaleRows[0],
        items: updatedItems
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('[SalesController] Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sale',
      error: error.message
    });
  } finally {
    connection.release();
  }
  };
  
  // Race between the update operation and timeout
  try {
    await Promise.race([updatePromise(), timeoutPromise]);
  } catch (error) {
    console.error('[SalesController] UpdateSale timeout or error:', error);
    res.status(500).json({
      success: false,
      message: error.message.includes('timeout') ? 'Request timeout. Please try again.' : 'Error updating sale',
      error: error.message
    });
  }
};

// @desc    Delete sale
// @route   DELETE /api/sales/:id
// @access  Private (Admin)
const deleteSale = async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      if (req.user.role === 'CASHIER') {
        // Get sale to check scope and user
        const [saleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
        if (saleRows.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: 'Sale not found'
          });
        }
        
        const sale = saleRows[0];
        
        // Check if cashier can only delete their own sales
        if (sale.user_id !== req.user.id) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            message: 'You can only delete your own sales'
          });
        }
        
        // Check if cashier has permission to delete sales
        const Branch = require('../models/Branch');
        const branchSettings = await Branch.getSettings(sale.scope_id);
        if (!branchSettings?.allowCashierSalesDelete) {
          await connection.rollback();
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to delete sales. Contact your administrator.'
          });
        }
      } else {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    await connection.beginTransaction();

    // Get sale and sale items in the same transaction (if not already fetched)
    let saleRows;
    if (req.user.role === 'ADMIN') {
      [saleRows] = await connection.execute('SELECT * FROM sales WHERE id = ?', [id]);
      if (saleRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }
    }

    const [saleItemRows] = await connection.execute('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    
    // Restore inventory stock
    for (const item of saleItemRows) {
      await connection.execute(
        'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
        [item.quantity, item.inventory_item_id]
      );
    }

    // Delete sale items first (due to foreign key constraints)
    await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);

    // Delete the sale
    const [deleteResult] = await connection.execute('DELETE FROM sales WHERE id = ?', [id]);
    
    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sale not found or already deleted'
      });
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({
      success: false,
      message: 'Error deleting sale',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// @desc    Create sales return
// @route   POST /api/sales/returns
// @access  Private (Admin, Cashier)
const createSalesReturn = async (req, res, next) => {
  try {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { saleId, items, reason, notes } = req.body;

    // Validate original sale
    const originalSale = await Sale.findById(saleId);
    if (!originalSale) {
      return res.status(404).json({
        success: false,
        message: 'Original sale not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'ADMIN') {
      // For cashiers, get branch name if not already available
      let userBranchName = req.user.branchName;
      if (req.user.role === 'CASHIER' && !userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (req.user.role === 'CASHIER' && 
          (originalSale.scopeType !== 'BRANCH' || originalSale.scopeId !== userBranchName)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // For warehouse keepers, get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      if (req.user.role === 'WAREHOUSE_KEEPER' && !userWarehouseName && req.user.warehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
        userWarehouseName = warehouses[0]?.name || null;
      }
      
      if (req.user.role === 'WAREHOUSE_KEEPER' && 
          (originalSale.scopeType !== 'WAREHOUSE' || originalSale.scopeId !== userWarehouseName)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Calculate return totals
    let totalRefund = 0;
    for (const item of items) {
      totalRefund += parseFloat(item.refundAmount) || 0;
    }

    // Enrich items with product details
    const enrichedItems = [];
    for (const item of items) {
      // Handle manual items (no inventory validation needed)
      if (!item.inventoryItemId && !item.productName) {
        console.log(`[SalesController] Processing manual item return: ${item.name || item.itemName}`);
        enrichedItems.push({
          inventoryItemId: null, // Manual items don't have inventory ID
          itemName: item.name || item.itemName,
          sku: item.sku || `MANUAL-${Date.now()}`,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice) || 0,
          refundAmount: item.refundAmount
        });
        continue;
      }
      
      // If productName is provided, find the inventory item
      if (item.productName) {
        const [inventoryItems] = await pool.execute(
          'SELECT * FROM inventory_items WHERE name LIKE ? OR sku LIKE ? LIMIT 1',
          [`%${item.productName}%`, `%${item.productName}%`]
        );
        
        if (inventoryItems.length > 0) {
          const inventoryItem = inventoryItems[0];
          enrichedItems.push({
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            quantity: item.quantity,
            unitPrice: parseFloat(inventoryItem.selling_price) || 0,
            refundAmount: item.refundAmount
          });
        } else {
          // If product not found in inventory, treat as manual item
          console.log(`[SalesController] Product "${item.productName}" not found in inventory, treating as manual item`);
          enrichedItems.push({
            inventoryItemId: null,
            itemName: item.productName,
            sku: `MANUAL-${Date.now()}`,
            quantity: item.quantity,
            unitPrice: parseFloat(item.unitPrice) || 0,
            refundAmount: item.refundAmount
          });
        }
      } else if (item.inventoryItemId) {
        // If inventoryItemId is provided, get the item details
        const [inventoryItems] = await pool.execute(
          'SELECT * FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        
        if (inventoryItems.length > 0) {
          const inventoryItem = inventoryItems[0];
          enrichedItems.push({
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            quantity: item.quantity,
            unitPrice: parseFloat(inventoryItem.selling_price) || 0,
            refundAmount: item.refundAmount
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Inventory item with ID ${item.inventoryItemId} not found`
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either productName or inventoryItemId is required for each item'
        });
      }
    }
    

    // Check if sales_returns table exists
    try {
      const [tables] = await pool.execute("SHOW TABLES LIKE 'sales_returns'");
      
      if (tables.length === 0) {
        throw new Error('sales_returns table does not exist');
      }
    } catch (tableError) {
      console.error('[DEBUG] Table check failed:', tableError);
      throw new Error('Database table check failed');
    }

    // Create sales return
    const returnData = {
      originalSaleId: saleId,
      userId: req.user.id,
      reason,
      notes,
      totalRefund,
      items: enrichedItems,
      processedBy: req.user.id // Set processed_by to current user
    };

    const salesReturn = await SalesReturn.create(returnData);

    // Restore inventory stock and create transaction records
    for (const item of enrichedItems) {
      try {
        // Skip manual items (they don't have inventoryItemId)
        if (!item.inventoryItemId) {
          console.log(`[SalesController] Skipping manual item in return: ${item.name}`);
          continue;
        }
        
        // Update stock first
      await InventoryItem.updateStock(item.inventoryItemId, item.quantity);
        
        // Create transaction record for stock report
        await createReturnTransaction(
          item.inventoryItemId,
          item.quantity,
          item.unitPrice,
          req.user.id,
          req.user.name,
          req.user.role,
          salesReturn.id
        );
        
      } catch (stockError) {
        console.error('Error restoring stock for item:', item.inventoryItemId, stockError);
        throw stockError;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Sales return created successfully',
      data: salesReturn
    });
  } catch (error) {
    console.error('[DEBUG] Error creating sales return:', error);
    console.error('[DEBUG] Error stack:', error.stack);
    console.error('[DEBUG] Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    res.status(500).json({
      success: false,
      message: 'Error creating sales return',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage
      } : undefined
    });
  }
};

// @desc    Get sales returns
// @route   GET /api/sales/returns
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getSalesReturns = async (req, res, next) => {
  try {
    const { scopeType, scopeId, startDate, endDate } = req.query;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can always view sales returns (read-only access)
      // Get branch name if not already available
      let userBranchName = req.user.branchName;
      if (!userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (userBranchName) {
        // Handle both string and number comparisons for scope_id
        whereConditions.push('s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)');
        params.push('BRANCH', userBranchName, String(userBranchName));
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      if (!userWarehouseName && req.user.warehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
        userWarehouseName = warehouses[0]?.name || null;
      }
      
      if (userWarehouseName) {
        // Handle both string and number comparisons for scope_id
        whereConditions.push('s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)');
        params.push('WAREHOUSE', userWarehouseName, String(userWarehouseName));
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('WAREHOUSE');
      }
    } else if (scopeType && scopeId) {
      if (scopeType === 'WAREHOUSE') {
        // For warehouse scope, we need to resolve warehouse ID to warehouse keeper ID
        // because sales are stored with warehouse keeper ID as scope_id
        const [warehouseKeepers] = await pool.execute(
          'SELECT id FROM users WHERE warehouse_id = ? AND role = "WAREHOUSE_KEEPER"',
          [scopeId]
        );
        
        if (warehouseKeepers.length > 0) {
          // Use the warehouse keeper ID for filtering
          const warehouseKeeperIds = warehouseKeepers.map(wk => wk.id);
          const placeholders = warehouseKeeperIds.map(() => '?').join(',');
          whereConditions.push(`s.scope_type = ? AND s.scope_id IN (${placeholders})`);
          params.push(scopeType, ...warehouseKeeperIds);
        } else {
          // No warehouse keepers found for this warehouse
          whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
          params.push(scopeType, -1); // Use -1 to ensure no matches
        }
      } else {
        // For other scope types (BRANCH), use the scopeId directly
        whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
        params.push(scopeType, scopeId);
      }
    }

    if (startDate) {
      whereConditions.push('sr.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('sr.created_at <= ?');
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [returns] = await pool.execute(`
      SELECT 
        sr.*,
        s.invoice_no,
        u.username,
        u.email,
        u.username as user_name,
        p.username as processed_by_username,
        p.username as processed_by_name,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.user_id = u.id
      LEFT JOIN users p ON sr.processed_by = p.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY sr.created_at DESC
    `, params);

    res.json({
      success: true,
      count: returns.length,
      data: returns
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales returns',
      error: error.message
    });
  }
};

// @desc    Update sales return
// @route   PUT /api/sales/returns/:id
// @access  Private (Admin, Cashier, Warehouse Keeper)
const updateSalesReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, processedBy, approvedBy } = req.body;


    // Check if return exists
    const [existingReturns] = await pool.execute(
      'SELECT * FROM sales_returns WHERE id = ?',
      [id]
    );

    if (existingReturns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sales return not found'
      });
    }

    const existingReturn = existingReturns[0];

    // Build update query dynamically
    const updateFields = [];
    const params = [];

    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (processedBy !== undefined) {
      updateFields.push('processed_by = ?');
      params.push(processedBy);
    }

    if (approvedBy !== undefined) {
      updateFields.push('approved_by = ?');
      params.push(approvedBy);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = NOW()');
    params.push(id);

    const query = `UPDATE sales_returns SET ${updateFields.join(', ')} WHERE id = ?`;
    

    const [result] = await pool.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sales return not found or no changes made'
      });
    }

    // Fetch updated return
    const [updatedReturns] = await pool.execute(`
      SELECT 
        sr.*,
        s.invoice_no,
        u.username,
        u.email,
        u.username as user_name,
        p.username as processed_by_username,
        p.username as processed_by_name,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.user_id = u.id
      LEFT JOIN users p ON sr.processed_by = p.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      WHERE sr.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Sales return updated successfully',
      data: updatedReturns[0]
    });

  } catch (error) {
    console.error('[DEBUG] Error updating sales return:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating sales return',
      error: error.message
    });
  }
};

// @desc    Get sales history for a specific company
// @route   GET /api/sales/company/:companyId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getCompanySalesHistory = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;
    
    let whereConditions = ['JSON_EXTRACT(customer_info, "$.id") = ?'];
    let params = [companyId];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Get branch name if not already available
      let userBranchName = req.user.branchName;
      if (!userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (userBranchName) {
        // Handle both string and number comparisons for scope_id
        whereConditions.push('scope_type = ? AND (scope_id = ? OR scope_id = ?)');
        params.push('BRANCH', userBranchName, String(userBranchName));
      } else {
        whereConditions.push('scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      if (!userWarehouseName && req.user.warehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
        userWarehouseName = warehouses[0]?.name || null;
      }
      
      if (userWarehouseName) {
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push('WAREHOUSE', userWarehouseName);
      } else {
        whereConditions.push('scope_type = ?');
        params.push('WAREHOUSE');
      }
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get sales history
    const [sales] = await pool.execute(`
      SELECT 
        s.id,
        s.invoice_no,
        s.subtotal,
        s.tax,
        s.discount,
        s.total,
        s.payment_method,
        s.payment_status,
        s.status,
        s.customer_info,
        s.notes,
        s.created_at,
        s.updated_at,
        u.username as created_by,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ?
    `, [...params, parseInt(limit)]);

    // Get sales items for each sale
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      const [items] = await pool.execute(`
        SELECT 
          si.*,
          ii.name as item_name,
          ii.sku,
          ii.unit_price
        FROM sale_items si
        LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
        WHERE si.sale_id = ?
        ORDER BY si.id
      `, [sale.id]);

      return {
        ...sale,
        items: items.map(item => ({
          id: item.id,
          inventoryItemId: item.inventory_item_id,
          itemName: item.item_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price) || 0,
          total: parseFloat(item.total) || 0
        }))
      };
    }));

    // Calculate summary statistics
    const totalSales = salesWithItems.length;
    const totalAmount = salesWithItems.reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    const paymentMethods = [...new Set(salesWithItems.map(sale => sale.payment_method))];
    const paymentStatuses = [...new Set(salesWithItems.map(sale => sale.payment_status))];

    res.json({
      success: true,
      message: 'Company sales history retrieved successfully',
      data: {
        company: salesWithItems[0]?.customer_info || {},
        summary: {
          totalSales,
          totalAmount,
          paymentMethods,
          paymentStatuses
        },
        sales: salesWithItems
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving company sales history',
      error: error.message
    });
  }
};

// @desc    Get invoice details with items
// @route   GET /api/sales/invoice/:invoiceId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getInvoiceDetails = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    
    // Validate invoiceId
    if (!invoiceId || isNaN(invoiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }
    
    // Get the sale/invoice details
    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username as created_by_username,
        u.email as created_by_email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.id
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.id
      WHERE s.id = ?
    `, [invoiceId]);
    
    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    const sale = sales[0];
    
    // Get sale items
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
    `, [invoiceId]);
    
    // Parse customer_info safely
    let customerInfo = null;
    try {
      if (sale.customer_info) {
        customerInfo = JSON.parse(sale.customer_info);
      }
    } catch (parseError) {
      customerInfo = null;
    }
    
    // Format the response
    const invoiceDetails = {
      id: sale.id,
      invoiceNo: sale.invoice_no,
      createdAt: sale.created_at,
      updatedAt: sale.updated_at,
      subtotal: parseFloat(sale.subtotal) || 0,
      tax: parseFloat(sale.tax) || 0,
      discount: parseFloat(sale.discount) || 0,
      total: parseFloat(sale.total) || 0,
      paymentMethod: sale.payment_method,
      paymentStatus: sale.payment_status,
      status: sale.status,
      notes: sale.notes,
      customerInfo: customerInfo,
      scopeType: sale.scope_type,
      scopeId: sale.scope_id,
      branchName: sale.branch_name,
      warehouseName: sale.warehouse_name,
      createdBy: {
        username: sale.created_by_username,
        email: sale.created_by_email
      },
      items: items.map(item => ({
        id: item.id,
        inventoryItemId: item.inventory_item_id,
        itemName: item.item_name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price) || 0,
        catalogPrice: parseFloat(item.catalog_price) || 0,
        costPrice: parseFloat(item.cost_price) || 0,
        discount: parseFloat(item.discount) || 0,
        total: parseFloat(item.total) || 0
      }))
    };
    
    res.json({
      success: true,
      message: 'Invoice details retrieved successfully',
      data: invoiceDetails
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving invoice details',
      error: error.message
    });
  }
};

// @desc    Search products by name or SKU
// @route   GET /api/sales/products/search
// @access  Private (Admin, Cashier, Warehouse Keeper)
const searchProducts = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }
    
    const [products] = await pool.execute(`
      SELECT 
        id,
        name,
        sku,
        selling_price,
        cost_price,
        current_stock,
        category
      FROM inventory_items 
      WHERE name LIKE ? OR sku LIKE ?
      ORDER BY 
        CASE 
          WHEN name = ? THEN 1
          WHEN sku = ? THEN 2
          WHEN name LIKE ? THEN 3
          WHEN sku LIKE ? THEN 4
          ELSE 5
        END,
        name ASC
      LIMIT ?
    `, [
      `%${q}%`, `%${q}%`, 
      q, q, 
      `${q}%`, `${q}%`, 
      parseInt(limit)
    ]);
    
    res.json({
      success: true,
      data: products.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        sellingPrice: parseFloat(product.selling_price) || 0,
        costPrice: parseFloat(product.cost_price) || 0,
        currentStock: parseFloat(product.current_stock) || 0,
        category: product.category
      }))
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching products',
      error: error.message
    });
  }
};

// @desc    Search sales by invoice number or sale ID
// @route   GET /api/sales/search
// @access  Private (Admin, Cashier, Warehouse Keeper)
const searchSales = async (req, res, next) => {
  try {
    
    // Test database connection
    try {
      await pool.execute('SELECT 1');
    } catch (dbError) {
      console.error('[DEBUG] Database connection failed:', dbError);
      throw new Error('Database connection failed');
    }
    
    const { invoiceNumber, saleId } = req.query;
    
    if (!invoiceNumber && !saleId) {
      return res.status(400).json({
        success: false,
        message: 'Invoice number or sale ID is required'
      });
    }

    let whereConditions = [];
    let params = [];

    // Search by invoice number or sale ID
    if (invoiceNumber) {
      whereConditions.push('(s.invoice_no LIKE ? OR s.id = ?)');
      params.push(`%${invoiceNumber}%`, invoiceNumber);
    } else if (saleId) {
      whereConditions.push('s.id = ?');
      params.push(saleId);
    }

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Get branch name if not already available
      let userBranchName = req.user.branchName;
      if (!userBranchName && req.user.branchId) {
        const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
        userBranchName = branches[0]?.name || null;
      }
      
      if (userBranchName) {
        // Handle both string and number comparisons for scope_id
        whereConditions.push('s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)');
        params.push('BRANCH', userBranchName, String(userBranchName));
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      if (!userWarehouseName && req.user.warehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
        userWarehouseName = warehouses[0]?.name || null;
      }
      
      if (userWarehouseName) {
        whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
        params.push('WAREHOUSE', userWarehouseName);
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('WAREHOUSE');
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Check if sales table exists
    try {
      const [tables] = await pool.execute("SHOW TABLES LIKE 'sales'");
      if (tables.length === 0) {
        throw new Error('Sales table does not exist');
      }
      
    } catch (tableError) {
      console.error('[DEBUG] Table check failed:', tableError);
      throw new Error('Database table check failed');
    }
    

    // Get sales with items (simplified query without branches/warehouses joins)
    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username as user_name,
        u.role as user_role,
        s.scope_id as scope_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT 10
    `, params);
    

    // Get sales items for each sale
    const salesWithItems = await Promise.all(sales.map(async (sale) => {
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
      `, [sale.id]);

      const saleData = {
        ...sale,
        customerInfo: sale.customer_info ? JSON.parse(sale.customer_info) : null,
        items: items.map(item => ({
          id: item.id,
          inventoryItemId: item.inventory_item_id,
          itemName: item.item_name,
          name: item.item_name, // For compatibility
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.unit_price) || 0,
          originalPrice: parseFloat(item.original_price) || 0,
          discount: parseFloat(item.discount) || 0,
          discountType: item.discount_type || 'amount',
          total: parseFloat(item.total) || 0,
          category: item.category
        }))
      };
      
      return saleData;
    }));

    
    res.json({
      success: true,
      count: salesWithItems.length,
      data: salesWithItems,
      debug: {
        version: 'V2.0',
        timestamp: new Date().toISOString(),
        fixedColumn: 'u.username instead of u.name'
      }
    });

  } catch (error) {
    console.error('[DEBUG] Error searching sales:', error);
    console.error('[DEBUG] Error stack:', error.stack);
    console.error('[DEBUG] Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    res.status(500).json({
      success: false,
      message: 'Error searching sales',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage
      } : undefined
    });
  }
};

// @desc    Get invoice number statistics for a branch/warehouse
// @route   GET /api/sales/invoice-stats/:scopeType/:scopeId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getInvoiceStats = async (req, res, next) => {
  try {
    const { scopeType, scopeId } = req.params;
    
    // Validate scope type
    if (!['BRANCH', 'WAREHOUSE'].includes(scopeType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scope type. Must be BRANCH or WAREHOUSE'
      });
    }
    
    const stats = await InvoiceNumberService.getInvoiceStats(scopeType.toUpperCase(), scopeId);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('[SalesController] Error getting invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting invoice statistics',
      error: error.message
    });
  }
};

// @desc    Get salesperson-specific invoice statistics for warehouse
// @route   GET /api/sales/salesperson-stats/:warehouseId/:userId
// @access  Private (Admin, Warehouse Keeper)
const getSalespersonInvoiceStats = async (req, res, next) => {
  try {
    const { warehouseId, userId } = req.params;
    
    // Get warehouse code
    const [warehouses] = await pool.execute(
      'SELECT code FROM warehouses WHERE id = ? OR name = ?',
      [warehouseId, warehouseId]
    );
    
    if (warehouses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }
    
    const warehouseCode = warehouses[0].code;
    
    // Get salesperson username
    const [users] = await pool.execute(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const username = users[0].username;
    const salespersonCode = username.substring(0, 3).toUpperCase();
    const prefix = `${warehouseCode}-${salespersonCode}`;
    
    // Get statistics
    const [statsRows] = await pool.execute(
      `SELECT 
        COUNT(*) as total_invoices,
        MIN(invoice_no) as first_invoice,
        MAX(invoice_no) as last_invoice,
        MIN(created_at) as first_date,
        MAX(created_at) as last_date,
        SUM(total) as total_sales_amount
      FROM sales 
      WHERE invoice_no LIKE ?`,
      [`${prefix}-%`]
    );
    
    const stats = statsRows[0];
    const nextNumber = (stats.total_invoices || 0) + 1;
    
    res.json({
      success: true,
      data: {
        warehouseCode,
        salespersonCode,
        salespersonName: username,
        prefix,
        totalInvoices: stats.total_invoices || 0,
        firstInvoice: stats.first_invoice,
        lastInvoice: stats.last_invoice,
        firstDate: stats.first_date,
        lastDate: stats.last_date,
        totalSalesAmount: parseFloat(stats.total_sales_amount) || 0,
        nextInvoiceNumber: `${prefix}-${nextNumber.toString().padStart(6, '0')}`
      }
    });
    
  } catch (error) {
    console.error('[SalesController] Error getting salesperson invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting salesperson invoice statistics',
      error: error.message
    });
  }
};

// @desc    Preview next invoice number for a branch/warehouse
// @route   GET /api/sales/next-invoice/:scopeType/:scopeId
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getNextInvoiceNumber = async (req, res, next) => {
  try {
    const { scopeType, scopeId } = req.params;
    
    // Validate scope type
    if (!['BRANCH', 'WAREHOUSE'].includes(scopeType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scope type. Must be BRANCH or WAREHOUSE'
      });
    }
    
    const nextInvoiceNumber = await InvoiceNumberService.getNextInvoiceNumber(scopeType.toUpperCase(), scopeId);
    
    res.json({
      success: true,
      data: {
        nextInvoiceNumber
      }
    });
    
  } catch (error) {
    console.error('[SalesController] Error getting next invoice number:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting next invoice number',
      error: error.message
    });
  }
};

// @desc    Search outstanding payments by customer name or phone (TOTAL SUM ONLY)
// @route   GET /api/sales/outstanding
// @access  Private (Cashier)
const searchOutstandingPayments = async (req, res) => {
  try {
    const { customerName, phone } = req.query;

    if (!customerName && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name or phone is required'
      });
    }

    let query = `
      SELECT 
        customer_name,
        customer_phone as phone,
        SUM(credit_amount) as total_outstanding,
        COUNT(id) as pending_sales_count
      FROM sales
      WHERE credit_amount > 0 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
    `;
    
    const params = [];
    
    if (customerName) {
      query += ' AND customer_name LIKE ?';
      params.push(`%${customerName}%`);
    }
    
    if (phone) {
      query += ' AND customer_phone LIKE ?';
      params.push(`%${phone}%`);
    }
    
    query += ' GROUP BY customer_name, customer_phone HAVING total_outstanding > 0';

    const [results] = await pool.execute(query, params);

    res.json({
      success: true,
      data: results.map(customer => ({
        customerName: customer.customer_name,
        phone: customer.phone,
        totalOutstanding: parseFloat(customer.total_outstanding) || 0,
        pendingSalesCount: customer.pending_sales_count
      }))
    });

  } catch (error) {
    console.error('Error searching outstanding payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching outstanding payments',
      error: error.message
    });
  }
};

// @desc    Clear outstanding payment for customer
// @route   POST /api/sales/clear-outstanding
// @access  Private (Cashier)
const clearOutstandingPayment = async (req, res) => {
  try {
    const { customerName, phone, paymentAmount, paymentMethod } = req.body;

    if (!customerName || !phone || !paymentAmount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, payment amount, and payment method are required'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get all outstanding sales for the customer
      const [outstandingSales] = await connection.execute(
        `SELECT id, invoice_no, credit_amount, payment_amount, total, payment_status
         FROM sales 
         WHERE customer_name = ? AND customer_phone = ? 
           AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL') 
           AND credit_amount > 0
         ORDER BY created_at ASC`,
        [customerName, phone]
      );

      if (outstandingSales.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No outstanding payments found for this customer'
        });
      }

      let remainingPayment = parseFloat(paymentAmount);
      let processedSales = [];

      // Process each outstanding sale
      for (const sale of outstandingSales) {
        if (remainingPayment <= 0) break;

        const currentCredit = parseFloat(sale.credit_amount);
        const paymentToApply = Math.min(remainingPayment, currentCredit);
        
        // Update the sale
        const newPaymentAmount = parseFloat(sale.payment_amount) + paymentToApply;
        const newCreditAmount = currentCredit - paymentToApply;
        const newPaymentStatus = newCreditAmount <= 0 ? 'COMPLETED' : 'PARTIAL';

        await connection.execute(
          `UPDATE sales 
           SET payment_amount = ?, 
               credit_amount = ?, 
               payment_status = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [newPaymentAmount, newCreditAmount, newPaymentStatus, sale.id]
        );

        processedSales.push({
          saleId: sale.id,
          invoiceNo: sale.invoice_no,
          paymentApplied: paymentToApply,
          remainingCredit: newCreditAmount,
          newStatus: newPaymentStatus
        });

        remainingPayment -= paymentToApply;
      }

      await connection.commit();

      // Get updated outstanding amount
      const [outstanding] = await connection.execute(
        `SELECT SUM(credit_amount) as remaining_outstanding
         FROM sales 
         WHERE customer_name = ? AND customer_phone = ? 
           AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL') AND credit_amount > 0`,
        [customerName, phone]
      );

      const remainingOutstanding = parseFloat(outstanding[0].remaining_outstanding) || 0;

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          customerName,
          phone,
          paymentAmount: parseFloat(paymentAmount),
          paymentMethod,
          remainingOutstanding,
          isFullyCleared: remainingOutstanding <= 0,
          processedSales,
          unprocessedAmount: remainingPayment
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error clearing outstanding payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing outstanding payment',
      error: error.message
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSale,
  updateSale,
  deleteSale,
  createSalesReturn,
  getSalesReturns,
  updateSalesReturn,
  getCompanySalesHistory,
  getInvoiceDetails,
  searchProducts,
  searchSales,
  getInvoiceStats,
  getNextInvoiceNumber,
  getSalespersonInvoiceStats,
  searchOutstandingPayments,
  clearOutstandingPayment
};