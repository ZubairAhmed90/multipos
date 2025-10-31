# Customer Ledger Balance Calculation - Verification Report

## Formula Used
```javascript
New Balance = (Old Balance + Current Bill) - Actual Payment
```

Or more specifically:
```javascript
runningBalance = totalAmountDue - actualPayment;
// where totalAmountDue = oldBalance + currentBillAmount
```

## Implementation Status

### ✅ Implemented in Two Functions

#### 1. `getCustomerLedger` (Summary View)
- **Location**: Lines 228-245 in `customerLedgerController.js`
- **Purpose**: Calculate running balance for summary
- **Formula**: `runningBalance = totalAmountDue - actualPayment`

#### 2. `getDetailedCustomerLedgerData` (Detailed View)
- **Location**: Lines 874-889 in `customerLedgerController.js`
- **Purpose**: Calculate running balance for detailed transaction list
- **Formula**: `runningBalance = totalAmountDue - actualPayment`

### ✅ Special Cases Handled

#### 1. FULLY_CREDIT Payment
```javascript
if (transaction.payment_method === 'FULLY_CREDIT') {
  actualPayment = 0; // No cash payment
}
```

#### 2. Negative Payment (Credit Usage)
```javascript
if (actualPayment < 0) {
  // Balance = old balance + current bill
  runningBalance = oldBalance + currentBillAmount;
}
```

#### 3. RETURN Transactions
```javascript
else if (transaction.transaction_type === 'RETURN') {
  runningBalance = oldBalance - Math.abs(amount);
}
```

## Test Results

All 7 scenarios were tested and verified:

### ✅ Scenario 1: Using Credit
- Input: Balance -300, Bill 250, Payment 0
- Result: **-50** ✓

### ✅ Scenario 2: Using Credit with Partial Payment
- Input: Balance -300, Bill 250, Payment 100
- Result: **-150** ✓

### ✅ Scenario 3: Overpayment
- Input: Balance 1000, Bill 500, Payment 2000
- Result: **-500** ✓

### ✅ Scenario 4: Building Debt
- Input: Balance 1000, Bill 500, Payment 200
- Result: **1300** ✓

### ✅ Scenario 5: Paying Off Debt
- Input: Balance 1000, Bill 500, Payment 1500
- Result: **0** ✓

### ✅ Scenario 6: Creating Credit from Negative
- Input: Balance -500, Bill 300, Payment 0
- Result: **-200** ✓

### ✅ Scenario 7: Paying Cash when Customer Has Credit
- Input: Balance -300, Bill 250, Payment 250
- Result: **-300** ✓

## Payment Types Supported

### 1. FULL_PAYMENT
- Customer pays full amount
- Uses actual payment amount

### 2. PARTIAL_PAYMENT
- Customer pays less than bill
- Debt increases by unpaid amount

### 3. FULLY_CREDIT
- No cash payment
- Uses existing credit only

### 4. BALANCE_PAYMENT
- Uses credit balance
- Payment uses credit

## Database Integration

### Outstanding Balance Query
The system uses this SQL to calculate current outstanding:
```sql
SELECT SUM(total - payment_amount) as total_outstanding
FROM sales
WHERE customer_id = ?
```

This matches the formula used in the ledger calculation.

## Conclusion

✅ **The customer ledger correctly implements all balance calculation scenarios.**

The formula `New Balance = (Old Balance + Current Bill) - Actual Payment` is:
- Correctly implemented in both ledger functions
- Properly handling all payment types
- Supporting both positive (debt) and negative (credit) balances
- Creating new credit when customers overpay
- Reducing credit when customers use it

All test scenarios pass verification.



