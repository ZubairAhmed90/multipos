# Customer Credit Scenario - Fixed Implementation

## Scenario: Customer Has Credit and Buys Item

### Example: Adnan has -2500 credit, buys 1300 item

**Expected Results:**
- Outstanding balance after purchase: **-1200** (not -2500)
- Payment amount in ledger: **1300** (item price)
- Balance in ledger: **-1200** (remaining credit)

## What Frontend Sends

```javascript
{
  subtotal: 1300,
  tax: 0,
  discount: 0,
  total: -1200,  // Net balance (old credit + new item)
  paymentAmount: 0,  // No cash payment
  creditAmount: -1200  // Remaining credit
}
```

## What Backend Stores (After Fix)

```javascript
{
  subtotal: 1300,
  tax: 0,
  discount: 0,
  total: 1300,  // Bill amount (item price) ✅
  payment_amount: 1300,  // Item price paid via credit ✅
  credit_amount: -1200  // Remaining credit after purchase ✅
}
```

## The Calculation

### Line ~102: Calculate bill amount
```javascript
const billAmount = finalSubtotal + finalTax - finalDiscount;
// billAmount = 1300 + 0 - 0 = 1300
```

### Line ~228-233: When customer uses credit
```javascript
if (finalTotal < 0) {
  // Customer has credit and is buying items
  finalPaymentAmount = billAmount; // 1300
  finalCreditAmount = finalTotal; // -1200 (remaining credit)
}
```

## Outstanding Query Calculation

The query sums contributions from all transactions:

```sql
SUM(s.total - s.payment_amount) as total_outstanding
```

### For Adnan's Transactions:

#### Transaction 1: Overpayment
- Item: 2500
- Paid: 5000
- **Stored:** `total = 2500`, `payment_amount = 5000`
- **Contribution:** `2500 - 5000 = -2500` ✅

#### Transaction 2: Buy 1300 item with credit
- Item: 1300  
- **Stored:** `total = 1300`, `payment_amount = 1300`
- **Contribution:** `1300 - 1300 = 0` ✅

#### Total Outstanding:
```
-2500 + 0 = -2500 ❌ (Still showing old balance!)
```

## The Problem

When customer uses credit, the contribution becomes 0, so outstanding stays at -2500 instead of updating to -1200.

## Solution: Track Credit Usage Differently

We need to track how much credit was used, not the transaction contribution:

```javascript
// When customer uses credit:
payment_amount = billAmount  // 1300 (item price)
credit_used = billAmount  // 1300 (amount of credit used)
remaining_credit = oldCredit - billAmount  // -2500 - 1300 = -1200
```

But the outstanding query is:
```sql
SUM(total - payment_amount)
```

This gives: `SUM(1300 - 1300) = 0`, which doesn't change the outstanding...

## Better Solution: Store Credit Contribution

Instead of making contribution = 0, we should track the **net change**:

```javascript
// Store:
total: 1300  // Bill amount
payment_amount: 0  // No cash paid (using credit)
credit_amount: -1200  // Remaining credit

// Outstanding calculation:
// Use credit_amount directly, or calculate: oldBalance + (total - payment_amount) - creditUsed
```

Or track it explicitly:
```javascript
credit_used: 1300  // Amount of credit consumed
remaining_credit: -1200  // New credit balance
```

Then outstanding becomes:
```sql
SUM(old_balance + credit_used) 
// = -2500 + 1300 = -1200 ✅
```

## Current Implementation Status

The fix stores:
- `total = 1300` (bill amount)
- `payment_amount = 1300` (via credit)
- `credit_amount = -1200` (remaining)

The outstanding query will calculate:
- Transaction 1: `2500 - 5000 = -2500`
- Transaction 2: `1300 - 1300 = 0`
- **Total: -2500** (doesn't update!)

This is because the outstanding query tracks **contributions per transaction**, not **running balance**.

## Proposed Fix: Change Outstanding Query

Instead of:
```sql
SUM(s.total - s.payment_amount)
```

Use the credit_amount field:
```sql
SELECT s.customer_name,
       SUM(s.credit_amount) as total_outstanding,
       ...
FROM sales s
WHERE s.customer_name = ?
```

This will give:
- Transaction 1: `credit_amount = -2500`
- Transaction 2: `credit_amount = -1200`
- Total: Use latest transaction's credit_amount = -1200 ✅

Or track running balance explicitly:
```sql
SELECT credit_amount 
FROM sales 
WHERE customer_name = ? 
ORDER BY created_at DESC 
LIMIT 1
```

This returns the latest credit_amount (-1200) which is the current outstanding.

## Final Recommendation

**Option 1:** Use latest transaction's credit_amount for outstanding
```javascript
SELECT credit_amount FROM sales WHERE customer_name = ? ORDER BY created_at DESC LIMIT 1
```
Returns: -1200 ✅

**Option 2:** Add separate running_balance field that gets updated on each transaction
```javascript
running_balance = oldBalance + (total - payment_amount)
```

**Option 3:** Change outstanding query logic to account for credit usage differently



