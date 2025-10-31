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


// Helper function to get customer's current running balance
const getCustomerRunningBalance = async (customerName, customerPhone, scopeType, scopeName) => {
  try {
    const [latestSale] = await pool.execute(`
      SELECT running_balance 
      FROM sales 
      WHERE (customer_name = ? OR customer_phone = ?)
        AND scope_type = ? 
        AND scope_id = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `, [customerName, customerPhone, scopeType, scopeName]);
    
    if (latestSale.length > 0) {
      return parseFloat(latestSale[0].running_balance) || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching customer running balance:', error);
    return 0;
  }
};

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

    const { items, scopeType, scopeId, paymentMethod, paymentType, customerInfo, notes, subtotal, tax, discount, total, paymentStatus, status, paymentAmount, creditAmount, creditStatus } = req.body;

    // Debug: Log the received payment method
    console.log('[SalesController] Received paymentMethod:', paymentMethod, 'Type:', typeof paymentMethod);
    console.log('[SalesController] Received paymentType:', paymentType, 'Type:', typeof paymentType);

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
    
    // IMPORTANT: Store the bill amount (items total) separately from the net total (which includes credit)
    const billAmount = finalSubtotal + finalTax - finalDiscount; // The actual bill amount

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
      // Convert scopeId to number for InvoiceNumberService if it's a string
      const numericScopeId = typeof scopeId === 'string' ? parseInt(scopeId) : scopeId;
      console.log('[SalesController] Generating invoice with scopeType:', scopeType, 'scopeId:', scopeId, 'numericScopeId:', numericScopeId);
      
      // Debug: Check if branch exists and has code
      if (scopeType === 'BRANCH') {
        const [branches] = await pool.execute('SELECT id, name, code FROM branches WHERE id = ?', [numericScopeId]);
        console.log('[SalesController] Branch lookup result:', branches);
        if (branches.length === 0) {
          throw new Error(`Branch not found with ID: ${numericScopeId}`);
        }
        const branch = branches[0];
        console.log('[SalesController] Branch details:', { id: branch.id, name: branch.name, code: branch.code });
      }
      
      invoiceNo = await InvoiceNumberService.generateInvoiceNumber(scopeType, numericScopeId);
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
      const numericScopeId = typeof scopeId === 'string' ? parseInt(scopeId) : scopeId;
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [numericScopeId]);
      scopeName = branches[0]?.name || scopeId;
    } else if (scopeType === 'WAREHOUSE' && scopeId) {
      const numericScopeId = typeof scopeId === 'string' ? parseInt(scopeId) : scopeId;
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [numericScopeId]);
      scopeName = warehouses[0]?.name || scopeId;
    } else {
      scopeName = scopeId || '';
    }
    
    // Get customer's current running balance from previous transactions
    const previousRunningBalance = await getCustomerRunningBalance(customerName, customerPhone, scopeType, scopeName);
    console.log('💰 Customer previous running balance:', previousRunningBalance);

    // ✅ CORRECTED: Payment calculation for different scenarios
    let finalPaymentAmount, finalCreditAmount;

    console.log('💰 Payment calculation - Inputs:', {
        paymentMethod,
        paymentAmount: paymentAmount !== undefined ? parseFloat(paymentAmount) : null,
        creditAmount: creditAmount !== undefined ? parseFloat(creditAmount) : null,
        billAmount,
        previousRunningBalance,
        customerHasCredit: previousRunningBalance < 0
    });

    if (paymentMethod === 'FULLY_CREDIT') {
        // Scenario 4: Fully Credit
        // Customer takes items on complete credit
        finalPaymentAmount = 0;
        finalCreditAmount = billAmount;
        console.log('💰 Scenario 4 - Fully Credit:', { finalPaymentAmount, finalCreditAmount });
    } else if (paymentType === 'BALANCE_PAYMENT' || (paymentAmount !== undefined && parseFloat(paymentAmount) === 0 && creditAmount !== undefined)) {
        // NEW SCENARIO: Balance Payment
        // Customer uses their available credit balance (negative outstanding balance)
        // Payment: 0 (no cash paid), Credit: billAmount (uses from balance)
        finalPaymentAmount = 0;
        finalCreditAmount = parseFloat(creditAmount) || billAmount; // Use credit amount from frontend or bill amount
        console.log('💰 Scenario 5 - Balance Payment:', { 
            previousBalance: previousRunningBalance,
            finalPaymentAmount, 
            finalCreditAmount,
            billAmount 
        });
    } else {
        // Handle other payment methods
        const providedPaymentAmount = paymentAmount !== undefined ? parseFloat(paymentAmount) : null;
        const providedCreditAmount = creditAmount !== undefined ? parseFloat(creditAmount) : null;
        
        if (providedPaymentAmount !== null && providedCreditAmount !== null) {
            // Both amounts explicitly provided
            finalPaymentAmount = providedPaymentAmount;
            finalCreditAmount = providedCreditAmount;
            console.log('💰 Both amounts provided:', { finalPaymentAmount, finalCreditAmount });
        } else if (providedPaymentAmount !== null) {
            // Only payment amount provided - calculate credit
            finalPaymentAmount = providedPaymentAmount;
            finalCreditAmount = billAmount - providedPaymentAmount;
            console.log('💰 Payment amount provided, credit calculated:', { finalPaymentAmount, finalCreditAmount });
        } else if (providedCreditAmount !== null) {
            // Only credit amount provided - calculate payment
            finalCreditAmount = providedCreditAmount;
            finalPaymentAmount = billAmount - providedCreditAmount;
            console.log('💰 Credit amount provided, payment calculated:', { finalPaymentAmount, finalCreditAmount });
        } else {
            // No amounts provided - assume full payment (Scenario 1)
            finalPaymentAmount = billAmount;
            finalCreditAmount = 0;
            console.log('💰 Scenario 1 - Full Payment (default):', { finalPaymentAmount, finalCreditAmount });
        }
    }

    // ✅ CORRECTED: Handle customer's previous balance (credit/advance payment)
    // Only auto-adjust if amounts weren't explicitly provided by frontend
    const amountsExplicitlyProvided = paymentAmount !== undefined && creditAmount !== undefined;
    
    let adjustedCreditAmount = finalCreditAmount;
    let adjustedPaymentAmount = finalPaymentAmount;

    // Special handling for BALANCE_PAYMENT: Don't adjust, amounts are correct
    if (paymentType === 'BALANCE_PAYMENT') {
        console.log('💰 Balance Payment - Using amounts from frontend without adjustment:', {
            finalPaymentAmount,
            finalCreditAmount,
            previousBalance: previousRunningBalance
        });
        // Keep the amounts as-is - no adjustment needed
        adjustedPaymentAmount = finalPaymentAmount;
        adjustedCreditAmount = finalCreditAmount;
    } else if (previousRunningBalance < 0 && !amountsExplicitlyProvided) {
        // Customer has advance credit - use it for this purchase (only if amounts weren't explicitly set)
        const availableCredit = Math.abs(previousRunningBalance);
        
        console.log('💰 Customer has advance credit:', {
            previousBalance: previousRunningBalance,
            availableCredit,
            billAmount,
            currentPayment: adjustedPaymentAmount,
            currentCredit: adjustedCreditAmount
        });
        
        if (billAmount <= availableCredit) {
            // Entire purchase can be covered by existing credit
            adjustedPaymentAmount = 0;
            adjustedCreditAmount = -billAmount; // Negative credit means using advance credit
            console.log('💰 Using full credit for purchase');
        } else {
            // Part of purchase covered by credit, rest by payment
            adjustedPaymentAmount = billAmount - availableCredit;
            adjustedCreditAmount = -availableCredit; // Negative credit means using advance credit
            console.log('💰 Using partial credit for purchase');
        }
        
        console.log('💰 After credit adjustment:', {
            adjustedPaymentAmount,
            adjustedCreditAmount
        });
    } else if (previousRunningBalance < 0 && amountsExplicitlyProvided) {
        console.log('💰 Skipping credit adjustment - amounts explicitly provided by frontend');
    }

    // Use adjusted amounts
    finalPaymentAmount = adjustedPaymentAmount;
    finalCreditAmount = adjustedCreditAmount;

    // Calculate running balance for this transaction
    // running_balance = previous_balance + (bill_amount - payment_amount)
    // This means: balance increases by unpaid amount (credit given)
    // OR: balance decreases by payment amount (debt paid)
    const newCreditAmount = billAmount - finalPaymentAmount;
    const runningBalance = previousRunningBalance + newCreditAmount;

    console.log('💰 FINAL Payment calculation:', {
        scenario: getPaymentScenario(finalPaymentAmount, finalCreditAmount, billAmount),
        previousRunningBalance,
        billAmount,
        finalPaymentAmount,
        finalCreditAmount,
        newCreditAmount,
        runningBalance,
        calculation: `${previousRunningBalance} + ${newCreditAmount} = ${runningBalance}`
    });

    // Helper function to identify payment scenario
    function getPaymentScenario(payment, credit, bill) {
        if (payment === bill && credit === 0) return 'Full Payment';
        if (payment === 0 && credit === bill) return 'Fully Credit';
        if (payment > 0 && credit > 0 && payment + credit === bill) return 'Partial Payment';
        if (credit < 0) return 'Using Customer Credit';
        return 'Mixed Scenario';
    }

    // ✅ CORRECTED: Payment validation for all scenarios
    let isValid = true;
    let errorMessage = '';

    // Calculate the actual amount that needs to be covered
    // Use finalTotal (which includes outstanding balance) instead of billAmount (cart only)
    const amountToCover = finalTotal; // This includes outstanding balance from frontend
    
    console.log('💰 Validation amounts:', {
        billAmount, // Cart only (subtotal + tax - discount)
        finalTotal, // Cart + outstanding (from frontend)
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        using: 'finalTotal for validation'
    });

    if (finalCreditAmount < 0) {
        // Customer is using advance credit OR overpaying (negative credit amount)
        // Example: Payment: 7000, Credit: -5900, Bill: 5400
        // Validation: 7000 + (-5900) = 1100 ❌ BUT net amount (5400) is already paid via credit
        // ACTUALLY: frontend sends paymentAmount + creditAmount = totalWithOutstanding
        // So validation should check against finalTotal (not billAmount)
        const totalCoverage = finalPaymentAmount + finalCreditAmount; // Don't use Math.abs!
        isValid = Math.abs(totalCoverage - finalTotal) <= 0.01;
        errorMessage = `Payment (${finalPaymentAmount}) + credit (${finalCreditAmount}) must equal total amount (${finalTotal})`;
        
        console.log('💰 Overpayment/Credit validation:', {
            billAmount,
            finalTotal,
            creditAmount: finalCreditAmount, // Keep negative
            paymentAmount: finalPaymentAmount,
            totalCoverage,
            isValid
        });
    } else {
        // Normal case: payment + credit should equal total amount (including outstanding)
        const totalCoverage = finalPaymentAmount + finalCreditAmount;
        isValid = Math.abs(totalCoverage - finalTotal) <= 0.01;
        errorMessage = `Payment amount (${finalPaymentAmount}) + credit amount (${finalCreditAmount}) must equal total amount (${finalTotal})`;
        
        console.log('💰 Normal payment validation:', {
            billAmount,
            finalTotal,
            paymentAmount: finalPaymentAmount,
            creditAmount: finalCreditAmount,
            totalCoverage,
            isValid
        });
    }

    if (!isValid) {
        return res.status(400).json({
            success: false,
            message: errorMessage
        });
    }
    
    // ✅ CORRECTED: Enhanced payment status logic
    let finalPaymentStatus;
    if (paymentStatus) {
        // Use provided status if valid
        finalPaymentStatus = paymentStatus;
    } else if (paymentType === 'BALANCE_PAYMENT') {
        // Balance payment: Customer uses credit balance - payment is COMPLETED using credit
        finalPaymentStatus = 'COMPLETED';
    } else if (paymentMethod === 'FULLY_CREDIT') {
        finalPaymentStatus = 'PENDING';  // Fully credit sales are PENDING
    } else if (finalCreditAmount > 0) {
        finalPaymentStatus = 'PENDING';  // Customer still owes money
    } else if (finalCreditAmount < 0) {
        // Customer used advance credit - payment is COMPLETED but they have new credit
        finalPaymentStatus = 'COMPLETED';
    } else {
        // Credit amount is 0 - payment is exactly balanced
        finalPaymentStatus = 'COMPLETED';
    }

    console.log('💰 Payment status determination:', {
        paymentMethod,
        finalCreditAmount,
        finalPaymentStatus
    });
    
    // Determine credit status
    // Credit status should be 'PENDING' if credit exists (positive or negative)
    const finalCreditStatus = creditStatus || ((finalCreditAmount > 0 || finalCreditAmount < 0) ? 'PENDING' : 'NONE');
    
    // Validate payment amounts (allow negative for overpayments creating advance credit)
    // Only block invalid scenarios: paymentAmount is negative but total is positive
    if (finalPaymentAmount < 0 && finalTotal > 0) {
        return res.status(400).json({
            success: false,
            message: 'Payment amount cannot be negative when total is positive'
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
        scopeId: scopeName || scopeId || null,
        userId: req.user.id || null,
        shiftId: req.body.shiftId || req.currentShift?.id || null,
        subtotal: finalSubtotal || 0,
        tax: finalTax || 0,
        discount: finalDiscount || 0,
        total: billAmount || 0, // ✅ Use bill amount, not final total with credit adjustments
        paymentMethod: paymentMethod || null,
        paymentType: paymentType || null,
        paymentStatus: finalPaymentStatus || null,
        customerInfo: customerInfo ? JSON.stringify(customerInfo) : null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerId: customerId,
        paymentAmount: finalPaymentAmount || 0,
        creditAmount: finalCreditAmount || 0,
        runningBalance: runningBalance || 0, // ADD THIS LINE - crucial for tracking balance
        creditStatus: finalCreditStatus || 'NONE',
        creditDueDate: finalCreditAmount > 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
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
            totalAmount: billAmount, // ✅ Use bill amount for ledger
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
            amount: billAmount, // ✅ Use bill amount for voucher
            description: `Sale from POS Terminal - ${scopeType}: ${scopeName}`,
            reference: invoiceNo,
            scopeType: scopeType,
            scopeId: scopeId,
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            status: 'APPROVED', // Auto-approve sales from POS
            approvedBy: req.user.id,
            approvalNotes: null,
            rejectionReason: null
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
        whereConditions.push('s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)');
        params.push('BRANCH', userBranchName, String(userBranchName));
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('BRANCH');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // For testing: Show all warehouse sales, not just current warehouse
      whereConditions.push('s.scope_type = ?');
      params.push('WAREHOUSE');
      // whereConditions.push('s.scope_type = ? AND s.scope_id = ?');
      // params.push('WAREHOUSE', req.user.warehouseName);
    } else if (req.user.role === 'ADMIN') {
      // Admin can filter by scopeType and/or scopeId
      if (scopeType && scopeType !== 'all') {
        whereConditions.push('s.scope_type = ?');
        params.push(scopeType);
      }
      if (scopeId && scopeId !== 'all') {
        whereConditions.push('s.scope_id = ?');
        params.push(scopeId);
      }
    }

    if (startDate) {
      whereConditions.push('s.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('s.created_at <= ?');
      params.push(endDate);
    }

    if (paymentMethod) {
      whereConditions.push('s.payment_method = ?');
      params.push(paymentMethod);
    }

    if (status) {
      whereConditions.push('s.status = ?');
      params.push(status);
    }

    if (retailerId && retailerId !== 'all') {
      whereConditions.push('JSON_EXTRACT(s.customer_info, "$.id") = ?');
      params.push(retailerId);
    }

    if (customerPhone) {
      whereConditions.push('s.customer_phone = ?');
      params.push(customerPhone);
    }

    if (customerName) {
      whereConditions.push('s.customer_name LIKE ?');
      params.push(`%${customerName}%`);
    }

    if (creditStatus) {
      whereConditions.push('s.credit_status = ?');
      params.push(creditStatus);
    }

    if (paymentStatus) {
      whereConditions.push('s.payment_status = ?');
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
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
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

      // Parse customer_info and enrich with salesperson name if missing
      let customerInfo = sale.customer_info ? JSON.parse(sale.customer_info) : null;
      
      // If customerInfo has salesperson with ID but no name, fetch the name from database
      if (customerInfo && customerInfo.salesperson && customerInfo.salesperson.id && !customerInfo.salesperson.name) {
        try {
          const [salespersonRows] = await pool.execute(
            'SELECT name, phone FROM salespeople WHERE id = ?',
            [customerInfo.salesperson.id]
          );
          if (salespersonRows.length > 0) {
            customerInfo.salesperson.name = salespersonRows[0].name || null;
            customerInfo.salesperson.phone = customerInfo.salesperson.phone || salespersonRows[0].phone || null;
          }
        } catch (error) {
          console.error('[SalesController] Error fetching salesperson name:', error);
        }
      }
      
      const saleData = {
        ...sale,
        customerInfo: customerInfo,
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
          barcode: item.barcode || null,
          category: item.category || null,
          quantity: item.quantity,
          originalQuantity: item.quantity, // For manual items, assume original equals returned
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
            barcode: inventoryItem.barcode || null,
            category: inventoryItem.category || null,
            quantity: item.quantity,
            originalQuantity: item.quantity, // Will be updated with actual original quantity
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
            barcode: item.barcode || null,
            category: item.category || null,
            quantity: item.quantity,
            originalQuantity: item.quantity, // For manual items, assume original equals returned
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
            barcode: inventoryItem.barcode || null,
            category: inventoryItem.category || null,
            quantity: item.quantity,
            originalQuantity: item.quantity, // Will be updated with actual original quantity
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

    const actingUserName = req.user.name || req.user.username || req.user.email || 'System';
    const actingUserRole = req.user.role || 'ADMIN';

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
          actingUserName,
          actingUserRole,
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
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
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

// @desc    Get single sales return with items
// @route   GET /api/sales/returns/:id
// @access  Private (Admin, Cashier, Warehouse Keeper)
const getSalesReturn = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get return details
    const [returns] = await pool.execute(`
      SELECT 
        sr.*,
        s.invoice_no,
        s.scope_type,
        s.scope_id,
        u.username as user_name,
        p.username as processed_by_username,
        p.username as processed_by_name,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales_returns sr
      LEFT JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.user_id = u.id
      LEFT JOIN users p ON sr.processed_by = p.id
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
      WHERE sr.id = ?
    `, [id]);

    if (returns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    const returnData = returns[0];

    // Get return items
    const [items] = await pool.execute(`
      SELECT 
        sri.*,
        ii.name as inventory_item_name,
        ii.sku as inventory_sku,
        ii.selling_price as inventory_price,
        ii.category as inventory_category,
        ii.barcode as inventory_barcode
      FROM sales_return_items sri
      LEFT JOIN inventory_items ii ON sri.inventory_item_id = ii.id
      WHERE sri.return_id = ?
      ORDER BY sri.id
    `, [id]);

    // Transform items data
    const transformedItems = items.map(item => ({
      id: item.id,
      returnId: item.return_id,
      inventoryItemId: item.inventory_item_id,
      itemName: item.item_name || item.inventory_item_name || 'Unknown Item',
      sku: item.sku || item.inventory_sku || 'N/A',
      barcode: item.barcode || item.inventory_barcode || null,
      category: item.category || item.inventory_category || null,
      quantity: parseFloat(item.quantity),
      originalQuantity: parseFloat(item.original_quantity),
      remainingQuantity: parseFloat(item.remaining_quantity),
      unitPrice: parseFloat(item.unit_price),
      refundAmount: parseFloat(item.refund_amount),
      createdAt: item.created_at,
      // Additional inventory info
      inventoryItemName: item.inventory_item_name,
      inventorySku: item.inventory_sku,
      inventoryPrice: parseFloat(item.inventory_price) || 0,
      currentStock: parseFloat(item.current_stock) || 0,
      minStockLevel: parseFloat(item.min_stock_level) || 0,
      maxStockLevel: parseFloat(item.max_stock_level) || 0
    }));

    // Combine return data with items
    const returnWithItems = {
      ...returnData,
      items: transformedItems
    };

    res.json({
      success: true,
      data: returnWithItems
    });

  } catch (error) {
    console.error('[DEBUG] Error fetching sales return:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales return',
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
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
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
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
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
      LEFT JOIN branches b ON s.scope_type = 'BRANCH' AND s.scope_id = b.name
      LEFT JOIN warehouses w ON s.scope_type = 'WAREHOUSE' AND s.scope_id = w.name
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
    
    // Build WHERE conditions for role-based access
    let whereConditions = ['(name LIKE ? OR sku LIKE ?)'];
    let params = [`%${q}%`, `%${q}%`];
    
    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can only see products from their branch
      const userBranchId = req.user.branch_id || req.user.branchId;
      if (userBranchId) {
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push('BRANCH', userBranchId);
      } else {
        // If no branch ID, show no products
        whereConditions.push('1 = 0');
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Warehouse keepers can only see products from their warehouse
      const userWarehouseId = req.user.warehouse_id || req.user.warehouseId;
      if (userWarehouseId) {
        whereConditions.push('scope_type = ? AND scope_id = ?');
        params.push('WAREHOUSE', userWarehouseId);
      } else {
        // If no warehouse ID, show no products
        whereConditions.push('1 = 0');
      }
    }
    // Admin can see all products (no additional scope filtering)
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [products] = await pool.execute(`
      SELECT 
        id,
        name,
        sku,
        selling_price,
        cost_price,
        current_stock,
        category,
        scope_type,
        scope_id
      FROM inventory_items 
      ${whereClause}
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
      ...params,
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
        category: product.category,
        scopeType: product.scope_type,
        scopeId: product.scope_id
      }))
    });
    
  } catch (error) {
    console.error('[SalesController] Error searching products:', error);
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

      // Parse customer_info and enrich with salesperson name if missing
      let customerInfo = sale.customer_info ? JSON.parse(sale.customer_info) : null;
      
      // If customerInfo has salesperson with ID but no name, fetch the name from database
      if (customerInfo && customerInfo.salesperson && customerInfo.salesperson.id && !customerInfo.salesperson.name) {
        try {
          const [salespersonRows] = await pool.execute(
            'SELECT name, phone FROM salespeople WHERE id = ?',
            [customerInfo.salesperson.id]
          );
          if (salespersonRows.length > 0) {
            customerInfo.salesperson.name = salespersonRows[0].name || null;
            customerInfo.salesperson.phone = customerInfo.salesperson.phone || salespersonRows[0].phone || null;
          }
        } catch (error) {
          console.error('[SalesController] Error fetching salesperson name:', error);
        }
      }
      
      const saleData = {
        ...sale,
        customerInfo: customerInfo,
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

// @desc    Search outstanding payments by customer name or phone (FIXED VERSION)
// @route   GET /api/sales/outstanding
// @access  Private (Cashier)
// @desc    Search outstanding payments by customer name or phone (COMPLETELY FIXED)
// @route   GET /api/sales/outstanding
// @access  Private (Cashier)
const searchOutstandingPayments = async (req, res) => {
  try {
    const { customerName, phone } = req.query;
    
    console.log('🔍 OUTSTANDING PAYMENTS DEBUG - Request params:', { customerName, phone });
    console.log('🔍 OUTSTANDING PAYMENTS DEBUG - User:', req.user.role, req.user.branchId, req.user.warehouseId);

    if (!customerName && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Customer name or phone is required'
      });
    }

    // Get user's scope information
    let scopeType, scopeName;
    
    if (req.user.role === 'CASHIER' && req.user.branchId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
      if (branches.length > 0) {
        scopeType = 'BRANCH';
        scopeName = branches[0].name;
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && req.user.warehouseId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
      if (warehouses.length > 0) {
        scopeType = 'WAREHOUSE';
        scopeName = warehouses[0].name;
      }
    } else if (req.user.role === 'ADMIN') {
      scopeType = null;
      scopeName = null;
    }

    console.log('🔍 Scope info:', { scopeType, scopeName });

    // ✅ FIXED: SIMPLE AND RELIABLE QUERY - Get ONLY the latest transaction
    let query = `
      SELECT 
        s.customer_name,
        s.customer_phone,
        s.running_balance,
        s.invoice_no,
        s.created_at,
        s.payment_status,
        s.credit_amount,
        s.payment_amount,
        s.total,
        s.subtotal
      FROM sales s
      WHERE (s.customer_name = ? OR s.customer_phone = ?)
        AND ABS(s.running_balance) > 0.01
    `;
    
    let params = [customerName || phone, phone || customerName];

    // Add scope filtering for non-admin users
    if (req.user.role !== 'ADMIN' && scopeType && scopeName) {
      query += ' AND s.scope_type = ? AND s.scope_id = ?';
      params.push(scopeType, scopeName);
    }

    // ✅ CRITICAL: Order by latest and get only one record per customer
    query += ' ORDER BY s.created_at DESC, s.id DESC LIMIT 1';

    console.log('🔍 FINAL OUTSTANDING PAYMENTS QUERY:', query);
    console.log('🔍 FINAL OUTSTANDING PAYMENTS PARAMS:', params);

    const [results] = await pool.execute(query, params);

    console.log('🔍 OUTSTANDING PAYMENTS RESULTS:', results);

    if (results.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Format the single result
    const customer = results[0];
    const outstanding = parseFloat(customer.running_balance) || 0;
    
    const formattedResult = {
      customerName: customer.customer_name,
      phone: customer.customer_phone,
      totalOutstanding: Math.abs(outstanding), // Absolute value for display
      outstandingAmount: Math.abs(outstanding), // For frontend compatibility
      creditAmount: outstanding, // Actual balance (can be negative)
      finalAmount: outstanding, // Actual balance
      pendingSalesCount: 1,
      isCredit: outstanding < 0,
      latestInvoice: customer.invoice_no,
      lastTransactionDate: customer.created_at,
      paymentStatus: customer.payment_status,
      // Debug info
      _debug: {
        running_balance: customer.running_balance,
        credit_amount: customer.credit_amount,
        payment_amount: customer.payment_amount,
        total: customer.total,
        subtotal: customer.subtotal
      }
    };

    console.log('🔍 FORMATTED OUTSTANDING PAYMENT:', formattedResult);
    console.log('🔍 EXPECTED: -2050, ACTUAL:', outstanding);

    res.json({
      success: true,
      data: [formattedResult]
    });

  } catch (error) {
    console.error('❌ Error in searchOutstandingPayments:', error);
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
// @desc    Clear outstanding payment for customer
// @route   POST /api/sales/clear-outstanding
// @access  Private (Cashier)
const clearOutstandingPayment = async (req, res) => {
  try {
    const { customerName, phone, paymentAmount, paymentMethod, creditAmount = 0 } = req.body;

    if (!customerName || !phone || !paymentAmount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, payment amount, and payment method are required'
      });
    }

    // Get user's scope information based on role (outside transaction)
    let scopeType, scope;
    
    if (req.user.role === 'CASHIER' && req.user.branchId) {
      // For cashiers, get branch name from branch ID
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
      if (branches.length > 0) {
        scopeType = 'BRANCH';
        scope = branches[0].name;
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && req.user.warehouseId) {
      // For warehouse keepers, get warehouse name from warehouse ID
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
      if (warehouses.length > 0) {
        scopeType = 'WAREHOUSE';
        scope = warehouses[0].name;
      }
    } else if (req.user.role === 'ADMIN') {
      // Admin can see all transactions (no scope restrictions)
      scopeType = null;
      scope = null;
    }

    console.log('🔍 clearOutstandingPayment - scope:', scope, 'scopeType:', scopeType);

    // Validate scope information for non-admin users
    if (req.user.role !== 'ADMIN' && (!scope || !scopeType)) {
      console.error('❌ Missing scope information:', { scope, scopeType, role: req.user.role });
      return res.status(400).json({
        success: false,
        message: 'User scope information is missing'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Build query with conditional scope filtering
      let query = `
        SELECT id, invoice_no, credit_amount, running_balance, payment_amount, total, payment_status, scope_type, scope_id
        FROM sales 
        WHERE customer_name = ? AND customer_phone = ? 
          AND running_balance != 0
      `;
      
      const queryParams = [customerName, phone];
      
      // Add scope filtering for non-admin users
      if (req.user.role !== 'ADMIN' && scope && scopeType) {
        query += ' AND scope_type = ? AND scope_id = ?';
        queryParams.push(scopeType, scope);
      }
      
      query += ' ORDER BY created_at ASC';

      console.log('🔍 clearOutstandingPayment - Final query:', query);
      console.log('🔍 clearOutstandingPayment - Final params:', queryParams);

      const [outstandingSales] = await connection.execute(query, queryParams);

      if (outstandingSales.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No outstanding payments found for this customer'
        });
      }

      let normalizedPaymentAmount = parseFloat(paymentAmount);
      let normalizedCreditAmount = parseFloat(creditAmount);

      if (Number.isNaN(normalizedPaymentAmount) || normalizedPaymentAmount < 0) {
        normalizedPaymentAmount = 0;
      }

      if (Number.isNaN(normalizedCreditAmount)) {
        normalizedCreditAmount = 0;
      }

      // Calculate total outstanding amount before processing
      const totalOutstandingBefore = outstandingSales.reduce((sum, sale) => sum + parseFloat(sale.running_balance), 0);
      console.log('💰 Total outstanding before:', totalOutstandingBefore);

      const targetOutstanding = normalizedCreditAmount;
      let totalAdjustment = totalOutstandingBefore - targetOutstanding;

      if (!Number.isFinite(totalAdjustment)) {
        totalAdjustment = 0;
      }

      if (totalAdjustment < 0) {
        totalAdjustment = 0;
      }

      const cashToApply = Math.min(totalAdjustment, normalizedPaymentAmount);
      let paymentRemaining = cashToApply;
      let creditAdjustmentRemaining = totalAdjustment - cashToApply;
      if (creditAdjustmentRemaining < 0) {
        creditAdjustmentRemaining = 0;
      }

      let processedSales = [];

      // Process each outstanding sale
      for (const sale of outstandingSales) {
        const currentRunningBalance = parseFloat(sale.running_balance);

        if (currentRunningBalance < 0 && paymentRemaining > 0) {
          // Negative running balance (customer has advance credit) - reduce credit
          const creditToUse = Math.min(paymentRemaining, Math.abs(currentRunningBalance));

          const newRunningBalance = currentRunningBalance + creditToUse;
          const newCreditAmount = parseFloat(sale.credit_amount) + creditToUse;

          await connection.execute(
            `UPDATE sales 
             SET credit_amount = ?, 
                 running_balance = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [newCreditAmount, newRunningBalance, sale.id]
          );

          processedSales.push({
            saleId: sale.id,
            invoiceNo: sale.invoice_no,
            creditUsed: creditToUse,
            remainingRunningBalance: newRunningBalance,
            newStatus: sale.payment_status,
            isCredit: true
          });

          paymentRemaining -= creditToUse;
        }

        if (currentRunningBalance > 0) {
          if (paymentRemaining > 0) {
            const paymentToApply = Math.min(paymentRemaining, currentRunningBalance);

            const newPaymentAmount = parseFloat(sale.payment_amount) + paymentToApply;
            const newCreditAmount = parseFloat(sale.credit_amount) - paymentToApply;
            const newRunningBalance = currentRunningBalance - paymentToApply;
            const newPaymentStatus = newRunningBalance <= 0 ? 'COMPLETED' : 'PARTIAL';

            await connection.execute(
              `UPDATE sales 
               SET payment_amount = ?, 
                   credit_amount = ?, 
                   running_balance = ?,
                   payment_status = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [newPaymentAmount, newCreditAmount, newRunningBalance, newPaymentStatus, sale.id]
            );

            processedSales.push({
              saleId: sale.id,
              invoiceNo: sale.invoice_no,
              paymentApplied: paymentToApply,
              remainingRunningBalance: newRunningBalance,
              newStatus: newPaymentStatus
            });

            paymentRemaining -= paymentToApply;
          }

          if (creditAdjustmentRemaining > 0) {
            const creditToApply = Math.min(creditAdjustmentRemaining, currentRunningBalance);

            const newCreditAmount = parseFloat(sale.credit_amount) - creditToApply;
            const newRunningBalance = currentRunningBalance - creditToApply;
            const newPaymentStatus = newRunningBalance <= 0 ? 'COMPLETED' : 'PARTIAL';

            await connection.execute(
              `UPDATE sales 
               SET credit_amount = ?, 
                   running_balance = ?,
                   payment_status = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [newCreditAmount, newRunningBalance, newPaymentStatus, sale.id]
            );

            processedSales.push({
              saleId: sale.id,
              invoiceNo: sale.invoice_no,
              creditNoteApplied: creditToApply,
              remainingRunningBalance: newRunningBalance,
              newStatus: newPaymentStatus
            });

            creditAdjustmentRemaining -= creditToApply;
          }
        }
      }

      const totalPaymentApplied = cashToApply;
      const finalCreditAmount = normalizedCreditAmount;
      const totalSettlementAdjustment = totalOutstandingBefore - finalCreditAmount;
      let settlementAmountRecorded = totalSettlementAdjustment;

      // ✅ Determine the latest running balance after applying payments above
      let latestRunningBalance = 0;
      try {
        let latestBalanceQuery = `
          SELECT running_balance
          FROM sales
          WHERE customer_name = ? AND customer_phone = ?
        `;
        const latestBalanceParams = [customerName, phone];

        if (req.user.role !== 'ADMIN' && scope && scopeType) {
          latestBalanceQuery += ' AND scope_type = ? AND scope_id = ?';
          latestBalanceParams.push(scopeType, scope);
        }

        latestBalanceQuery += ' ORDER BY created_at DESC, id DESC LIMIT 1';

        const [latestBalanceRows] = await connection.execute(latestBalanceQuery, latestBalanceParams);
        if (latestBalanceRows.length > 0) {
          latestRunningBalance = parseFloat(latestBalanceRows[0].running_balance) || 0;
        }
      } catch (balanceError) {
        console.error('❌ clearOutstandingPayment - Error fetching latest running balance:', balanceError);
      }

      // ✅ NEW: Create a settlement transaction in sales table for ledger tracking
      
      if (totalSettlementAdjustment > 0) {
        console.log('💰 Creating settlement transaction:', {
          customerName,
          phone,
          totalSettlementAdjustment,
          finalCreditAmount,
          scopeType,
          scope
        });

        // Generate invoice number for settlement
        let settlementInvoiceNo;
        try {
          const numericScopeId = typeof scope === 'string' ? (scope.match(/^\d+$/) ? parseInt(scope) : scope) : scope;
          settlementInvoiceNo = await InvoiceNumberService.generateInvoiceNumber(scopeType, numericScopeId);
        } catch (invoiceError) {
          console.error('Error generating settlement invoice number:', invoiceError);
          settlementInvoiceNo = `SETTLE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }

        // Calculate new running balance after settlement
        const settlementAmount = totalSettlementAdjustment;
        settlementAmountRecorded = settlementAmount;
        const newRunningBalance = finalCreditAmount !== 0 ? finalCreditAmount : latestRunningBalance;

        // Create settlement sale record
        const settlementData = {
          invoiceNo: settlementInvoiceNo,
          scopeType: scopeType,
          scopeId: scope,
          userId: req.user.id,
          subtotal: 0, // No items in settlement
          tax: 0,
          discount: 0,
          total: settlementAmount, // Total adjustment amount (cash + credit note)
          paymentMethod: paymentMethod,
          paymentType: 'OUTSTANDING_SETTLEMENT',
          paymentStatus: finalCreditAmount > 0 ? 'PARTIAL' : 'COMPLETED',
          customerInfo: JSON.stringify({
            name: customerName,
            phone: phone
          }),
          customerName: customerName,
          customerPhone: phone,
          paymentAmount: totalPaymentApplied,
          creditAmount: finalCreditAmount,
          runningBalance: newRunningBalance,
          creditStatus: finalCreditAmount > 0 ? 'PENDING' : 'NONE',
          notes: `Outstanding settlement adjustment ${settlementAmount.toFixed(2)} (cash: ${totalPaymentApplied.toFixed(2)}, balance: ${finalCreditAmount.toFixed(2)})`,
          status: 'COMPLETED',
          items: [] // No items for settlement
        };

        console.log('💰 Settlement data:', settlementData);

        // Insert settlement record
        const [settlementResult] = await connection.execute(`
          INSERT INTO sales (
            invoice_no, scope_type, scope_id, user_id, subtotal, tax, discount, total,
            payment_method, payment_type, payment_status, customer_info, customer_name, 
            customer_phone, payment_amount, credit_amount, running_balance, credit_status,
            notes, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
          settlementData.invoiceNo,
          settlementData.scopeType,
          settlementData.scopeId,
          settlementData.userId,
          settlementData.subtotal,
          settlementData.tax,
          settlementData.discount,
          settlementData.total,
          settlementData.paymentMethod,
          settlementData.paymentType,
          settlementData.paymentStatus,
          settlementData.customerInfo,
          settlementData.customerName,
          settlementData.customerPhone,
          settlementData.paymentAmount,
          settlementData.creditAmount,
          settlementData.runningBalance,
          settlementData.creditStatus,
          settlementData.notes,
          settlementData.status
        ]);

        const settlementId = settlementResult.insertId;

        // ✅ Record settlement in ledger
        try {
          console.log('💰 Recording settlement in ledger...');
          const ledgerResult = await LedgerService.recordSaleTransaction({
            saleId: settlementId,
            invoiceNo: settlementInvoiceNo,
            scopeType: scopeType,
            scopeId: scope,
            totalAmount: settlementAmount,
            paymentAmount: totalPaymentApplied,
            creditAmount: finalCreditAmount,
            paymentMethod: paymentMethod,
            customerInfo: { name: customerName, phone: phone },
            userId: req.user.id,
            items: [],
            isSettlement: true
          });
          console.log('💰 Settlement recorded in ledger:', ledgerResult);
        } catch (ledgerError) {
          console.error('💰 CRITICAL ERROR recording settlement in ledger:', ledgerError);
          // Don't fail the settlement if ledger recording fails
        }

        // ✅ Create financial voucher for the settlement
        try {
          const voucherNo = `VCH-SETTLE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          const voucherData = {
            voucherNo: voucherNo,
            type: 'INCOME',
            category: 'SETTLEMENT',
            paymentMethod: paymentMethod.toUpperCase(),
            amount: totalPaymentApplied,
            description: `Outstanding payment settlement for ${customerName} (${phone})`,
            reference: settlementInvoiceNo,
            scopeType: scopeType,
            scopeId: scope,
            userId: req.user.id,
            userName: req.user.name,
            userRole: req.user.role,
            status: 'APPROVED',
            approvedBy: req.user.id,
            approvalNotes: null,
            rejectionReason: null
          };

          await FinancialVoucher.create(voucherData);
        } catch (voucherError) {
          console.error('Error creating financial voucher for settlement:', voucherError);
          // Don't fail the settlement if voucher creation fails
        }

        console.log('✅ Settlement transaction created with ID:', settlementId);
      }

      await connection.commit();

      // Get updated outstanding amount within the user's scope
      let remainingQuery = `
        SELECT SUM(running_balance) as remaining_outstanding
        FROM sales 
        WHERE customer_name = ? AND customer_phone = ? 
          AND running_balance != 0
      `;
      
      const remainingParams = [customerName, phone];
      
      // Add scope filtering for non-admin users
      if (req.user.role !== 'ADMIN' && scope && scopeType) {
        remainingQuery += ' AND scope_type = ? AND scope_id = ?';
        remainingParams.push(scopeType, scope);
      }

      console.log('🔍 clearOutstandingPayment - Remaining query:', remainingQuery);
      console.log('🔍 clearOutstandingPayment - Remaining params:', remainingParams);

      const [outstanding] = await connection.execute(remainingQuery, remainingParams);

      const remainingOutstanding = parseFloat(outstanding[0].remaining_outstanding) || 0;

      res.json({
        success: true,
        message: 'Payment processed successfully',
        data: {
          customerName,
          phone,
          paymentAmount: totalPaymentApplied,
          paymentMethod,
          remainingOutstanding,
          isFullyCleared: Math.abs(remainingOutstanding) <= 0.01, // Allow small rounding differences
          processedSales,
          unprocessedAmount: 0,
          settlementCreated: totalPaymentApplied > 0,
          settlementAmount: settlementAmountRecorded,
          settlementCredit: finalCreditAmount
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
  getSalesReturn,
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