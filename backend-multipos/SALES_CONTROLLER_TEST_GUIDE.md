# Sales Controller Test Guide

## Overview
This document describes the test scenarios for the Sales Controller, specifically focusing on how it handles different customer payment scenarios, including negative outstanding balances (credits).

## Test Files

### 1. `test-sales-controller-comprehensive.js`
Tests various sale creation scenarios including:
- Normal sale with full payment
- Customer with credit buying item less than credit
- Customer with credit buying item more than credit  
- Overpayment scenarios

**Usage:**
```bash
node test-sales-controller-comprehensive.js
```

### 2. `test-sales-scenarios-real.js`
Tests real customer scenarios with actual data:
- Outstanding queries for Adnan, hassan, ali, shoaib
- Customer ledger retrieval
- Balance calculations

**Usage:**
```bash
node test-sales-scenarios-real.js
```

### 3. `test-adnan-customer.js`
Focused test for Adnan's specific case:
- Outstanding query comparison
- Ledger calculation verification

**Usage:**
```bash
node test-adnan-customer.js
```

## Key Scenarios Being Tested

### Scenario 1: Normal Sale
- Customer buys item
- Pays full amount
- No outstanding balance
- **Expected:** Payment completed, balance = 0

### Scenario 2: Customer Has Credit (Negative Outstanding)
- Customer has -2800 credit (overpaid previously)
- Buys 1300 item
- **Expected:** No cash payment, remaining credit = -1500

**Logic:**
```
Old Balance: -2800 (credit)
Current Bill: 1300
Total Due: 1300 - 2800 = -1500
Payment: 0
Remaining Credit: -1500
```

### Scenario 3: Customer Has Partial Credit
- Customer has -2800 credit
- Buys 3500 item (more than credit)
- **Expected:** Customer pays 700, credit used up

**Logic:**
```
Old Balance: -2800 (credit)
Current Bill: 3500
Total Due: 3500 - 2800 = 700
Payment: 700
Remaining Credit: 0
```

### Scenario 4: Overpayment
- Customer buys 2000 item
- Pays 7000 (overpays by 5000)
- **Expected:** Creates -5000 credit

**Logic:**
```
Current Bill: 2000
Payment: 7000
Credit Created: 2000 - 7000 = -5000
Remaining Credit: -5000
```

## Balance Calculation Formula

The key formula used by both outstanding query and customer ledger:

```javascript
runningBalance = oldBalance + (total - payment_amount)
```

This formula:
1. ✅ Handles positive outstanding (customer owes money)
2. ✅ Handles negative outstanding (customer has credit)
3. ✅ Correctly accumulates across transactions
4. ✅ Aligns between POS and Ledger views

## Testing Process

### Before Testing
1. Ensure backend server is running on `https://multiposserver.petzone.pk`
2. Update credentials in test files if needed:
   ```javascript
   const TEST_USER = {
     email: 'khurram@petzone.com',
     password: 'Khurram55000'
   };
   ```

### Running Tests

#### Test Outstanding Queries
```bash
cd multipos/backend-multipos
node test-sales-scenarios-real.js
```

This will:
- Login with admin credentials
- Query outstanding payments for multiple customers
- Show both positive and negative balances
- Display customer ledger information

#### Test Sale Creation
```bash
node test-sales-controller-comprehensive.js
```

This will:
- Login with admin credentials  
- Create test sales (commented out by default)
- Verify payment calculations
- Check credit amounts

**Note:** Sales creation is commented out by default to avoid creating test data. Uncomment in the code to actually create sales.

## Expected Results

### Outstanding Query
For Adnan:
- **POS should show:** -2500 (credit)
- **Ledger should show:** -2500 (credit)
- Both should match after the fix

### Customer Ledger
Shows:
- All transactions for customer
- Running balance for each transaction
- Final outstanding balance
- Transaction details (amount, payment, credit)

## Common Issues

### Issue 1: Ledger shows 0 but POS shows -2500
**Cause:** Ledger calculation was using different formula
**Fix:** Updated `customerLedgerController.js` to use same formula as `searchOutstandingPayments`

### Issue 2: Outstanding not showing for customer
**Cause:** Query filtering by payment status
**Fix:** Removed status filter to include all transactions with `(total - payment_amount) != 0`

### Issue 3: Negative balances not being handled
**Cause:** Validation middleware blocking negative values
**Fix:** Updated validation to allow negative credit amounts

## Verification Checklist

After uploading fixes to server, verify:

- [ ] Adnan's outstanding shows -2500 in POS
- [ ] Adnan's ledger shows -2500 balance
- [ ] POS and Ledger values match
- [ ] Other customers' balances are correct
- [ ] No console errors in browser
- [ ] Server logs show correct calculations

## Debug Information

Enable debug logging in controllers:
```javascript
console.log(`🔍 Balance Calculation:`, {
  oldBalance,
  total,
  paid,
  calculated: total - paid,
  newRunningBalance: runningBalance
});
```

This will show how the balance is calculated for each transaction.

## Next Steps

1. Upload `customerLedgerController.js` to server
2. Restart Node.js application  
3. Run test scripts to verify
4. Check customer ledgers in UI
5. Verify POS outstanding payments


