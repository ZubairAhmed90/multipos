# Balance Calculation Summary

## Core Formula (Used Everywhere)

```javascript
New Balance = (Old Balance + Current Bill) - Actual Payment
```

## Implementation

### ✅ POS Terminal → Sales Controller → Customer Ledger

All three components use the **same formula**:

1. **POS Terminal**: Calculates and displays running balance
2. **Sales Controller**: Stores running balance in database
3. **Customer Ledger**: Reads and displays running balance

## Code Locations

### POS Terminal
- **File**: `multipos/frontend-multipos/app/dashboard/pos/terminal/page.js`
- **Lines**: 1861-1874, 4677-4761
- **Function**: Calculate payment amounts and send to backend

### Sales Controller
- **File**: `multipos/backend-multipos/controllers/salesController.js`
- **Lines**: 318-319
- **Function**: Store payment data and calculate running balance
```javascript
const newCreditAmount = billAmount - finalPaymentAmount;
const runningBalance = previousRunningBalance + newCreditAmount;
```

### Customer Ledger Controller
- **File**: `multipos/backend-multipos/controllers/customerLedgerController.js`
- **Lines**: 228-245, 874-889
- **Function**: Calculate running balance from stored transactions
```javascript
const totalAmountDue = oldBalance + currentBillAmount;
runningBalance = totalAmountDue - actualPayment;
```

## Payment Scenarios

### 1. Using Credit (Balance Payment)
- **Old Balance**: -300 (customer has 300 credit)
- **Current Bill**: 250
- **Payment**: 0
- **Formula**: (-300) + 250 - 0 = **-50** ✅

### 2. Using Credit with Partial Payment
- **Old Balance**: -300
- **Current Bill**: 250
- **Payment**: 100
- **Formula**: (-300) + 250 - 100 = **-150** ✅

### 3. Overpayment (Creates New Credit)
- **Old Balance**: 1000
- **Current Bill**: 500
- **Payment**: 2000
- **Formula**: 1000 + 500 - 2000 = **-500** ✅

### 4. Building Debt
- **Old Balance**: 1000
- **Current Bill**: 500
- **Payment**: 200
- **Formula**: 1000 + 500 - 200 = **1300** ✅

### 5. Paying Off Debt
- **Old Balance**: 1000
- **Current Bill**: 500
- **Payment**: 1500
- **Formula**: 1000 + 500 - 1500 = **0** ✅

### 6. Creating Credit from Negative
- **Old Balance**: -500
- **Current Bill**: 300
- **Payment**: 0
- **Formula**: -500 + 300 - 0 = **-200** ✅

### 7. Paying Cash when Customer Has Credit
- **Old Balance**: -300
- **Current Bill**: 250
- **Payment**: 250
- **Formula**: -300 + 250 - 250 = **-300** ✅

## Payment Types

### 1. FULL_PAYMENT
```javascript
paymentAmount = billAmount
creditAmount = 0
```

### 2. PARTIAL_PAYMENT
```javascript
paymentAmount = userInput
creditAmount = billAmount - userInput
```

### 3. FULLY_CREDIT
```javascript
paymentAmount = 0
creditAmount = billAmount
```

### 4. BALANCE_PAYMENT
```javascript
paymentAmount = 0
creditAmount = billAmount // Uses from customer's credit balance
```

## Key Variables

### In POS Terminal:
- `outstandingTotal`: Customer's current balance
- `billAmount`: Current cart total
- `totalWithOutstanding`: billAmount + outstandingTotal
- `paymentAmount`: Actual payment made
- `creditAmount`: Credit used

### In Sales Controller:
- `previousRunningBalance`: Customer's balance before this transaction
- `billAmount`: Total bill amount
- `finalPaymentAmount`: Actual payment
- `finalCreditAmount`: Credit amount
- `runningBalance`: New balance after transaction

### In Customer Ledger:
- `oldBalance`: Balance from previous transaction
- `currentBillAmount`: Bill amount for this transaction
- `actualPayment`: Payment made
- `runningBalance`: New balance

## Formula Equivalence

### Sales Controller:
```javascript
runningBalance = previousRunningBalance + (billAmount - finalPaymentAmount)
```

### Rearranged:
```javascript
runningBalance = (previousRunningBalance + billAmount) - finalPaymentAmount
```

### Customer Ledger:
```javascript
runningBalance = (oldBalance + currentBillAmount) - actualPayment
```

### ✅ Both formulas are equivalent!

## Database Storage

### Fields Stored:
- `total` / `amount`: Bill amount
- `payment_amount`: Actual payment made
- `credit_amount`: Credit given/used
- `running_balance`: Calculated balance after transaction

### Outstanding Balance Calculation:
```sql
SELECT SUM(total - payment_amount) as total_outstanding
FROM sales
WHERE customer_id = ?
```

This matches the running balance formula when read from transactions.

## Verification

✅ All 7 scenarios tested and verified
✅ Formula consistent across POS, Sales Controller, and Customer Ledger
✅ Payment types (FULL_PAYMENT, PARTIAL_PAYMENT, FULLY_CREDIT, BALANCE_PAYMENT) handled correctly
✅ Both positive (debt) and negative (credit) balances supported


