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
// Returns the latest running_balance from the most recent transaction (sale or return)
const getCustomerRunningBalance = async (customerName, customerPhone, scopeType, scopeName) => {
  try {
    // Use case-insensitive matching like the ledger query
    const [latestSale] = await pool.execute(`
      SELECT running_balance, invoice_no, payment_method, payment_type, created_at
      FROM sales 
      WHERE (LOWER(TRIM(customer_name)) = LOWER(TRIM(?)) OR customer_phone = ? OR LOWER(TRIM(JSON_EXTRACT(customer_info, "$.name"))) = LOWER(TRIM(?)) OR JSON_EXTRACT(customer_info, "$.phone") = ?)
        AND scope_type = ? 
        AND scope_id = ?
      ORDER BY created_at DESC, id DESC 
      LIMIT 1
    `, [customerName || '', customerPhone || '', customerName || '', customerPhone || '', scopeType, scopeName]);
    
    if (latestSale.length > 0) {
      const balance = parseFloat(latestSale[0].running_balance) || 0;
      console.log('💰 getCustomerRunningBalance - Latest balance found:', {
        customerName,
        customerPhone,
        scopeType,
        scopeName,
        runningBalance: balance,
        invoiceNo: latestSale[0].invoice_no,
        paymentMethod: latestSale[0].payment_method,
        paymentType: latestSale[0].payment_type,
        createdAt: latestSale[0].created_at
      });
      return balance;
    }
    
    console.log('💰 getCustomerRunningBalance - No previous transactions found, returning 0');
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

    const { items, scopeType, scopeId, paymentMethod, paymentType, customerInfo, notes, subtotal, tax, discount, total, paymentStatus, status, paymentAmount, creditAmount, creditStatus, outstandingPayments, selectedOutstandingPayments } = req.body;

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
    
    // ✅ FIXED: Check if outstanding payments are included in the sale and clear them FIRST
    // Calculate outstanding amount: finalTotal includes outstanding, billAmount is just the sale
    const outstandingAmount = finalTotal - billAmount;
    let settlementCreated = false;
    let settlementAmount = 0;
    
    if (outstandingAmount > 0.01 && customerName && customerPhone && paymentMethod !== 'FULLY_CREDIT') {
        console.log('[SalesController] Outstanding payment detected in sale, creating settlement FIRST:', {
            outstandingAmount,
            customerName,
            customerPhone,
            billAmount,
            finalTotal
        });
        
        try {
            // Get customer's latest running balance BEFORE settlement
            const balanceBeforeSettlement = await getCustomerRunningBalance(
                customerName,
                customerPhone,
                scopeType,
                scopeName
            );
            
            // The outstanding amount should be cleared
            settlementAmount = Math.min(outstandingAmount, balanceBeforeSettlement);
            
            if (settlementAmount > 0.01) {
                const settlementOldBalance = balanceBeforeSettlement;
                const settlementNewRunningBalance = settlementOldBalance - settlementAmount;
                const settlementPaymentStatus = Math.abs(settlementNewRunningBalance) <= 0.01 ? 'COMPLETED' : 'PARTIAL';
                
                // Generate settlement invoice number
                let settlementInvoiceNo;
                try {
                    const numericScopeId = typeof scopeName === 'string' ? (scopeName.match(/^\d+$/) ? parseInt(scopeName) : scopeName) : scopeName;
                    settlementInvoiceNo = await InvoiceNumberService.generateInvoiceNumber(scopeType, numericScopeId);
                } catch (invoiceError) {
                    console.error('Error generating settlement invoice number:', invoiceError);
                    settlementInvoiceNo = `SETTLE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                }
                
                // Create settlement record BEFORE the sale
                const [settlementResult] = await pool.execute(`
                    INSERT INTO sales (
                        invoice_no, scope_type, scope_id, user_id, subtotal, tax, discount, total,
                        payment_method, payment_type, payment_status, customer_info, customer_name, 
                        customer_phone, payment_amount, credit_amount, old_balance, running_balance, credit_status,
                        notes, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                `, [
                    settlementInvoiceNo,
                    scopeType,
                    scopeName,
                    req.user.id,
                    0, // subtotal
                    0, // tax
                    0, // discount
                    settlementAmount, // total = payment amount
                    paymentMethod, // Use same payment method as sale
                    'OUTSTANDING_SETTLEMENT',
                    settlementPaymentStatus,
                    JSON.stringify({ name: customerName, phone: customerPhone }),
                    customerName,
                    customerPhone,
                    settlementAmount, // payment_amount
                    0, // credit_amount
                    settlementOldBalance, // old_balance
                    settlementNewRunningBalance, // running_balance
                    'NONE', // credit_status
                    `Outstanding payment settlement (will be followed by sale): Customer paid ${settlementAmount.toFixed(2)}`,
                    'COMPLETED',
                ]);
                
                settlementCreated = true;
                console.log('[SalesController] ✅ Settlement created BEFORE sale:', {
                    settlementId: settlementResult.insertId,
                    invoiceNo: settlementInvoiceNo,
                    amount: settlementAmount,
                    oldBalance: settlementOldBalance,
                    newRunningBalance: settlementNewRunningBalance
                });
            }
        } catch (settlementError) {
            console.error('[SalesController] ❌ Error creating automatic settlement:', settlementError);
            // Don't fail the sale if settlement creation fails, but log it
        }
    }
    
    // Get customer's current running balance from previous transactions
    // This will be used as old_balance for the new sale
    // If settlement was created, this will include the settlement's running_balance
    const previousRunningBalance = await getCustomerRunningBalance(customerName, customerPhone, scopeType, scopeName);
    const oldBalance = previousRunningBalance; // old_balance = previous row's running_balance
    console.log('💰 Customer previous running balance (old_balance):', oldBalance, settlementCreated ? '(after settlement)' : '');

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

    // ✅ FIX: When customer has negative balance (credit) and makes a purchase,
    // we need to use the credit to reduce the bill amount
    // Example: Customer has -200 credit, buys 700, pays 500
    // Credit used: 200, Net bill: 500, Payment: 500, New credit: 0, New balance: 0
    
    let creditUsedFromPreviousBalance = 0;
    let adjustedBillAmount = billAmount;
    
    // If customer has credit (negative balance), use it to reduce the bill
    if (previousRunningBalance < 0) {
        const availableCredit = Math.abs(previousRunningBalance);
        creditUsedFromPreviousBalance = Math.min(availableCredit, billAmount);
        adjustedBillAmount = billAmount - creditUsedFromPreviousBalance;
        
        console.log('💰 Using customer credit from previous balance:', {
            previousBalance: previousRunningBalance,
            availableCredit,
            billAmount,
            creditUsed: creditUsedFromPreviousBalance,
            adjustedBillAmount,
            paymentAmount: finalPaymentAmount
        });
    }
    
    // Calculate running balance for this transaction
    // running_balance = previous_balance + (bill_amount - payment_amount)
    // This means: balance increases by unpaid amount (credit given)
    // OR: balance decreases by payment amount (debt paid)
    // BUT: If we used credit, we need to account for that
    const newCreditAmount = adjustedBillAmount - finalPaymentAmount;
    const runningBalance = previousRunningBalance + creditUsedFromPreviousBalance + newCreditAmount;

    console.log('💰 FINAL Payment calculation:', {
        scenario: getPaymentScenario(finalPaymentAmount, finalCreditAmount, billAmount),
        oldBalance, // Previous row's running_balance
        previousRunningBalance,
        billAmount,
        adjustedBillAmount,
        creditUsedFromPreviousBalance,
        finalPaymentAmount,
        finalCreditAmount,
        newCreditAmount,
        runningBalance, // New running_balance = old_balance + amount - payment
        calculation: `${oldBalance} (old_balance) + ${billAmount} (amount) - ${finalPaymentAmount} (payment) = ${runningBalance}`
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
        oldBalance: oldBalance || 0, // ✅ Save old_balance (previous row's running_balance)
        runningBalance: runningBalance || 0, // ✅ Save running_balance (old_balance + amount - payment)
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

    // ✅ FIX: Clear/reduce old credit balance in previous sales when credit is used
    if (creditUsedFromPreviousBalance > 0 && (customerName || customerPhone)) {
        try {
            console.log('💰 Clearing old credit balance from previous sales:', {
                creditUsed: creditUsedFromPreviousBalance,
                customerName,
                customerPhone,
                scopeType,
                scopeName
            });
            
            // Get connection for transaction
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                
                // Find sales with negative running balance (credit) for this customer
                let query = `
                    SELECT id, invoice_no, credit_amount, running_balance, payment_status, scope_type, scope_id
                    FROM sales 
                    WHERE (customer_name = ? OR customer_phone = ?)
                      AND running_balance < 0
                `;
                
                const queryParams = [customerName, customerPhone];
                
                // Add scope filtering for non-admin users
                if (req.user.role !== 'ADMIN' && scopeName && scopeType) {
                    query += ' AND scope_type = ? AND (scope_id = ? OR scope_id = CAST(? AS CHAR))';
                    queryParams.push(scopeType, scopeName, scopeName);
                }
                
                query += ' ORDER BY created_at ASC';
                
                const [creditSales] = await connection.execute(query, queryParams);
                
                let remainingCreditToClear = creditUsedFromPreviousBalance;
                const processedSales = [];
                
                // Process each credit sale to clear the credit
                for (const creditSale of creditSales) {
                    if (remainingCreditToClear <= 0) break;
                    
                    const currentCredit = Math.abs(parseFloat(creditSale.running_balance));
                    const creditToClear = Math.min(remainingCreditToClear, currentCredit);
                    
                    // Update the sale's running balance and credit amount
                    const newRunningBalance = parseFloat(creditSale.running_balance) + creditToClear;
                    const newCreditAmount = parseFloat(creditSale.credit_amount) + creditToClear;
                    const newPaymentStatus = newRunningBalance >= 0 ? 'COMPLETED' : creditSale.payment_status;
                    
                    await connection.execute(
                        `UPDATE sales 
                         SET credit_amount = ?, 
                             running_balance = ?,
                             payment_status = ?,
                             updated_at = NOW()
                         WHERE id = ?`,
                        [newCreditAmount, newRunningBalance, newPaymentStatus, creditSale.id]
                    );
                    
                    processedSales.push({
                        saleId: creditSale.id,
                        invoiceNo: creditSale.invoice_no,
                        creditCleared: creditToClear,
                        remainingRunningBalance: newRunningBalance,
                        newStatus: newPaymentStatus
                    });
                    
                    remainingCreditToClear -= creditToClear;
                    
                    console.log('💰 Cleared credit from sale:', {
                        invoiceNo: creditSale.invoice_no,
                        creditCleared: creditToClear,
                        oldBalance: creditSale.running_balance,
                        newBalance: newRunningBalance
                    });
                }
                
                await connection.commit();
                
                console.log('💰 Successfully cleared credit from previous sales:', {
                    totalCreditCleared: creditUsedFromPreviousBalance - remainingCreditToClear,
                    processedSales: processedSales.length,
                    details: processedSales
                });
            } catch (clearError) {
                await connection.rollback();
                console.error('❌ Error clearing credit from previous sales:', clearError);
                // Don't fail the sale if credit clearing fails, but log it
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error in credit clearing process:', error);
            // Don't fail the sale if credit clearing fails
        }
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
    const {
      scopeType,
      scopeId,
      startDate,
      endDate,
      paymentMethod,
      status,
      retailerId,
      customerPhone,
      customerName,
      creditStatus,
      paymentStatus,
      scopeSearch,
      page = 1,
      limit = 50
    } = req.query;

    // Basic pagination guardrails
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;
    let whereConditions = [];
    let params = [];

    // Apply role-based filtering
    if (req.user.role === 'CASHIER') {
      // Cashiers can always view sales (read-only access)
      // Get branch name and ID if not already available
      let userBranchName = req.user.branchName;
      let userBranchId = req.user.branchId;
      
      if (!userBranchName && userBranchId) {
        const [branches] = await pool.execute('SELECT id, name FROM branches WHERE id = ?', [userBranchId]);
        if (branches.length > 0) {
          userBranchName = branches[0].name;
          userBranchId = branches[0].id;
        }
      }
      
      if (userBranchName && userBranchId) {
        // Handle both string (branch name) and number (branch ID) comparisons for scope_id
        // Sales table might have scope_id as either branch name (string) or branch ID (number)
        whereConditions.push(`(
          s.scope_type = 'BRANCH' AND (
            CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin OR 
            CAST(s.scope_id AS UNSIGNED) = ? OR
            CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          )
        )`);
        params.push(userBranchName, userBranchId, String(userBranchId));
        
        console.log('[SalesController] CASHIER scope filter:', {
          userBranchName,
          userBranchId,
          whereCondition: whereConditions[whereConditions.length - 1],
          params: params.slice(-3)
        });
      } else if (userBranchName) {
        // Fallback: only branch name available
        whereConditions.push(`(
          s.scope_type = 'BRANCH' AND (
            CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
          )
        )`);
        params.push(userBranchName);
        
        console.log('[SalesController] CASHIER scope filter (name only):', {
          userBranchName,
          whereCondition: whereConditions[whereConditions.length - 1]
        });
      } else {
        whereConditions.push('s.scope_type = ?');
        params.push('BRANCH');
        
        console.log('[SalesController] CASHIER scope filter (no branch info):', {
          whereCondition: whereConditions[whereConditions.length - 1]
        });
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER') {
      // Filter by warehouse - get warehouse name if not already available
      let userWarehouseName = req.user.warehouseName;
      let userWarehouseId = req.user.warehouseId;
      
      if (!userWarehouseName && userWarehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
        if (warehouses.length > 0) {
          userWarehouseName = warehouses[0].name;
        }
      }
      
      if (userWarehouseName) {
        // Filter by warehouse name and ID (handle both string and number comparisons)
        whereConditions.push(`(
          s.scope_type = 'WAREHOUSE' AND (
            CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
            OR s.scope_id = ?
            OR s.scope_id = ?
          )
        )`);
        params.push(userWarehouseName, String(userWarehouseId || ''), userWarehouseId);
        
        console.log('[SalesController] WAREHOUSE_KEEPER scope filter:', {
          userWarehouseName,
          userWarehouseId,
          whereCondition: whereConditions[whereConditions.length - 1]
        });
      } else if (userWarehouseId) {
        // Fallback: only warehouse ID available
        whereConditions.push(`(
          s.scope_type = 'WAREHOUSE' AND (
            s.scope_id = ?
            OR s.scope_id = ?
          )
        )`);
        params.push(String(userWarehouseId), userWarehouseId);
        
        console.log('[SalesController] WAREHOUSE_KEEPER scope filter (ID only):', {
          userWarehouseId,
          whereCondition: whereConditions[whereConditions.length - 1]
        });
      } else {
        // No warehouse info available, only filter by type
        whereConditions.push('s.scope_type = ?');
        params.push('WAREHOUSE');
        
        console.log('[SalesController] WAREHOUSE_KEEPER scope filter (no warehouse info):', {
          whereCondition: whereConditions[whereConditions.length - 1]
        });
      }
    } else if (req.user.role === 'ADMIN') {
      // Admin can filter by scopeType and/or scopeId
      if (scopeType && scopeType !== 'all') {
        whereConditions.push('s.scope_type = ?');
        params.push(scopeType);
        
        // If scopeId is also provided, handle both name (string) and ID (number) matching
        if (scopeId && scopeId !== 'all') {
          // Check if scopeId is numeric (branch/warehouse ID) or string (name)
          const isNumeric = /^\d+$/.test(String(scopeId));
          
          if (scopeType === 'BRANCH' && isNumeric) {
            // If scopeId is numeric, get branch name to match against sales.scope_id
            const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [parseInt(scopeId)]);
            if (branches.length > 0) {
              whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
              params.push(branches[0].name, String(scopeId));
            } else {
              // Branch not found, match by ID as string
              whereConditions.push('s.scope_id = ?');
              params.push(String(scopeId));
            }
          } else if (scopeType === 'WAREHOUSE' && isNumeric) {
            // If scopeId is numeric, get warehouse name to match against sales.scope_id
            const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [parseInt(scopeId)]);
            if (warehouses.length > 0) {
              whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
              params.push(warehouses[0].name, String(scopeId));
            } else {
              // Warehouse not found, match by ID as string
              whereConditions.push('s.scope_id = ?');
              params.push(String(scopeId));
            }
          } else {
            // scopeId is a string (name), match directly
            whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
            params.push(scopeId, String(scopeId));
          }
        }
      } else if (scopeId && scopeId !== 'all') {
        // If only scopeId is provided without scopeType, try to match by both BRANCH and WAREHOUSE
        const isNumeric = /^\d+$/.test(String(scopeId));
        
        if (isNumeric) {
          // Try to find branch or warehouse with this ID
          const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [parseInt(scopeId)]);
          const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [parseInt(scopeId)]);
          
          if (branches.length > 0) {
            whereConditions.push('(s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?))');
            params.push('BRANCH', branches[0].name, String(scopeId));
          }
          if (warehouses.length > 0) {
            if (branches.length > 0) {
              // Add OR condition for warehouse
              whereConditions[whereConditions.length - 1] = whereConditions[whereConditions.length - 1].replace(')', '') + ' OR (s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)))';
              params.push('WAREHOUSE', warehouses[0].name, String(scopeId));
            } else {
              whereConditions.push('(s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?))');
              params.push('WAREHOUSE', warehouses[0].name, String(scopeId));
            }
          }
        } else {
          // scopeId is a string, match by name for both BRANCH and WAREHOUSE
          whereConditions.push('((s.scope_type = ? AND s.scope_id = ?) OR (s.scope_type = ? AND s.scope_id = ?))');
          params.push('BRANCH', scopeId, 'WAREHOUSE', scopeId);
        }
      }
      // If neither scopeType nor scopeId is provided, show all sales (no scope filtering)
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

    // Admin scope search by branch/warehouse name or id
    if (scopeSearch && req.user.role === 'ADMIN') {
      const term = `%${scopeSearch}%`;
      whereConditions.push(`
        (
          s.scope_id LIKE ?
          OR (
            s.scope_type = 'BRANCH' AND EXISTS (
              SELECT 1 FROM branches b
              WHERE b.id = s.scope_id OR b.name LIKE ?
            )
          )
          OR (
            s.scope_type = 'WAREHOUSE' AND EXISTS (
              SELECT 1 FROM warehouses w
              WHERE w.id = s.scope_id OR w.name LIKE ?
            )
          )
        )
      `);
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    console.log('[SalesController] getSales - Query params:', {
      role: req.user.role,
      scopeType,
      scopeId,
      scopeSearch,
      whereClause,
      params,
      whereConditions,
      page: parsedPage,
      limit: parsedLimit
    });

    // Total count for pagination
    const [countRows] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM sales s
      ${whereClause}
    `, params);
    const totalCount = countRows?.[0]?.total || 0;

    // Summary aggregates across all matching rows (not limited by pagination)
    const [summaryRows] = await pool.execute(`
      SELECT 
        COUNT(*) as totalTransactions,
        COALESCE(SUM(s.total), 0) as totalSales,
        SUM(CASE WHEN s.payment_status = 'COMPLETED' THEN 1 ELSE 0 END) as completedSales,
        COALESCE(SUM(CASE WHEN s.payment_status = 'COMPLETED' THEN s.total ELSE 0 END), 0) as completedSalesAmount
      FROM sales s
      ${whereClause}
    `, params);

    const summaryRow = summaryRows?.[0] || {};
    const summary = {
      totalSales: Math.abs(Number(summaryRow.totalSales || 0)),
      totalTransactions: Number(summaryRow.totalTransactions || 0),
      completedSales: Number(summaryRow.completedSales || 0),
      averageOrderValue: summaryRow.completedSales
        ? Math.abs(Number(summaryRow.completedSalesAmount || 0)) / Number(summaryRow.completedSales || 1)
        : 0
    };

    const [sales] = await pool.execute(`
      SELECT 
        s.*,
        u.username,
        u.email,
        b.name as branch_name,
        w.name as warehouse_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON (
        s.scope_type = 'BRANCH' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(b.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = b.id OR
          CAST(b.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      LEFT JOIN warehouses w ON (
        s.scope_type = 'WAREHOUSE' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(w.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = w.id OR
          CAST(w.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parsedLimit, offset]);

    console.log('[SalesController] getSales - Found', sales.length, 'sales');
    if (sales.length > 0) {
      console.log('[SalesController] Sample sales:', sales.slice(0, 3).map(s => ({
        id: s.id,
        invoice_no: s.invoice_no,
        scope_type: s.scope_type,
        scope_id: s.scope_id,
        created_at: s.created_at
      })));
    }

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
      count: totalCount,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.max(1, Math.ceil(totalCount / parsedLimit)),
      summary,
      data: salesWithItems
    });
  } catch (error) {
    console.error('[SalesController] getSales - Error:', {
      message: error.message,
      stack: error.stack,
      sqlMessage: error.sqlMessage,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      whereClause,
      params,
      whereConditions,
      page,
      limit
    });
    res.status(500).json({
      success: false,
      message: 'Error retrieving sales',
      error: error.message,
      sqlError: error.sqlMessage || null
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

// @desc    Update sale with inventory changes (FIXED VERSION)
// @route   PUT /api/sales/:id
// @access  Private (Admin, Cashier)
// @desc    Update sale with inventory changes (FIXED RUNNING BALANCE VERSION)
// @route   PUT /api/sales/:id
// @access  Private (Admin, Cashier)
const updateSale = async (req, res, next) => {
  let connection;
  
  try {
    console.log('[SalesController] Starting updateSale for sale ID:', req.params.id);
    console.log('[SalesController] Request body:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;
    const { 
      items, 
      inventoryChanges, 
      paymentMethod, 
      paymentAmount, 
      creditAmount, 
      total, 
      subtotal, 
      tax, 
      discount,
      notes, 
      status, 
      paymentStatus,
      customerInfo,
      customerName,
      customerPhone
    } = updateData;

    // Get connection
    connection = await pool.getConnection();
    
    // Get sale with all details
    const [saleRows] = await connection.execute(`
      SELECT s.*, 
        s.customer_name, 
        s.customer_phone, 
        s.scope_type, 
        s.scope_id,
        s.payment_method,
        s.payment_amount,
        s.credit_amount,
        s.old_balance,
        s.running_balance,
        s.total as sale_total,
        s.subtotal as sale_subtotal,
        s.tax as sale_tax,
        s.discount as sale_discount
      FROM sales s WHERE id = ?`, 
      [id]
    );
    
    if (saleRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    const sale = saleRows[0];
    
    console.log('[SalesController] DEBUG - Original sale before update:', {
      id: sale.id,
      invoice_no: sale.invoice_no,
      old_balance: sale.old_balance,
      running_balance: sale.running_balance,
      total: sale.sale_total,
      subtotal: sale.sale_subtotal,
      credit_amount: sale.credit_amount,
      payment_amount: sale.payment_amount,
      payment_method: sale.payment_method
    });

    // Start transaction
    await connection.beginTransaction();

    try {
      // 1. Handle inventory changes if provided
      if (inventoryChanges && inventoryChanges.modified && inventoryChanges.modified.length > 0) {
        console.log('[SalesController] Processing inventory changes:', inventoryChanges.modified.length, 'items');
        
        for (const change of inventoryChanges.modified) {
          if (!change.inventoryItemId) continue;
          
          console.log(`[SalesController] Updating inventory for item ${change.inventoryItemId}:`, change.quantityChange);
          
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?',
            [change.quantityChange, change.inventoryItemId]
          );
        }
      }

      // 2. Update sale items if provided
      let finalSubtotal = parseFloat(subtotal) || parseFloat(sale.sale_subtotal) || 0;
      let finalTotal = parseFloat(total) || parseFloat(sale.sale_total) || 0;
      
      if (items && Array.isArray(items) && items.length > 0) {
        console.log('[SalesController] Updating sale items:', items.length, 'items');
        
        // Delete existing items
        await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);
        
        // Calculate new subtotal from items
        finalSubtotal = 0;
        for (const item of items) {
          const itemQuantity = parseFloat(item.quantity) || 0;
          const itemUnitPrice = parseFloat(item.unitPrice) || parseFloat(item.unit_price) || 0;
          const itemDiscount = parseFloat(item.discount) || 0;
          const itemTotal = (itemQuantity * itemUnitPrice) - itemDiscount;
          
          await connection.execute(`
            INSERT INTO sale_items (
              sale_id, inventory_item_id, sku, name, quantity, 
              unit_price, discount, discount_type, total, original_price, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          `, [
            id,
            item.inventoryItemId || item.inventory_item_id,
            item.sku,
            item.name || item.itemName,
            itemQuantity,
            itemUnitPrice,
            itemDiscount,
            item.discountType || 'amount',
            itemTotal,
            item.originalPrice || itemUnitPrice
          ]);
          
          finalSubtotal += itemTotal;
        }
        
        // Calculate final total (tax and discount are 0 in your case)
        finalTotal = finalSubtotal + (parseFloat(tax) || 0) - (parseFloat(discount) || 0);
        
        console.log('[SalesController] Recalculated from items:', {
          finalSubtotal,
          finalTotal,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0
        });
      }

      // 3. Calculate payment amounts
      let finalPaymentAmount = parseFloat(paymentAmount);
      let finalCreditAmount = parseFloat(creditAmount);
      
      if (isNaN(finalPaymentAmount)) {
        finalPaymentAmount = parseFloat(sale.payment_amount) || 0;
      }
      
      if (isNaN(finalCreditAmount)) {
        finalCreditAmount = parseFloat(sale.credit_amount) || 0;
      }
      
      // If payment method is FULLY_CREDIT, adjust amounts
      const finalPaymentMethod = paymentMethod || sale.payment_method;
      if (finalPaymentMethod === 'FULLY_CREDIT') {
        finalPaymentAmount = 0;
        finalCreditAmount = finalTotal;
      }
      
      console.log('[SalesController] Payment amounts:', {
        finalPaymentMethod,
        finalPaymentAmount,
        finalCreditAmount,
        finalTotal
      });

      // ✅ CRITICAL FIX: Calculate running balance PROPERLY
      // running_balance = old_balance + credit_amount - payment_amount
      const oldBalance = parseFloat(sale.old_balance) || 0;
      const runningBalance = oldBalance + finalCreditAmount - finalPaymentAmount;
      
      console.log('[SalesController] RUNNING BALANCE CALCULATION:', {
        old_balance: oldBalance,
        credit_amount: finalCreditAmount,
        payment_amount: finalPaymentAmount,
        running_balance: runningBalance,
        calculation: `${oldBalance} + ${finalCreditAmount} - ${finalPaymentAmount} = ${runningBalance}`
      });

      // 4. Determine payment status
      let finalPaymentStatus = paymentStatus;
      if (!finalPaymentStatus) {
        finalPaymentStatus = finalCreditAmount > 0 ? 'PENDING' : 'COMPLETED';
      }
      
      const finalCreditStatus = finalCreditAmount > 0 ? 'PENDING' : 'NONE';

      // 5. Update the sale
      const updateQuery = `
        UPDATE sales SET
          subtotal = ?,
          total = ?,
          tax = ?,
          discount = ?,
          payment_method = ?,
          payment_amount = ?,
          credit_amount = ?,
          running_balance = ?,
          payment_status = ?,
          credit_status = ?,
          notes = ?,
          customer_name = ?,
          customer_phone = ?,
          customer_info = ?,
          updated_at = NOW()
        WHERE id = ?
      `;
      
      const updateParams = [
        finalSubtotal,
        finalTotal,
        parseFloat(tax) || 0,
        parseFloat(discount) || 0,
        finalPaymentMethod,
        finalPaymentAmount,
        finalCreditAmount,
        runningBalance,  // ✅ This is the key fix!
        finalPaymentStatus,
        finalCreditStatus,
        notes || sale.notes,
        customerName || sale.customer_name,
        customerPhone || sale.customer_phone,
        customerInfo ? JSON.stringify(customerInfo) : sale.customer_info,
        id
      ];
      
      console.log('[SalesController] Executing update query with running_balance:', runningBalance);
      
      const [updateResult] = await connection.execute(updateQuery, updateParams);
      console.log('[SalesController] Sale updated. Affected rows:', updateResult.affectedRows);

      // 6. Update subsequent transactions
      const customerIdentifier = customerName || sale.customer_name;
      const customerPhoneIdentifier = customerPhone || sale.customer_phone;
      
      if (customerIdentifier && customerPhoneIdentifier) {
        // Get all transactions after this one
        const [subsequentTransactions] = await connection.execute(`
          SELECT id, old_balance, running_balance, credit_amount, payment_amount
          FROM sales 
          WHERE (customer_name = ? OR customer_phone = ?)
            AND scope_type = ? 
            AND scope_id = ?
            AND (created_at > ? OR (created_at = ? AND id > ?))
          ORDER BY created_at ASC, id ASC
        `, [
          customerIdentifier,
          customerPhoneIdentifier,
          sale.scope_type,
          sale.scope_id,
          sale.created_at,
          sale.created_at,
          id
        ]);
        
        console.log(`[SalesController] Found ${subsequentTransactions.length} subsequent transactions to update`);
        
        let currentBalance = runningBalance;
        
        for (const transaction of subsequentTransactions) {
          const transactionId = transaction.id;
          const transactionCreditAmount = parseFloat(transaction.credit_amount) || 0;
          const transactionPaymentAmount = parseFloat(transaction.payment_amount) || 0;
          
          const transactionNewRunningBalance = currentBalance + transactionCreditAmount - transactionPaymentAmount;
          
          await connection.execute(
            'UPDATE sales SET old_balance = ?, running_balance = ?, updated_at = NOW() WHERE id = ?',
            [currentBalance, transactionNewRunningBalance, transactionId]
          );
          
          currentBalance = transactionNewRunningBalance;
        }
      }

      // 7. Update customer balance
      if (customerIdentifier && customerPhoneIdentifier) {
        const [customerRows] = await connection.execute(
          'SELECT id FROM customers WHERE (name = ? OR phone = ?) LIMIT 1',
          [customerIdentifier, customerPhoneIdentifier]
        );
        
        if (customerRows.length > 0) {
          const customerId = customerRows[0].id;
          await connection.execute(
            'UPDATE customers SET current_balance = ?, updated_at = NOW() WHERE id = ?',
            [runningBalance, customerId]
          );
          
          console.log('[SalesController] Updated customer balance:', {
            customerId,
            customerName: customerIdentifier,
            newCurrentBalance: runningBalance
          });
        }
      }

      await connection.commit();
      console.log('[SalesController] Transaction committed successfully');

      // 8. Get updated sale
      const [updatedSaleRows] = await connection.execute(`
        SELECT s.*, u.username as user_name
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?`, 
        [id]
      );
      
      const [updatedItems] = await connection.execute(`
        SELECT si.*, ii.name as item_name, ii.sku
        FROM sale_items si
        LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
        WHERE si.sale_id = ?`, 
        [id]
      );

      console.log('[SalesController] UPDATE COMPLETE - Final values:', {
        id: updatedSaleRows[0]?.id,
        invoice_no: updatedSaleRows[0]?.invoice_no,
        total: updatedSaleRows[0]?.total,
        credit_amount: updatedSaleRows[0]?.credit_amount,
        payment_amount: updatedSaleRows[0]?.payment_amount,
        old_balance: updatedSaleRows[0]?.old_balance,
        running_balance: updatedSaleRows[0]?.running_balance,
        expected_running_balance: runningBalance,
        items_count: updatedItems.length
      });
      
      connection.release();
      
      res.json({
        success: true,
        message: 'Sale updated successfully',
        data: {
          ...updatedSaleRows[0],
          items: updatedItems.map(item => ({
            ...item,
            itemName: item.item_name,
            unitPrice: item.unit_price,
            originalPrice: item.original_price
          }))
        }
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('[SalesController] ERROR in updateSale:', error);
    
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[SalesController] Connection release error:', releaseError);
      }
    }
    
    res.status(400).json({
      success: false,
      message: error.message || 'Error updating sale',
      error: error.message
    });
  }
};

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
    
    console.log('[SalesController] Original sale customer info:', {
      saleId: saleId,
      invoiceNo: originalSale.invoiceNo || originalSale.invoice_no,
      customerName: originalSale.customerName,
      customer_name: originalSale.customer_name,
      customerPhone: originalSale.customerPhone,
      customer_phone: originalSale.customer_phone,
      customerInfo: originalSale.customerInfo || originalSale.customer_info
    });
    
    // Get original sale items to get the actual unit prices from the sale
    const [originalSaleItems] = await pool.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?',
      [saleId]
    );
    
    console.log('[SalesController] Original sale items:', originalSaleItems.map(item => ({
      id: item.id,
      inventory_item_id: item.inventory_item_id,
      item_name: item.item_name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      total: item.total
    })));

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

    // Enrich items with product details (including cost prices for ledger)
    // IMPORTANT: Use unit price from original sale item, not current inventory price
    // CRITICAL: Always use inventory_item_id from original sale item to avoid scope conflicts
    const enrichedItems = [];
    console.log('[SalesController] Processing return items:', {
      itemsCount: items.length,
      originalSaleItemsCount: originalSaleItems.length,
      items: items.map(i => ({
        inventoryItemId: i.inventoryItemId,
        productName: i.productName,
        quantity: i.quantity,
        refundAmount: i.refundAmount
      })),
      originalSaleItems: originalSaleItems.map(si => ({
        id: si.id,
        inventory_item_id: si.inventory_item_id,
        item_name: si.item_name,
        quantity: si.quantity
      }))
    });
    
    for (const item of items) {
      // Find matching original sale item by inventory_item_id or item name
      let originalSaleItem = null;
      if (item.inventoryItemId) {
        originalSaleItem = originalSaleItems.find(si => 
          si.inventory_item_id === item.inventoryItemId || 
          si.inventory_item_id === parseInt(item.inventoryItemId)
        );
      } else if (item.productName) {
        originalSaleItem = originalSaleItems.find(si => 
          si.item_name === item.productName || 
          si.item_name?.toLowerCase() === item.productName?.toLowerCase()
        );
      }
      
      // CRITICAL FIX: Always use inventory_item_id from original sale item to ensure correct scope
      // This prevents conflicts when same SKU/name exists in multiple branches
      // IMPORTANT: originalSaleItem.inventory_item_id might be NULL for manual items in the original sale
      const correctInventoryItemId = originalSaleItem?.inventory_item_id ?? item.inventoryItemId ?? null;
      
      console.log('[SalesController] Return item matching:', {
        providedInventoryItemId: item.inventoryItemId,
        providedProductName: item.productName,
        originalSaleItemFound: !!originalSaleItem,
        originalSaleItemId: originalSaleItem?.inventory_item_id,
        originalSaleItemName: originalSaleItem?.item_name,
        usingInventoryItemId: correctInventoryItemId,
        isNull: correctInventoryItemId === null,
        isUndefined: correctInventoryItemId === undefined,
        originalSaleScope: {
          scopeType: originalSale.scopeType,
          scopeId: originalSale.scopeId
        }
      });
      
      // Get unit price from original sale item if found, otherwise use refundAmount / quantity
      let unitPrice = 0;
      if (originalSaleItem) {
        unitPrice = parseFloat(originalSaleItem.unit_price) || 0;
        console.log('[SalesController] Using original sale unit price:', {
          itemName: originalSaleItem.item_name,
          originalUnitPrice: unitPrice,
          refundAmount: item.refundAmount,
          quantity: item.quantity
        });
      } else if (item.refundAmount && item.quantity) {
        // Fallback: calculate from refund amount
        unitPrice = parseFloat(item.refundAmount) / parseFloat(item.quantity);
        console.log('[SalesController] Original sale item not found, calculating unit price from refund:', {
          refundAmount: item.refundAmount,
          quantity: item.quantity,
          calculatedUnitPrice: unitPrice
        });
      } else {
        unitPrice = parseFloat(item.unitPrice) || 0;
      }
      
      // Handle manual items (no inventory validation needed)
      if (!correctInventoryItemId && !item.productName && !item.inventoryItemId) {
        console.log(`[SalesController] Processing manual item return: ${item.name || item.itemName}`);
        enrichedItems.push({
          inventoryItemId: null, // Manual items don't have inventory ID
          itemName: item.name || item.itemName,
          sku: item.sku || `MANUAL-${Date.now()}`,
          barcode: item.barcode || null,
          category: item.category || null,
          quantity: item.quantity,
          originalQuantity: originalSaleItem ? parseFloat(originalSaleItem.quantity) : item.quantity,
          unitPrice: unitPrice, // Use original sale price or calculated
          costPrice: parseFloat(item.costPrice) || 0, // Add cost price for ledger
          refundAmount: item.refundAmount
        });
        continue;
      }
      
      // CRITICAL FIX: Always use inventory_item_id from original sale item
      // This ensures we update the correct inventory item in the correct scope
      if (correctInventoryItemId) {
        // Get the inventory item details using the ID from the original sale
        const [inventoryItems] = await pool.execute(
          'SELECT * FROM inventory_items WHERE id = ?',
          [correctInventoryItemId]
        );
        
        if (inventoryItems.length > 0) {
          const inventoryItem = inventoryItems[0];
          
          // Verify the inventory item belongs to the correct scope (for security)
          // Note: This is a warning, not an error, as the original sale might have been from a different scope
          if (inventoryItem.scope_type !== originalSale.scopeType || 
              String(inventoryItem.scope_id) !== String(originalSale.scopeId)) {
            console.warn('[SalesController] Scope mismatch warning:', {
              inventoryItemId: inventoryItem.id,
              inventoryItemScope: { type: inventoryItem.scope_type, id: inventoryItem.scope_id },
              originalSaleScope: { type: originalSale.scopeType, id: originalSale.scopeId },
              message: 'Inventory item scope does not match original sale scope, but using original sale scope for return transaction'
            });
          }
          
          enrichedItems.push({
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            barcode: inventoryItem.barcode || null,
            category: inventoryItem.category || null,
            quantity: item.quantity,
            originalQuantity: originalSaleItem ? parseFloat(originalSaleItem.quantity) : item.quantity,
            unitPrice: unitPrice, // Use original sale price, not current inventory price
            costPrice: parseFloat(inventoryItem.cost_price) || 0, // Add cost price for ledger
            refundAmount: item.refundAmount
          });
          
          console.log('[SalesController] Using inventory item from original sale:', {
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            scope: { type: inventoryItem.scope_type, id: inventoryItem.scope_id },
            returnScope: { type: originalSale.scopeType, id: originalSale.scopeId }
          });
        } else {
          console.error('[SalesController] Inventory item not found:', {
            correctInventoryItemId,
            originalSaleItemId: originalSaleItem?.inventory_item_id,
            providedInventoryItemId: item.inventoryItemId,
            productName: item.productName
          });
          return res.status(400).json({
            success: false,
            message: `Inventory item with ID ${correctInventoryItemId} from original sale not found`
          });
        }
      } else if (item.productName || originalSaleItem?.item_name) {
        // If no inventory_item_id found but we have a product name, try to find it in the correct scope
        // This handles cases where the original sale item was a manual item but the product now exists in inventory
        const searchName = item.productName || originalSaleItem?.item_name;
        console.log('[SalesController] No inventory_item_id found, searching by name in scope:', {
          searchName,
          scopeType: originalSale.scopeType,
          scopeId: originalSale.scopeId
        });
        
        // Try to find inventory item by name/SKU in the original sale's scope
        let scopeFilter = '';
        let scopeParams = [];
        
        if (originalSale.scopeType === 'BRANCH') {
          // Get branch ID or name
          const [branches] = await pool.execute(
            'SELECT id, name FROM branches WHERE id = ? OR name = ? LIMIT 1',
            [originalSale.scopeId, originalSale.scopeId]
          );
          if (branches.length > 0) {
            scopeFilter = 'AND (scope_type = ? AND (scope_id = ? OR scope_id = ?))';
            scopeParams = ['BRANCH', branches[0].id, branches[0].name];
          }
        } else if (originalSale.scopeType === 'WAREHOUSE') {
          const [warehouses] = await pool.execute(
            'SELECT id, name FROM warehouses WHERE id = ? OR name = ? LIMIT 1',
            [originalSale.scopeId, originalSale.scopeId]
          );
          if (warehouses.length > 0) {
            scopeFilter = 'AND (scope_type = ? AND (scope_id = ? OR scope_id = ?))';
            scopeParams = ['WAREHOUSE', warehouses[0].id, warehouses[0].name];
          }
        }
        
        const [inventoryItems] = await pool.execute(
          `SELECT * FROM inventory_items WHERE (name LIKE ? OR sku LIKE ?) ${scopeFilter} LIMIT 1`,
          [`%${searchName}%`, `%${searchName}%`, ...scopeParams]
        );
        
        if (inventoryItems.length > 0) {
          const inventoryItem = inventoryItems[0];
          console.log('[SalesController] Found inventory item by name in scope:', {
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            scope: { type: inventoryItem.scope_type, id: inventoryItem.scope_id }
          });
          
          enrichedItems.push({
            inventoryItemId: inventoryItem.id,
            itemName: inventoryItem.name,
            sku: inventoryItem.sku,
            barcode: inventoryItem.barcode || null,
            category: inventoryItem.category || null,
            quantity: item.quantity,
            originalQuantity: originalSaleItem ? parseFloat(originalSaleItem.quantity) : item.quantity,
            unitPrice: unitPrice,
            costPrice: parseFloat(inventoryItem.cost_price) || 0,
            refundAmount: item.refundAmount
          });
        } else {
          // If still not found, treat as manual item
          console.log(`[SalesController] No inventory item found by name "${searchName}" in scope, treating as manual item`);
          enrichedItems.push({
            inventoryItemId: null,
            itemName: searchName,
            sku: `MANUAL-${Date.now()}`,
            barcode: item.barcode || null,
            category: item.category || null,
            quantity: item.quantity,
            originalQuantity: originalSaleItem ? parseFloat(originalSaleItem.quantity) : item.quantity,
            unitPrice: unitPrice,
            costPrice: parseFloat(item.costPrice) || 0,
            refundAmount: item.refundAmount
          });
        }
      } else {
        // If no inventory_item_id found in original sale and not provided, treat as manual item
        console.log(`[SalesController] No inventory item ID found and no product name, treating as manual item`);
        enrichedItems.push({
          inventoryItemId: null,
          itemName: item.productName || item.name || item.itemName || 'Unknown Item',
          sku: `MANUAL-${Date.now()}`,
          barcode: item.barcode || null,
          category: item.category || null,
          quantity: item.quantity,
          originalQuantity: originalSaleItem ? parseFloat(originalSaleItem.quantity) : item.quantity,
          unitPrice: unitPrice, // Use original sale price or calculated
          costPrice: parseFloat(item.costPrice) || 0, // Add cost price for ledger
          refundAmount: item.refundAmount
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
    console.log('[SalesController] Creating return with enriched items:', {
      enrichedItemsCount: enrichedItems.length,
      itemsWithInventoryId: enrichedItems.filter(i => i.inventoryItemId).length,
      itemsWithoutInventoryId: enrichedItems.filter(i => !i.inventoryItemId).length,
      enrichedItems: enrichedItems.map(i => ({
        inventoryItemId: i.inventoryItemId,
        itemName: i.itemName,
        sku: i.sku,
        quantity: i.quantity,
        refundAmount: i.refundAmount,
        unitPrice: i.unitPrice
      })),
      originalSaleScope: {
        scopeType: originalSale.scopeType,
        scopeId: originalSale.scopeId
      },
      originalSaleItems: originalSaleItems.map(si => ({
        id: si.id,
        inventory_item_id: si.inventory_item_id,
        item_name: si.item_name
      }))
    });
    
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
    
    console.log('[SalesController] Return created successfully:', {
      returnId: salesReturn.id,
      returnNo: salesReturn.returnNo,
      itemsCount: enrichedItems.length,
      itemsWithInventoryId: enrichedItems.filter(i => i.inventoryItemId).length
    });

    const actingUserName = req.user.name || req.user.username || req.user.email || 'System';
    const actingUserRole = req.user.role || 'ADMIN';

    // Restore inventory stock and create transaction records
    // Only process items with inventoryItemId (skip manual items)
    const itemsWithInventory = enrichedItems.filter(item => item.inventoryItemId !== null && item.inventoryItemId !== undefined);
    const manualItems = enrichedItems.filter(item => !item.inventoryItemId);
    
    if (manualItems.length > 0) {
      console.log(`[SalesController] Skipping ${manualItems.length} manual item(s) in return stock update`);
    }
    
    for (const item of itemsWithInventory) {
      try {
        // Validate inventoryItemId is not null (should already be filtered, but double-check)
        if (!item.inventoryItemId) {
          console.warn(`[SalesController] Skipping item with null inventoryItemId: ${item.itemName}`);
          continue;
        }
        
        // Verify the inventory item belongs to the correct scope before updating stock
        const [inventoryItems] = await pool.execute(
          'SELECT id, scope_type, scope_id, current_stock, name, sku FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        
        if (inventoryItems.length === 0) {
          console.error(`[SalesController] Inventory item ${item.inventoryItemId} not found`);
          throw new Error(`Inventory item ${item.inventoryItemId} not found`);
        }
        
        const inventoryItem = inventoryItems[0];
        
        // Verify scope matches (important for multi-scope inventory)
        const scopeMatches = (
          inventoryItem.scope_type === originalSale.scopeType &&
          String(inventoryItem.scope_id) === String(originalSale.scopeId)
        );
        
        if (!scopeMatches) {
          console.warn(`[SalesController] Scope mismatch detected for inventory item ${item.inventoryItemId}:`, {
            inventoryScope: { type: inventoryItem.scope_type, id: inventoryItem.scope_id },
            originalSaleScope: { type: originalSale.scopeType, id: originalSale.scopeId },
            message: 'Updating stock anyway using inventory_item_id from original sale'
          });
          // Note: We continue because the inventory_item_id from the original sale should be correct
          // This warning is just for logging purposes
        }
        
        console.log('[SalesController] Logging return (no stock change here; restock will add back):', {
          inventoryItemId: item.inventoryItemId,
          itemName: inventoryItem.name,
          itemSku: inventoryItem.sku,
          currentStock: inventoryItem.current_stock,
          returnQuantity: item.quantity,
          scope: { type: inventoryItem.scope_type, id: inventoryItem.scope_id }
        });
        
        // Create transaction record for stock report with original sale's scope (no stock mutation on return)
        console.log('[SalesController] Creating return transaction with scope:', {
          inventoryItemId: item.inventoryItemId,
          scopeType: originalSale.scopeType,
          scopeId: originalSale.scopeId,
          scopeIdType: typeof originalSale.scopeId
        });
        await createReturnTransaction(
          item.inventoryItemId,
          item.quantity,
          item.unitPrice,
          req.user.id,
          actingUserName,
          actingUserRole,
          salesReturn.id,
          null, // connection (not using transaction here)
          originalSale.scopeType, // Pass original sale's scope type
          originalSale.scopeId,    // Pass original sale's scope ID
          false // do not affect stock on return creation; restock will adjust stock
        );
        
      } catch (stockError) {
        console.error('Error restoring stock for item:', item.inventoryItemId, stockError);
        throw stockError;
      }
    }

    // ✅ CRITICAL FIX: DO NOT update original sale's running_balance
    // This preserves historical integrity - old rows must never be modified
    // Instead, create a sale record for the return with old_balance and running_balance
    
    // Extract customer info properly - check both direct fields and JSON
    const returnInvoiceNo = salesReturn.returnNo;
    const returnScopeType = originalSale.scopeType || originalSale.scope_type || 'BRANCH';
    const returnScopeId = originalSale.scopeId || originalSale.scope_id || '';
    let returnCustomerInfo = originalSale.customerInfo || originalSale.customer_info || null;
    let returnCustomerName = originalSale.customerName || originalSale.customer_name || null;
    let returnCustomerPhone = originalSale.customerPhone || originalSale.customer_phone || null;
    
    // If customer info is in JSON format, try to extract from there
    if (!returnCustomerName && returnCustomerInfo) {
      try {
        const customerInfoObj = typeof returnCustomerInfo === 'string' 
          ? JSON.parse(returnCustomerInfo) 
          : returnCustomerInfo;
        if (customerInfoObj && typeof customerInfoObj === 'object') {
          returnCustomerName = returnCustomerName || customerInfoObj.name || customerInfoObj.customerName || null;
          returnCustomerPhone = returnCustomerPhone || customerInfoObj.phone || customerInfoObj.customerPhone || null;
        }
      } catch (e) {
        console.error('[SalesController] Error parsing customer_info JSON:', e);
      }
    }
    
    // If still no customer name, try to get from the original sale's database row
    if (!returnCustomerName) {
      const [saleRows] = await pool.execute('SELECT customer_name, customer_phone FROM sales WHERE id = ?', [saleId]);
      if (saleRows.length > 0) {
        returnCustomerName = returnCustomerName || saleRows[0].customer_name || null;
        returnCustomerPhone = returnCustomerPhone || saleRows[0].customer_phone || null;
      }
    }
    
    console.log('[SalesController] 🔍 Getting customer running balance for return:', {
      returnCustomerName,
      returnCustomerPhone,
      returnScopeType,
      returnScopeId,
      saleId
    });
    
    // Get the customer's latest running balance (before this return)
    const previousRunningBalance = await getCustomerRunningBalance(
      returnCustomerName || '',
      returnCustomerPhone || '',
      returnScopeType,
      returnScopeId
    );
    
    // Calculate old_balance and running_balance for the return
    const returnOldBalance = previousRunningBalance;
    const returnRunningBalance = returnOldBalance - totalRefund; // Return reduces balance (negative amount)
    
    console.log('[SalesController] 💰 Creating return sale record with ledger balances:', {
      returnId: salesReturn.id,
      returnNo: salesReturn.returnNo,
      returnCustomerName,
      returnCustomerPhone,
      previousRunningBalance,
      returnOldBalance,
      totalRefund,
      returnRunningBalance,
      calculation: `${returnOldBalance} - ${totalRefund} = ${returnRunningBalance}`
    });
    
    // Create a sale record for the return (with negative amounts)
    // This ensures returns are treated like sales in the ledger with stored old_balance and running_balance
    // We insert directly instead of using Sale.create() because we need to use our calculated old_balance and running_balance
    try {
      const returnNotes = `Return for sale ${originalSale.invoiceNo || originalSale.invoice_no || saleId}. Reason: ${reason || 'N/A'}`;
      
      console.log('[SalesController] Return sale record - Customer info:', {
        returnCustomerName,
        returnCustomerPhone,
        originalSaleCustomerName: originalSale.customerName,
        originalSaleCustomer_name: originalSale.customer_name,
        originalSaleCustomerPhone: originalSale.customerPhone,
        originalSaleCustomer_phone: originalSale.customer_phone,
        returnInvoiceNo: returnInvoiceNo
      });
      
      // Insert sale record directly with our calculated balances
      const [returnSaleResult] = await pool.execute(
        `
        INSERT INTO sales (
          invoice_no, scope_type, scope_id, user_id, shift_id,
          subtotal, tax, discount, total,
          payment_method, payment_type, payment_status,
          customer_info, notes, status,
          customer_name, customer_phone,
          payment_amount, credit_amount,
          old_balance, running_balance,
          credit_status, credit_due_date, customer_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          returnInvoiceNo,
          returnScopeType,
          returnScopeId,
          req.user.id,
          null, // shift_id
          -totalRefund, // subtotal (negative for return)
          0, // tax
          0, // discount
          -totalRefund, // total (negative for return)
          'REFUND', // payment_method
          'REFUND', // payment_type
          'COMPLETED', // payment_status
          returnCustomerInfo ? JSON.stringify(returnCustomerInfo) : null, // customer_info
          returnNotes, // notes
          'COMPLETED', // status
          returnCustomerName, // customer_name
          returnCustomerPhone, // customer_phone
          -totalRefund, // payment_amount (negative for refund)
          0, // credit_amount
          returnOldBalance, // old_balance (our calculated value)
          returnRunningBalance, // running_balance (our calculated value)
          'NONE', // credit_status
          null, // credit_due_date
          originalSale.customerId || originalSale.customer_id || null // customer_id
        ]
      );
      
      const returnSaleId = returnSaleResult.insertId;
      console.log('[SalesController] ✅ Return sale record created successfully:', {
        returnSaleId: returnSaleId,
        invoiceNo: returnInvoiceNo,
        oldBalance: returnOldBalance,
        runningBalance: returnRunningBalance,
        customerName: returnCustomerName,
        customerPhone: returnCustomerPhone
      });
      
      // Verify the return sale record was created correctly
      const [verifyReturn] = await pool.execute(`
        SELECT 
          id, invoice_no, customer_name, customer_phone, 
          old_balance, running_balance, payment_method, payment_type,
          subtotal, total, created_at
        FROM sales 
        WHERE id = ?
      `, [returnSaleId]);
      
      if (verifyReturn.length > 0) {
        console.log('[SalesController] ✅ Verified return sale record in database:', {
          id: verifyReturn[0].id,
          invoice_no: verifyReturn[0].invoice_no,
          customer_name: verifyReturn[0].customer_name,
          customer_phone: verifyReturn[0].customer_phone,
          old_balance: verifyReturn[0].old_balance,
          running_balance: verifyReturn[0].running_balance,
          payment_method: verifyReturn[0].payment_method,
          payment_type: verifyReturn[0].payment_type,
          subtotal: verifyReturn[0].subtotal,
          total: verifyReturn[0].total,
          created_at: verifyReturn[0].created_at
        });
      } else {
        console.error('[SalesController] ❌ ERROR: Return sale record not found after creation!');
      }
    } catch (returnSaleError) {
      console.error('[SalesController] CRITICAL ERROR creating return sale record:', returnSaleError);
      console.error('[SalesController] Return sale error details:', {
        message: returnSaleError.message,
        sqlMessage: returnSaleError.sqlMessage,
        sqlState: returnSaleError.sqlState,
        code: returnSaleError.code,
        errno: returnSaleError.errno
      });
      // Re-throw the error so the return creation fails
      // This ensures returns always have sale records for ledger tracking
      throw new Error(`Failed to create return sale record: ${returnSaleError.message}`);
    }

    // Record return in ledger with proper debit/credit entries
    try {
      console.log('[SalesController] Starting ledger recording for return...');
      const ledgerResult = await LedgerService.recordReturnTransaction({
        returnId: salesReturn.id,
        returnNo: salesReturn.returnNo,
        originalSaleId: saleId,
        originalSale: originalSale,
        scopeType: originalSale.scopeType,
        scopeId: originalSale.scopeId,
        totalRefund: totalRefund,
        items: enrichedItems,
        userId: req.user.id
      });
      console.log('[SalesController] Return recorded in ledger successfully:', ledgerResult);
    } catch (ledgerError) {
      console.error('[SalesController] CRITICAL ERROR recording return in ledger:', ledgerError);
      console.error('[SalesController] Ledger error stack:', ledgerError.stack);
      console.error('[SalesController] Ledger error details:', {
        message: ledgerError.message,
        code: ledgerError.code,
        errno: ledgerError.errno,
        sqlState: ledgerError.sqlState,
        sqlMessage: ledgerError.sqlMessage
      });
      // Don't fail the return if ledger recording fails, but log it properly
    }

    // Fetch the created return sale record to include in response
    let returnSaleRecord = null;
    try {
      const [returnSaleRows] = await pool.execute(`
        SELECT 
          id, invoice_no, customer_name, customer_phone, 
          old_balance, running_balance, payment_method, payment_type,
          subtotal, total, payment_amount, created_at
        FROM sales 
        WHERE invoice_no = ?
        ORDER BY id DESC
        LIMIT 1
      `, [salesReturn.returnNo]);
      
      if (returnSaleRows.length > 0) {
        returnSaleRecord = returnSaleRows[0];
      }
    } catch (fetchError) {
      console.error('[SalesController] Error fetching return sale record for response:', fetchError);
    }

    res.status(201).json({
      success: true,
      message: 'Sales return created successfully',
      data: {
        ...salesReturn,
        returnSaleRecord: returnSaleRecord ? {
          id: returnSaleRecord.id,
          invoice_no: returnSaleRecord.invoice_no,
          customer_name: returnSaleRecord.customer_name,
          customer_phone: returnSaleRecord.customer_phone,
          old_balance: returnSaleRecord.old_balance,
          running_balance: returnSaleRecord.running_balance,
          payment_method: returnSaleRecord.payment_method,
          payment_type: returnSaleRecord.payment_type,
          subtotal: returnSaleRecord.subtotal,
          total: returnSaleRecord.total,
          payment_amount: returnSaleRecord.payment_amount,
          created_at: returnSaleRecord.created_at
        } : null
      },
      debug: {
        customerName: returnCustomerName,
        customerPhone: returnCustomerPhone,
        previousRunningBalance: previousRunningBalance,
        returnOldBalance: returnOldBalance,
        returnRunningBalance: returnRunningBalance,
        totalRefund: totalRefund
      }
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
    const { scopeType, scopeId, startDate, endDate, search } = req.query;
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 25;
    if (limit > 200) limit = 200;
    const offset = (page - 1) * limit;
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
    } else if (req.user.role === 'ADMIN') {
      // Admin can filter by scopeType and/or scopeId
      if (scopeType && scopeType !== 'all') {
        whereConditions.push('s.scope_type = ?');
        params.push(scopeType);
        
        // If scopeId is also provided, handle both name (string) and ID (number) matching
        if (scopeId && scopeId !== 'all') {
          // Check if scopeId is numeric (branch/warehouse ID) or string (name)
          const isNumeric = /^\d+$/.test(String(scopeId));
          
          if (scopeType === 'BRANCH' && isNumeric) {
            // If scopeId is numeric, get branch name to match against sales.scope_id
            const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [parseInt(scopeId)]);
            if (branches.length > 0) {
              whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
              params.push(branches[0].name, String(scopeId));
            } else {
              // Branch not found, match by ID as string
              whereConditions.push('s.scope_id = ?');
              params.push(String(scopeId));
            }
          } else if (scopeType === 'WAREHOUSE' && isNumeric) {
            // If scopeId is numeric, get warehouse name to match against sales.scope_id
            const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [parseInt(scopeId)]);
            if (warehouses.length > 0) {
              whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
              params.push(warehouses[0].name, String(scopeId));
            } else {
              // Warehouse not found, match by ID as string
              whereConditions.push('s.scope_id = ?');
              params.push(String(scopeId));
            }
          } else {
            // scopeId is a string (name), match directly
            whereConditions.push('(s.scope_id = ? OR s.scope_id = ?)');
            params.push(scopeId, String(scopeId));
          }
        }
      } else if (scopeId && scopeId !== 'all') {
        // If only scopeId is provided without scopeType, try to match by both BRANCH and WAREHOUSE
        const isNumeric = /^\d+$/.test(String(scopeId));
        
        if (isNumeric) {
          // Try to find branch or warehouse with this ID
          const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [parseInt(scopeId)]);
          const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [parseInt(scopeId)]);
          
          if (branches.length > 0) {
            whereConditions.push('(s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?))');
            params.push('BRANCH', branches[0].name, String(scopeId));
          }
          if (warehouses.length > 0) {
            if (branches.length > 0) {
              // Add OR condition for warehouse
              whereConditions[whereConditions.length - 1] = whereConditions[whereConditions.length - 1].replace(')', '') + ' OR (s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?)))';
              params.push('WAREHOUSE', warehouses[0].name, String(scopeId));
            } else {
              whereConditions.push('(s.scope_type = ? AND (s.scope_id = ? OR s.scope_id = ?))');
              params.push('WAREHOUSE', warehouses[0].name, String(scopeId));
            }
          }
        } else {
          // scopeId is a string, match by name for both BRANCH and WAREHOUSE
          whereConditions.push('((s.scope_type = ? AND s.scope_id = ?) OR (s.scope_type = ? AND s.scope_id = ?))');
          params.push('BRANCH', scopeId, 'WAREHOUSE', scopeId);
        }
      }
      // If neither scopeType nor scopeId is provided, show all returns (no scope filtering)
    }

    if (startDate) {
      whereConditions.push('sr.created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('sr.created_at <= ?');
      params.push(endDate);
    }

    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      whereConditions.push('(sr.return_no LIKE ? OR s.invoice_no LIKE ? OR sr.reason LIKE ? OR sr.notes LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    console.log('[SalesController] getSalesReturns - Query params:', {
      role: req.user.role,
      scopeType,
      scopeId,
      whereClause,
      params,
      whereConditions
    });

    // Total count for pagination
    const [countRows] = await pool.execute(`
      SELECT COUNT(*) AS count
      FROM sales_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      ${whereClause}
    `, params);
    const total = countRows?.[0]?.count || 0;

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
        w.name as warehouse_name,
        (
          SELECT SUM(sri.remaining_quantity) 
          FROM sales_return_items sri 
          WHERE sri.return_id = sr.id
        ) AS remaining_total
      FROM sales_returns sr
      JOIN sales s ON sr.original_sale_id = s.id
      LEFT JOIN users u ON sr.user_id = u.id
      LEFT JOIN users p ON sr.processed_by = p.id
      LEFT JOIN branches b ON (
        s.scope_type = 'BRANCH' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(b.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = b.id OR
          CAST(b.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      LEFT JOIN warehouses w ON (
        s.scope_type = 'WAREHOUSE' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(w.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = w.id OR
          CAST(w.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    console.log('[SalesController] getSalesReturns - Found', returns.length, 'returns');
    if (returns.length > 0) {
      console.log('[SalesController] Sample returns:', returns.slice(0, 3).map(r => ({
        id: r.id,
        return_no: r.return_no,
        original_sale_id: r.original_sale_id,
        invoice_no: r.invoice_no,
        scope_type: r.scope_type || 'N/A',
        scope_id: r.scope_id || 'N/A'
      })));
    }

    // ✅ FIXED: Calculate total refund for each return by summing its items
    // Also calculate overall summary totals
    let totalReturnsAmount = 0;
    const returnsWithCalculatedTotals = await Promise.all(
      returns.map(async (returnRecord) => {
        // Get return items to calculate actual total refund
        const [items] = await pool.execute(`
          SELECT refund_amount
          FROM sales_return_items
          WHERE return_id = ?
        `, [returnRecord.id]);

        // Calculate total refund as sum of all items' refund amounts
        const calculatedTotalRefund = items.reduce((sum, item) => {
          return sum + parseFloat(item.refund_amount || 0);
        }, 0);

        // Add to overall total
        totalReturnsAmount += calculatedTotalRefund;

        return {
          ...returnRecord,
          // ✅ Use calculated total refund (sum of items) instead of stored value
          total_refund: calculatedTotalRefund,
          totalRefund: calculatedTotalRefund, // Add camelCase for frontend compatibility
          // Keep original stored value for reference
          _original_total_refund: returnRecord.total_refund
        };
      })
    );

    console.log('[SalesController] getSalesReturns - Summary:', {
      totalReturns: returnsWithCalculatedTotals.length,
      totalAmount: totalReturnsAmount,
      sampleCalculatedTotals: returnsWithCalculatedTotals.slice(0, 3).map(r => ({
        id: r.id,
        stored_total_refund: r._original_total_refund,
        calculated_total_refund: r.total_refund
      }))
    });

    res.json({
      success: true,
      count: returnsWithCalculatedTotals.length,
      total,
      page,
      limit,
      summary: {
        totalReturns: total,
        totalAmount: totalReturnsAmount
      },
      data: returnsWithCalculatedTotals
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
      LEFT JOIN branches b ON (
        s.scope_type = 'BRANCH' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(b.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = b.id OR
          CAST(b.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      LEFT JOIN warehouses w ON (
        s.scope_type = 'WAREHOUSE' AND (
          CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(w.name AS CHAR) COLLATE utf8mb4_bin OR 
          CAST(s.scope_id AS UNSIGNED) = w.id OR
          CAST(w.id AS CHAR) COLLATE utf8mb4_bin = CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin
        )
      )
      WHERE sr.id = ?
    `, [id]);

    if (returns.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Return not found'
      });
    }

    const returnData = returns[0];

    console.log('[SalesController] getSalesReturn - Return found:', {
      returnId: returnData.id,
      originalSaleId: returnData.original_sale_id
    });

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

    console.log('[SalesController] getSalesReturn - Items found:', items.length);
    if (items.length > 0) {
      console.log('[SalesController] getSalesReturn - First item sample:', {
        id: items[0].id,
        item_name: items[0].item_name,
        inventory_item_name: items[0].inventory_item_name,
        inventory_item_id: items[0].inventory_item_id,
        quantity: items[0].quantity,
        refund_amount: items[0].refund_amount
      });
    }

    // FALLBACK: If no items found (old returns that weren't saved), try to reconstruct from original sale
    let itemsToUse = items;
    if (items.length === 0 && returnData.original_sale_id) {
      console.log('[SalesController] getSalesReturn - No items found, attempting to reconstruct from original sale:', returnData.original_sale_id);
      
      try {
        // Get original sale items
        const [originalSaleItems] = await pool.execute(`
          SELECT 
            si.*,
            ii.name as inventory_item_name,
            ii.sku as inventory_sku,
            ii.selling_price as inventory_price,
            ii.category as inventory_category,
            ii.barcode as inventory_barcode
          FROM sale_items si
          LEFT JOIN inventory_items ii ON si.inventory_item_id = ii.id
          WHERE si.sale_id = ?
          ORDER BY si.id
        `, [returnData.original_sale_id]);

        if (originalSaleItems.length > 0) {
          console.log('[SalesController] getSalesReturn - Reconstructed items from original sale:', originalSaleItems.length);
          
          // Reconstruct return items from original sale items
          // Use the total refund amount divided by number of items as a simple approximation
          const refundPerItem = returnData.total_refund ? (parseFloat(returnData.total_refund) / originalSaleItems.length) : 0;
          
          itemsToUse = originalSaleItems.map((saleItem, index) => ({
            id: null, // No actual return item ID
            return_id: returnData.id,
            inventory_item_id: saleItem.inventory_item_id,
            item_name: saleItem.item_name || saleItem.inventory_item_name || 'Unknown Item',
            sku: saleItem.sku || saleItem.inventory_sku || 'N/A',
            barcode: saleItem.barcode || saleItem.inventory_barcode || null,
            category: saleItem.category || saleItem.inventory_category || null,
            quantity: parseFloat(saleItem.quantity) || 0,
            original_quantity: parseFloat(saleItem.quantity) || 0,
            remaining_quantity: parseFloat(saleItem.quantity) || 0,
            unit_price: parseFloat(saleItem.unit_price) || 0,
            refund_amount: refundPerItem || parseFloat(saleItem.total) || 0,
            created_at: returnData.created_at,
            inventory_item_name: saleItem.inventory_item_name,
            inventory_sku: saleItem.inventory_sku,
            inventory_price: parseFloat(saleItem.inventory_price) || 0,
            inventory_category: saleItem.inventory_category,
            inventory_barcode: saleItem.inventory_barcode
          }));
        }
      } catch (fallbackError) {
        console.error('[SalesController] getSalesReturn - Error reconstructing items from original sale:', fallbackError);
        // Continue with empty items array
      }
    }

    // Transform items data
    const transformedItems = itemsToUse.map(item => ({
      id: item.id,
      returnId: item.return_id,
      inventoryItemId: item.inventory_item_id,
      itemName: item.item_name || item.inventory_item_name || 'Unknown Item',
      name: item.item_name || item.inventory_item_name || 'Unknown Item', // Add 'name' for frontend compatibility
      productName: item.item_name || item.inventory_item_name || 'Unknown Item', // Add 'productName' for frontend compatibility
      sku: item.sku || item.inventory_sku || 'N/A',
      barcode: item.barcode || item.inventory_barcode || null,
      category: item.category || item.inventory_category || null,
      quantity: parseFloat(item.quantity) || 0,
      originalQuantity: parseFloat(item.original_quantity) || 0,
      remainingQuantity: parseFloat(item.remaining_quantity) || 0,
      unitPrice: parseFloat(item.unit_price) || 0,
      unit_price: parseFloat(item.unit_price) || 0, // Add snake_case for frontend compatibility
      refundAmount: parseFloat(item.refund_amount) || 0,
      refund_amount: parseFloat(item.refund_amount) || 0, // Add snake_case for frontend compatibility
      createdAt: item.created_at,
      // Additional inventory info
      inventoryItemName: item.inventory_item_name,
      inventorySku: item.inventory_sku,
      inventoryPrice: parseFloat(item.inventory_price) || 0,
      currentStock: parseFloat(item.current_stock) || 0,
      minStockLevel: parseFloat(item.min_stock_level) || 0,
      maxStockLevel: parseFloat(item.max_stock_level) || 0
    }));

    console.log('[SalesController] getSalesReturn - Transformed items:', transformedItems.length);

    // ✅ FIXED: Calculate total refund as sum of all items' refund amounts
    const calculatedTotalRefund = transformedItems.reduce((sum, item) => {
      const refundAmount = parseFloat(item.refundAmount || item.refund_amount || 0);
      return sum + refundAmount;
    }, 0);

    console.log('[SalesController] getSalesReturn - Total refund calculation:', {
      storedTotalRefund: returnData.total_refund,
      calculatedTotalRefund: calculatedTotalRefund,
      itemsCount: transformedItems.length,
      itemRefunds: transformedItems.map(item => ({
        itemName: item.itemName,
        refundAmount: item.refundAmount || item.refund_amount
      }))
    });

    // Combine return data with items
    const returnWithItems = {
      ...returnData,
      items: transformedItems,
      // ✅ Use calculated total refund (sum of all items) instead of stored value
      total_refund: calculatedTotalRefund,
      totalRefund: calculatedTotalRefund // Add camelCase for frontend compatibility
    };

    console.log('[SalesController] getSalesReturn - Returning data with items:', {
      returnId: returnWithItems.id,
      itemsCount: returnWithItems.items.length,
      totalRefund: returnWithItems.total_refund
    });

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
      let userWarehouseId = req.user.warehouseId;
      
      if (!userWarehouseName && userWarehouseId) {
        const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [userWarehouseId]);
        if (warehouses.length > 0) {
          userWarehouseName = warehouses[0].name;
        }
      }
      
      if (userWarehouseName) {
        // Filter by warehouse name and ID (handle both string and number comparisons)
        whereConditions.push(`(
          s.scope_type = 'WAREHOUSE' AND (
            CAST(s.scope_id AS CHAR) COLLATE utf8mb4_bin = CAST(? AS CHAR) COLLATE utf8mb4_bin
            OR s.scope_id = ?
            OR s.scope_id = ?
          )
        )`);
        params.push(userWarehouseName, String(userWarehouseId || ''), userWarehouseId);
      } else if (userWarehouseId) {
        // Fallback: only warehouse ID available
        whereConditions.push(`(
          s.scope_type = 'WAREHOUSE' AND (
            s.scope_id = ?
            OR s.scope_id = ?
          )
        )`);
        params.push(String(userWarehouseId), userWarehouseId);
      } else {
        // No warehouse info available, only filter by type
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

    // ✅ FIXED: Get the latest transaction first, then check if balance is outstanding
    // This ensures returns (which set running_balance to 0) are correctly handled
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
        s.subtotal,
        s.payment_method,
        s.payment_type
      FROM sales s
      WHERE (LOWER(TRIM(s.customer_name)) = LOWER(TRIM(?)) OR s.customer_phone = ? OR LOWER(TRIM(JSON_EXTRACT(s.customer_info, "$.name"))) = LOWER(TRIM(?)) OR JSON_EXTRACT(s.customer_info, "$.phone") = ?)
    `;
    
    let params = [customerName || phone || '', phone || customerName || '', customerName || phone || '', phone || customerName || ''];

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
    
    // ✅ FIXED: Only return outstanding if balance is actually > 0.01
    // This ensures returns that set balance to 0 are correctly handled
    if (Math.abs(outstanding) <= 0.01) {
      console.log('🔍 No outstanding balance - latest running_balance is:', outstanding);
      return res.json({
        success: true,
        data: []
      });
    }
    
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
    const { customerName, phone, paymentAmount, paymentMethod } = req.body;

    if (!customerName || !phone || !paymentMethod) {
  return res.status(400).json({
    success: false,
    message: 'Customer name, phone, and payment method are required'
  });
}

    // Get user's scope information based on role
    let scopeType, scope;
    
    if (req.user.role === 'CASHIER' && req.user.branchId) {
      const [branches] = await pool.execute('SELECT name FROM branches WHERE id = ?', [req.user.branchId]);
      if (branches.length > 0) {
        scopeType = 'BRANCH';
        scope = branches[0].name;
      }
    } else if (req.user.role === 'WAREHOUSE_KEEPER' && req.user.warehouseId) {
      const [warehouses] = await pool.execute('SELECT name FROM warehouses WHERE id = ?', [req.user.warehouseId]);
      if (warehouses.length > 0) {
        scopeType = 'WAREHOUSE';
        scope = warehouses[0].name;
      }
    } else if (req.user.role === 'ADMIN') {
      scopeType = null;
      scope = null;
    }

    // Validate scope information for non-admin users
    if (req.user.role !== 'ADMIN' && (!scope || !scopeType)) {
      return res.status(400).json({
        success: false,
        message: 'User scope information is missing'
      });
    }

    const normalizedPaymentAmount = parseFloat(paymentAmount) || 0;
    if (Number.isNaN(normalizedPaymentAmount) || normalizedPaymentAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount cannot be negative'
      });
    }

    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // ✅ RULE: Find the customer's latest running balance
      let latestRunningBalance = 0;
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

      // Check if customer has any balance to settle
      if (Math.abs(latestRunningBalance) <= 0.01) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Customer has no outstanding balance or credit to settle'
        });
      }

      // Determine if we're dealing with credit (negative) or outstanding (positive)
      const isCreditSettlement = latestRunningBalance < 0;
      const absoluteBalance = Math.abs(latestRunningBalance);
      
      console.log('💰 Settlement details:', {
        customerName,
        phone,
        latestRunningBalance,
        isCreditSettlement,
        absoluteBalance,
        paymentAmount: normalizedPaymentAmount
      });

      // Validate payment amount based on balance type
      let actualPaymentAmount = normalizedPaymentAmount;
      
      if (isCreditSettlement) {
        // For credit (negative balance): customer is getting MONEY BACK
        // This is a REFUND scenario
        if (normalizedPaymentAmount === 0) {
          // If payment amount is 0, they want to clear the full credit
          actualPaymentAmount = absoluteBalance;
        } else if (normalizedPaymentAmount > absoluteBalance) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Refund amount (${normalizedPaymentAmount}) cannot exceed available credit (${absoluteBalance})`
          });
        }
        
        // For credit refunds, payment method should indicate it's a refund
        console.log(`💰 Customer getting refund of ${actualPaymentAmount} from credit balance of ${absoluteBalance}`);
      } else {
        // For outstanding (positive balance): customer is PAYING their debt
        if (normalizedPaymentAmount === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Payment amount must be greater than 0 for outstanding balance'
          });
        }
        
        if (normalizedPaymentAmount > absoluteBalance) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Payment amount (${normalizedPaymentAmount}) cannot exceed outstanding balance (${absoluteBalance})`
          });
        }
      }

      // ✅ RULE: Create ONE new settlement sale row
      const oldBalance = latestRunningBalance; // old_balance = latest running_balance
      
      // Calculate new running balance and payment type
      let newRunningBalance, actualPaymentMethod, settlementType, totalAmount, notes;
      
      if (isCreditSettlement) {
        // Customer is getting REFUND from their credit (negative balance)
        // Example: -500 credit, refund 500 → new balance = 0
        // Payment is negative because we're GIVING money to customer
        newRunningBalance = oldBalance + actualPaymentAmount; // Negative + positive = less negative
        actualPaymentMethod = 'CASH_REFUND'; // Special payment method for refunds
        settlementType = 'CREDIT_REFUND_SETTLEMENT';
        totalAmount = -actualPaymentAmount; // Negative total for refund
        notes = `Credit refund: Customer received ${actualPaymentAmount.toFixed(2)} cash back from credit balance of ${Math.abs(oldBalance).toFixed(2)}`;
      } else {
        // Customer is PAYING their outstanding (positive balance)
        newRunningBalance = oldBalance - actualPaymentAmount; // Positive - positive = less positive
        actualPaymentMethod = paymentMethod;
        settlementType = 'OUTSTANDING_SETTLEMENT';
        totalAmount = actualPaymentAmount;
        notes = `Outstanding payment settlement: Customer paid ${actualPaymentAmount.toFixed(2)} toward balance of ${oldBalance.toFixed(2)}`;
      }
      
      const paymentStatus = Math.abs(newRunningBalance) <= 0.01 ? 'COMPLETED' : 'PARTIAL';

      console.log('💰 Settlement calculation:', {
        oldBalance,
        actualPaymentAmount,
        newRunningBalance,
        isCreditSettlement,
        paymentStatus,
        settlementType
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

      // Insert settlement record with appropriate values
      const [settlementResult] = await connection.execute(`
        INSERT INTO sales (
          invoice_no, scope_type, scope_id, user_id, subtotal, tax, discount, total,
          payment_method, payment_type, payment_status, customer_info, customer_name, 
          customer_phone, payment_amount, credit_amount, old_balance, running_balance, credit_status,
          notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        settlementInvoiceNo,
        scopeType,
        scope,
        req.user.id,
        0, // subtotal
        0, // tax
        0, // discount
        totalAmount, // total = positive for payment, negative for refund
        actualPaymentMethod,
        settlementType,
        paymentStatus,
        JSON.stringify({ 
          name: customerName, 
          phone: phone,
          isCreditRefund: isCreditSettlement,
          refundAmount: isCreditSettlement ? actualPaymentAmount : 0,
          paymentAmount: !isCreditSettlement ? actualPaymentAmount : 0
        }),
        customerName,
        phone,
        isCreditSettlement ? -actualPaymentAmount : actualPaymentAmount, // payment_amount (negative for refund)
        isCreditSettlement ? actualPaymentAmount : 0, // credit_amount (amount of credit refunded)
        oldBalance, // old_balance
        newRunningBalance, // running_balance
        isCreditSettlement ? 'REFUNDED' : 'NONE', // credit_status
        notes,
        'COMPLETED',
      ]);

      const settlementId = settlementResult.insertId;

      // ✅ Record settlement in ledger
      try {
        if (typeof LedgerService !== 'undefined' && LedgerService.recordSaleTransaction) {
          await LedgerService.recordSaleTransaction({
            saleId: settlementId,
            invoiceNo: settlementInvoiceNo,
            scopeType: scopeType,
            scopeId: scope,
            totalAmount: Math.abs(totalAmount),
            paymentAmount: isCreditSettlement ? 0 : actualPaymentAmount,
            creditAmount: isCreditSettlement ? actualPaymentAmount : 0,
            paymentMethod: actualPaymentMethod,
            customerInfo: { 
              name: customerName, 
              phone: phone,
              isCreditRefund: isCreditSettlement
            },
            userId: req.user.id,
            items: [],
            isSettlement: true,
            isCreditRefund: isCreditSettlement
          });
        }
      } catch (ledgerError) {
        console.error('Error recording settlement in ledger:', ledgerError);
        // Don't fail the settlement if ledger recording fails
      }

      // ✅ Create financial voucher
      try {
        if (typeof FinancialVoucher !== 'undefined' && FinancialVoucher.create) {
          const voucherNo = `VCH-${isCreditSettlement ? 'REFUND' : 'SETTLE'}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          await FinancialVoucher.create({
            voucherNo: voucherNo,
            type: isCreditSettlement ? 'EXPENSE' : 'INCOME',
            category: isCreditSettlement ? 'CREDIT_REFUND' : 'SETTLEMENT',
            paymentMethod: actualPaymentMethod.toUpperCase(),
            amount: Math.abs(totalAmount),
            description: isCreditSettlement 
              ? `Credit refund to ${customerName} (${phone}): Refunded ${actualPaymentAmount.toFixed(2)} from credit balance`
              : `Outstanding payment from ${customerName} (${phone}): Received ${actualPaymentAmount.toFixed(2)}`,
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
          });
        }
      } catch (voucherError) {
        console.error('Error creating financial voucher for settlement:', voucherError);
        // Don't fail the settlement if voucher creation fails
      }

      await connection.commit();

      // Get the updated balance
      const [latestSaleRow] = await connection.execute(
        `SELECT running_balance FROM sales 
        WHERE customer_name = ? AND customer_phone = ? 
         ${req.user.role !== 'ADMIN' && scope && scopeType ? 'AND scope_type = ? AND scope_id = ?' : ''}
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        req.user.role !== 'ADMIN' && scope && scopeType 
          ? [customerName, phone, scopeType, scope]
          : [customerName, phone]
      );

      const remainingOutstanding = latestSaleRow.length > 0 
        ? parseFloat(latestSaleRow[0].running_balance) || 0 
        : 0;

      // Get settlement sale details
      const [settlementSaleRows] = await connection.execute(
        `SELECT id, invoice_no, created_at, total, payment_method, payment_amount, credit_amount, running_balance, customer_name, customer_phone
         FROM sales WHERE id = ?`,
        [settlementId]
      );
      const settlementSale = settlementSaleRows.length > 0 ? settlementSaleRows[0] : null;

      res.json({
        success: true,
        message: isCreditSettlement 
          ? `Credit refund processed successfully: Customer received ${actualPaymentAmount.toFixed(2)} cash back`
          : `Settlement processed successfully: Customer paid ${actualPaymentAmount.toFixed(2)}`,
        data: {
          customerName,
          phone,
          paymentAmount: actualPaymentAmount,
          paymentMethod: actualPaymentMethod,
          remainingOutstanding,
          isFullyCleared: Math.abs(remainingOutstanding) <= 0.01,
          settlementCreated: true,
          settlementAmount: actualPaymentAmount,
          settlementSale,
          isCreditRefund: isCreditSettlement,
          originalBalance: oldBalance,
          newBalance: newRunningBalance,
          refundAmount: isCreditSettlement ? actualPaymentAmount : 0
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