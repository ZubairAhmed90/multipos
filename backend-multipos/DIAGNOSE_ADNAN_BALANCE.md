# Diagnosing Adnan's Balance Issue

## Current Status
- **Outstanding Query Shows:** -2500
- **Expected After Latest Transaction:** -1000
- **Issue:** Running balance not updating correctly after credit usage

## Transaction History

### Transaction 1 (PTZL-000062)
- **Amount:** 2500 (item purchase)
- **Paid:** 5000 (overpayment)
- **Stored as:** total = -2500 OR total = 2500, payment = 5000
- **Result:** Balance = -2500 (credit)

### Transaction 2 (PTZL-000063)
- **Amount:** 280 (item purchase)
- **Old Balance:** -2500
- **Expected:** Balance = -2220
- **Stored as:** total = ? payment = ?

### Transaction 3 (PTZL-000064)
- **Amount:** 1500 (item purchase)
- **Old Balance:** -2220  
- **Expected:** Balance = -720
- **Stored as:** total = ? payment = ?

### Transaction 4 (PTZL-000065) - Latest
- **Amount:** -1000 (shown in test output)
- **Paid:** -1000
- **Running Balance:** -2500
- **Issue:** This balance is incorrect

## The Problem

The `searchOutstandingPayments` query uses:
```sql
SUM(s.total - s.payment_amount) as total_outstanding
```

This sums ALL transactions for the customer. For this to work correctly, each transaction must store its **contribution** to the outstanding balance, not the **absolute balance**.

## How It Should Work

### Option 1: Store Net Transaction Amount
For each sale, store:
- `total`: Item price
- `payment_amount`: Payment made
- `outstanding_contribution`: total - payment_amount (can be negative for credit usage)

Then `SUM(outstanding_contribution)` gives current balance.

### Option 2: Store Running Balance
For each sale, store:
- `total`: Item price  
- `payment_amount`: Payment made
- `running_balance`: Previous balance + (total - payment_amount)

Then get balance from the latest transaction's `running_balance`.

## Current Issue

When Adnan uses credit to buy a 1500 item:
- Previous balance: -2500
- Should store: total = 1500, payment = 0, outstanding_contribution = 1500
- Expected sum: -2500 + 1500 = -1000

But the database might be storing:
- total = -1000, payment = -1000
- outstanding_contribution = -1000 - (-1000) = 0
- Sum remains: -2500 (incorrect!)

## Root Cause

The issue is in how the sale is being created when using credit:

1. Frontend sends: total = 1500, paymentAmount = 0
2. Backend calculates: creditAmount = oldCredit - newAmount
3. But might be storing: total = -1500, payment_amount = -1500 (incorrect!)

## Solution

Check the `createSale` function in `salesController.js`:
- When customer has credit and buys item
- Should store: `total = itemPrice`, `payment_amount = 0`, `credit_amount = newCreditAmount`
- NOT: `total = -itemPrice`, `payment_amount = -itemPrice`

## Next Steps

1. Check what values are being stored in database for Adnan's transactions
2. Verify the `createSale` logic handles credit usage correctly
3. Ensure running balance is calculated as: oldBalance + (total - payment_amount)

