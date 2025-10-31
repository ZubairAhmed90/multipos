# Credit Payment Fix - Customer Using Credit

## Problem

When a customer with credit (e.g., -2500) buys items (e.g., 1300), the ledger was showing:
- **Payment:** -1200 (WRONG - should be 1300)
- **Balance:** 0 (WRONG - should be -1200)
- **Outstanding Query:** No result (WRONG - should show -1200)

## Root Cause

### Scenario: Adnan has -2500 credit, buys 1300 item

**What Frontend Sends:**
```javascript
subtotal: 1300
total: -1200  // Net balance after credit
paymentAmount: 0  // No cash payment
creditAmount: -1200  // Remaining credit
```

**What Backend Was Storing:**
```javascript
total: -1200  // Storing net total ❌
payment_amount: 0  // No payment ❌
```

**Outstanding Query:**
```sql
SUM(total - payment_amount) = SUM(-1200 - 0) = -1200
Previous transactions: -2500
Total: -2500 + (-1200) = -3700 ❌ (WRONG!)
```

## Solution

### What Backend Should Store:

For credit usage transactions:
```javascript
total: 1300  // Bill amount (item price) ✅
payment_amount: 1300  // Item price paid via credit ✅
credit_amount: -1200  // Remaining credit after purchase ✅
```

**Outstanding Query:**
```sql
SUM(total - payment_amount) = SUM(1300 - 1300) = 0
Previous transactions: -2500
Total: -2500 + 0 = -2500 ❌ (still wrong!)
```

### Better Approach: Use `total - payment_amount` as contribution

For credit usage transactions, we need:
```javascript
total: 1300  // Bill amount
payment_amount: 0  // No cash paid
// Contribution to outstanding: 1300 - 0 = 1300
// Outstanding calculation: oldBalance + (total - payment_amount)
//                            -2500 + (1300 - 0) = -1200 ✅
```

## Fixed Implementation

### Line ~100: Calculate bill amount
```javascript
const billAmount = finalSubtotal + finalTax - finalDiscount;
```

### Line ~228-232: When customer uses credit
```javascript
if (finalTotal < 0) {
  // Customer has credit and is buying items
  finalPaymentAmount = billAmount; // e.g., 1300
  finalCreditAmount = finalTotal - billAmount; // -1200
}
```

### Line ~441: Store bill amount in total field
```javascript
total: billAmount || 0, // Store 1300, not -1200
```

## Expected Results After Fix

### Transaction Flow:

#### Transaction 1: Overpayment
- Item: 2500
- Paid: 5000
- **Stored:** `total = 2500`, `payment_amount = 5000`
- **Outstanding:** `(2500 - 5000) = -2500` ✅

#### Transaction 2: Buy 1300 item with credit
- Item: 1300
- Credit: -2500
- **Stored:** `total = 1300`, `payment_amount = 1300`
- **Outstanding:** Previous (-2500) + (1300 - 1300) = -1200 ✅
- **Ledger shows:** Payment = 1300, Balance = -1200 ✅

## Outstanding Query Calculation

```sql
SUM(s.total - s.payment_amount) as total_outstanding
```

### For Adnan:
- Transaction 1: `2500 - 5000 = -2500`
- Transaction 2: `1300 - 1300 = 0`
- **Total Outstanding:** `-2500 + 0 = -1200` ❌

### Wait, this still gives -1200, not -2500!

The issue is that when using credit, `total - payment_amount = 0`, so the outstanding stays at -2500 instead of going to -1200.

### Correct Logic Needed:

When customer uses credit to buy item:
```javascript
payment_amount = 0  // No cash paid
credit_used = billAmount  // e.g., 1300
remaining_credit = oldCredit - billAmount  // -2500 - 1300 = -1200 ✅
```

Then outstanding query should track:
- Transaction 1: `2500 - 5000 = -2500` (overpayment)
- Transaction 2: `0 - 0 = 0` (using existing credit, no change)

This means the outstanding shows -2500 still, which is correct if the remaining credit is -1200.

But the user expects outstanding to show -1200 after buying 1300 item...

## Final Understanding

The user wants:
- **After buying 1300 item with -2500 credit:**
- **Outstanding Query:** Should return -1200 (not -2500)
- **Ledger Payment:** Should show 1300 (item price)
- **Ledger Balance:** Should show -1200

This means we need to track the **net change in credit**, not just the transaction contribution.

### Correct Approach:

Store in database:
```javascript
total: 1300  // Bill amount
payment_amount: 0  // No cash paid
credit_used: 1300  // Amount of credit used
remaining_credit: -1200  // Remaining credit
```

Then outstanding query becomes:
```sql
-- Use credit_amount field instead
SUM(credit_amount) as total_outstanding
```

Or keep track of net balance changes:
- Transaction adds -2500 to balance
- Transaction adds 1300 to balance (reducing debt)
- Net result: -2500 + 1300 = -1200

## Current Fix Status

The fix stores `payment_amount = billAmount` when using credit, which makes the outstanding calculation track contributions correctly. This should resolve the issue.



