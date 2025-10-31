const { validationResult } = require('express-validator');
const WarehouseSale = require('../models/WarehouseSale');
const Sale = require('../models/Sale');
const Retailer = require('../models/Retailer');
const InventoryItem = require('../models/InventoryItem');
const { pool } = require('../config/database');

// Helper function to get retailer's current running balance
const getRetailerRunningBalance = async (retailerId, scopeType, scopeId) => {
  try {
    const [latestSale] = await pool.execute(`
      SELECT running_balance 
      FROM sales 
      WHERE JSON_EXTRACT(customer_info, "$.id") = ?
        AND scope_type = ? 
        AND scope_id = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `, [retailerId, scopeType, scopeId]);
    
    if (latestSale.length > 0) {
      return parseFloat(latestSale[0].running_balance) || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching retailer running balance:', error);
    return 0;
  }
};

// @desc    Create warehouse sale to retailer
// @route   POST /api/warehouse-sales
// @access  Private (Warehouse Keeper, Admin)
const createWarehouseSale = async (req, res, next) => {
  try {
    console.log('[WarehouseSaleController] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[WarehouseSaleController] Retailer ID:', req.body.retailerId, 'Type:', typeof req.body.retailerId);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[WarehouseSaleController] Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const {
      retailerId,
      items,
      totalAmount,
      taxAmount = 0,
      discountAmount = 0,
      finalAmount,
      paymentMethod = 'CASH',
      paymentType,
      paymentTerms,
      notes,
      paymentAmount,
      creditAmount,
      finalTotal,
      paymentStatus,
      salespersonId,
      salespersonName,
      salespersonPhone,
      outstandingPayments = [],
      customerInfo
    } = req.body;


    // Verify retailer exists (retailers are now the customers)
    // Only verify if retailerId is provided
    let retailer = null;
    if (retailerId) {
      retailer = await Retailer.findById(retailerId);
      if (!retailer) {
        return res.status(404).json({
          success: false,
          message: 'Retailer not found'
        });
      }
    }

    // Normalize items: map inventoryItemId to itemId if needed
    const normalizedItems = items.map(item => ({
      ...item,
      itemId: item.itemId || item.inventoryItemId,
      sku: item.sku || '',
      name: item.name || '',
      quantity: parseFloat(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      discount: parseFloat(item.discount) || 0,
      totalPrice: parseFloat(item.totalPrice) || (parseFloat(item.unitPrice) * parseFloat(item.quantity))
    }));

    // Verify all items exist and have sufficient stock
    for (const item of normalizedItems) {
      const inventoryItem = await InventoryItem.findById(item.itemId);
      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: `Inventory item with ID ${item.itemId} not found`
        });
      }

      if (inventoryItem.currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item ${inventoryItem.name}. Available: ${inventoryItem.currentStock}, Requested: ${item.quantity}`
        });
      }
    }

    // Get scope info for running balance calculation
    const scopeType = 'WAREHOUSE';
    const scopeId = req.user.id; // warehouse keeper's ID

    // Get retailer's current running balance
    const previousRunningBalance = await getRetailerRunningBalance(retailerId, scopeType, scopeId);
    console.log('💰 Retailer previous running balance:', previousRunningBalance);

    // Normalize amounts: handle both totalAmount and total, also handle subtotal
    const normalizedSubtotal = parseFloat(req.body.subtotal) || 0;
    const normalizedTaxAmount = parseFloat(req.body.taxAmount) || parseFloat(req.body.tax) || 0;
    const normalizedDiscountAmount = parseFloat(req.body.discountAmount) || parseFloat(req.body.discount) || 0;
    
    const normalizedTotalAmount = totalAmount || parseFloat(req.body.total) || 0;
    const normalizedFinalAmount = finalAmount || normalizedTotalAmount;
    
    // Calculate bill amount
    const billAmount = normalizedFinalAmount || normalizedTotalAmount || (normalizedSubtotal + normalizedTaxAmount - normalizedDiscountAmount);
    const totalWithOutstanding = finalTotal || billAmount;

    // ✅ Payment calculation for different scenarios
    let finalPaymentAmount, finalCreditAmount;

    console.log('💰 Payment calculation - Inputs:', {
        paymentMethod,
        paymentAmount: paymentAmount !== undefined ? parseFloat(paymentAmount) : null,
        creditAmount: creditAmount !== undefined ? parseFloat(creditAmount) : null,
        billAmount,
        totalWithOutstanding,
        previousRunningBalance,
        retailerHasCredit: previousRunningBalance < 0
    });

    if (paymentMethod === 'FULLY_CREDIT') {
        // Scenario: Fully Credit
        finalPaymentAmount = 0;
        finalCreditAmount = billAmount;
        console.log('💰 Scenario - Fully Credit:', { finalPaymentAmount, finalCreditAmount });
    } else if (paymentType === 'BALANCE_PAYMENT' || (paymentAmount !== undefined && parseFloat(paymentAmount) === 0 && creditAmount !== undefined)) {
        // Balance Payment - Retailer uses their available credit balance
        finalPaymentAmount = 0;
        finalCreditAmount = parseFloat(creditAmount) || billAmount;
        console.log('💰 Scenario - Balance Payment:', { 
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
            // No amounts provided - assume full payment
            finalPaymentAmount = billAmount;
            finalCreditAmount = 0;
            console.log('💰 Scenario - Full Payment (default):', { finalPaymentAmount, finalCreditAmount });
        }
    }

    // Handle retailer's previous balance (credit/advance payment)
    let adjustedCreditAmount = finalCreditAmount;
    let adjustedPaymentAmount = finalPaymentAmount;

    // Only auto-adjust if amounts weren't explicitly provided
    const amountsExplicitlyProvided = paymentAmount !== undefined && creditAmount !== undefined;
    
    if (paymentType === 'BALANCE_PAYMENT') {
        console.log('💰 Balance Payment - Using amounts from frontend without adjustment:', {
            finalPaymentAmount,
            finalCreditAmount,
            previousBalance: previousRunningBalance
        });
        adjustedPaymentAmount = finalPaymentAmount;
        adjustedCreditAmount = finalCreditAmount;
    } else if (previousRunningBalance < 0 && !amountsExplicitlyProvided) {
        // Retailer has advance credit - use it for this purchase
        const availableCredit = Math.abs(previousRunningBalance);
        
        console.log('💰 Retailer has advance credit:', {
            previousBalance: previousRunningBalance,
            availableCredit,
            billAmount,
            currentPayment: adjustedPaymentAmount,
            currentCredit: adjustedCreditAmount
        });
        
        if (billAmount <= availableCredit) {
            // Entire purchase can be covered by existing credit
            adjustedPaymentAmount = 0;
            adjustedCreditAmount = -billAmount;
            console.log('💰 Using full credit for purchase');
        } else {
            // Part of purchase covered by credit, rest by payment
            adjustedPaymentAmount = billAmount - availableCredit;
            adjustedCreditAmount = -availableCredit;
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
        if (credit < 0) return 'Using Retailer Credit';
        return 'Mixed Scenario';
    }

    // Payment validation
    let isValid = true;
    let errorMessage = '';

    const amountToCover = totalWithOutstanding;
    
    console.log('💰 Validation amounts:', {
        billAmount,
        totalWithOutstanding,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        using: 'totalWithOutstanding for validation'
    });

    if (finalCreditAmount < 0) {
        // Retailer is using advance credit or overpaying
        const totalCoverage = finalPaymentAmount + finalCreditAmount;
        isValid = Math.abs(totalCoverage - totalWithOutstanding) <= 0.01;
        errorMessage = `Payment (${finalPaymentAmount}) + credit (${finalCreditAmount}) must equal total amount (${totalWithOutstanding})`;
        
        console.log('💰 Overpayment/Credit validation:', {
            billAmount,
            totalWithOutstanding,
            creditAmount: finalCreditAmount,
            paymentAmount: finalPaymentAmount,
            totalCoverage,
            isValid
        });
    } else {
        // Normal case
        const totalCoverage = finalPaymentAmount + finalCreditAmount;
        isValid = Math.abs(totalCoverage - totalWithOutstanding) <= 0.01;
        errorMessage = `Payment amount (${finalPaymentAmount}) + credit amount (${finalCreditAmount}) must equal total amount (${totalWithOutstanding})`;
        
        console.log('💰 Normal payment validation:', {
            billAmount,
            totalWithOutstanding,
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

    // Determine payment status
    let finalPaymentStatus;
    if (paymentStatus) {
        finalPaymentStatus = paymentStatus;
    } else if (paymentType === 'BALANCE_PAYMENT') {
        finalPaymentStatus = 'COMPLETED';
    } else if (paymentMethod === 'FULLY_CREDIT') {
        finalPaymentStatus = 'PENDING';
    } else if (finalCreditAmount > 0) {
        finalPaymentStatus = 'PENDING';
    } else if (finalCreditAmount < 0) {
        finalPaymentStatus = 'COMPLETED';
    } else {
        finalPaymentStatus = 'COMPLETED';
    }

    console.log('💰 Payment status determination:', {
        paymentMethod,
        finalCreditAmount,
        finalPaymentStatus
    });

    // Determine credit status
    const finalCreditStatus = (finalCreditAmount > 0 || finalCreditAmount < 0) ? 'PENDING' : 'NONE';

    // Validate payment amounts
    if (finalPaymentAmount < 0 && totalWithOutstanding > 0) {
        return res.status(400).json({
            success: false,
            message: 'Payment amount cannot be negative when total is positive'
        });
    }

    // Prepare customer info - merge from request with retailer data
    const finalCustomerInfo = customerInfo || {};
    if (retailer) {
      // Ensure name is set - prioritize customerInfo.name, then retailer.name
      finalCustomerInfo.name = finalCustomerInfo.name || retailer.name || (retailerId ? `Retailer ${retailerId}` : 'Walk-in Customer');
      finalCustomerInfo.phone = finalCustomerInfo.phone || retailer.phone || '';
      finalCustomerInfo.id = finalCustomerInfo.id || retailer.id || retailerId;
    } else if (retailerId && !finalCustomerInfo.name) {
      // If no retailer object but we have retailerId, try to fetch retailer name
      try {
        const { pool } = require('../config/database');
        const [retailerRows] = await pool.execute('SELECT name, phone FROM retailers WHERE id = ?', [retailerId]);
        if (retailerRows.length > 0) {
          finalCustomerInfo.name = finalCustomerInfo.name || retailerRows[0].name || `Retailer ${retailerId}`;
          finalCustomerInfo.phone = finalCustomerInfo.phone || retailerRows[0].phone || '';
          finalCustomerInfo.id = retailerId;
        }
      } catch (error) {
        console.error('[WarehouseSalesController] Error fetching retailer:', error);
      }
    }
    
    // Make sure name is always set
    if (!finalCustomerInfo.name) {
      finalCustomerInfo.name = retailerId ? `Retailer ${retailerId}` : 'Walk-in Customer';
    }
    if (!finalCustomerInfo.id && retailerId) {
      finalCustomerInfo.id = retailerId;
    }
    
    // Fetch salesperson name and phone if only salespersonId is provided
    if (salespersonId && (!salespersonName || !salespersonPhone)) {
      try {
        const { pool } = require('../config/database');
        const [salespersonRows] = await pool.execute(
          'SELECT name, phone FROM salespeople WHERE id = ?',
          [salespersonId]
        );
        if (salespersonRows.length > 0) {
          salespersonName = salespersonName || salespersonRows[0].name || null;
          salespersonPhone = salespersonPhone || salespersonRows[0].phone || null;
          console.log('[WarehouseSalesController] Fetched salesperson:', {
            id: salespersonId,
            name: salespersonName,
            phone: salespersonPhone
          });
        }
      } catch (error) {
        console.error('[WarehouseSalesController] Error fetching salesperson:', error);
      }
    }
    
    // Get the actual customer name from customerInfo
    const actualCustomerName = finalCustomerInfo.name;
    console.log('[WarehouseSalesController] Using customer name:', actualCustomerName, 'from customerInfo:', finalCustomerInfo, 'retailerId:', retailerId);
    console.log('[WarehouseSalesController] Salesperson info:', {
      id: salespersonId,
      name: salespersonName,
      phone: salespersonPhone
    });

    // Create warehouse sale
    const saleData = {
      retailerId,
      warehouseKeeperId: req.user.id,
      salespersonId,
      salespersonName,
      salespersonPhone,
      items: normalizedItems,
      totalAmount: normalizedTotalAmount || normalizedSubtotal,
      taxAmount: normalizedTaxAmount,
      discountAmount: normalizedDiscountAmount,
      finalAmount: billAmount,
      paymentMethod,
      paymentAmount: finalPaymentAmount,
      creditAmount: finalCreditAmount,
      notes,
      outstandingPayments,
      customerInfo: finalCustomerInfo // Include customerInfo in saleData
    };

    console.log('[WarehouseSalesController] Creating sale with:', {
        paymentMethod,
        totalWithOutstanding,
        finalPaymentAmount,
        finalCreditAmount,
        finalCreditStatus,
        finalPaymentStatus,
        customerInfo: finalCustomerInfo
    });

    const warehouseSale = await WarehouseSale.create(saleData, actualCustomerName, paymentMethod, paymentTerms);

    // WarehouseSale.create already creates the sales table record with correct data
    

    res.status(201).json({
      success: true,
      message: 'Warehouse sale created successfully',
      data: warehouseSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all warehouse sales
// @route   GET /api/warehouse-sales
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSales = async (req, res, next) => {
  try {
    const {
      retailerId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    const filters = {
      retailerId,
      status,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // If user is warehouse keeper, filter by their sales
    if (req.user.role === 'WAREHOUSE_KEEPER') {
      filters.warehouseKeeperId = req.user.id;
    }

    const sales = await WarehouseSale.findAll(filters);

    res.json({
      success: true,
      count: sales.length,
      data: sales
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single warehouse sale
// @route   GET /api/warehouse-sales/:id
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSale = async (req, res, next) => {
  try {
    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    // Check if user can access this sale
    if (req.user.role === 'WAREHOUSE_KEEPER' && sale.warehouseKeeperId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this warehouse sale'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update warehouse sale
// @route   PUT /api/warehouse-sales/:id
// @access  Private (Admin only)
const updateWarehouseSale = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    const updatedSale = await sale.update(req.body);

    res.json({
      success: true,
      message: 'Warehouse sale updated successfully',
      data: updatedSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete warehouse sale
// @route   DELETE /api/warehouse-sales/:id
// @access  Private (Admin only)
const deleteWarehouseSale = async (req, res, next) => {
  try {
    const sale = await WarehouseSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse sale not found'
      });
    }

    await sale.delete();

    res.json({
      success: true,
      message: 'Warehouse sale deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get warehouse sales summary
// @route   GET /api/warehouse-sales/summary
// @access  Private (Warehouse Keeper, Admin)
const getWarehouseSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // This would need to be implemented with proper SQL queries
    // For now, returning a basic structure
    res.json({
      success: true,
      data: {
        totalSales: 0,
        totalRevenue: 0,
        totalRetailers: 0,
        averageOrderValue: 0,
        topSellingItems: [],
        salesByRetailer: []
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWarehouseSale,
  getWarehouseSales,
  getWarehouseSale,
  updateWarehouseSale,
  deleteWarehouseSale,
  getWarehouseSalesSummary
};
