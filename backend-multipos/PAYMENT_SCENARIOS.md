# Payment Scenarios Documentation

## Overview
The sales controller handles 5 main payment scenarios plus overpayment scenarios. Each scenario calculates payment amounts, credit amounts, and running balance differently.

## Common Variables
- `billAmount`: Cart total (subtotal + tax - discount)
- `finalTotal`: Cart + outstanding balance
- `previousRunningBalance`: Customer's existing balance from ledger
  - Positive: Customer owes money (outstanding)
  - Negative: Customer has credit balance
- `finalPaymentAmount`: Cash payment in this transaction
- `finalCreditAmount`: Credit amount for this transaction
- `runningBalance`: Updated balance after transaction
  - Formula: `runningBalance = previousRunningBalance + finalCreditAmount`

---

## Scenario 1: Full Payment (Default)
**When**: No payment amounts specified, not FULLY_CREDIT  
**Description**: Customer pays the full bill amount in cash

**Calculations**:
- `paymentAmount` = `billAmount`
- `creditAmount` = 0
- `runningBalance` = `previousBalance + 0`

**Example**:
- Bill: 5,000
- Previous Balance: +500 (owes)
- Payment: 5,000
- Credit: 0
- Running Balance: +500 (still owes)

---

## Scenario 2: Partial Payment
**When**: Both `paymentAmount` and `creditAmount` explicitly provided by frontend  
**Description**: Customer pays part now, owes remainder

**Calculations**:
- `paymentAmount` = provided value
- `creditAmount` = provided value
- `runningBalance` = `previousBalance + creditAmount`

**Example**:
- Bill: 5,000
- Previous Balance: +1,000 (owes)
- Payment: 2,000
- Credit: 3,000
- Running Balance: +1,000 + 3,000 = +4,000 (owes more)

**Validation**: `paymentAmount + creditAmount = finalTotal`

---

## Scenario 3: Using Customer Credit (Auto-Adjust)
**When**: Customer has `previousBalance < 0` (credit) AND amounts NOT explicitly provided  
**Description**: System automatically uses customer's credit balance

**Calculations**:

### Case A: Full Credit Usage (Bill ≤ Available Credit)
- `availableCredit` = |previousBalance| (e.g., 1,000)
- If `billAmount <= availableCredit`:
  - `paymentAmount` = 0
  - `creditAmount` = -billAmount
  - `runningBalance` = previousBalance - billAmount

**Example**:
- Bill: 800
- Previous Balance: -1,000 (has credit)
- Payment: 0
- Credit: -800 (using 800 from balance)
- Running Balance: -1,000 + (-800) = -1,800 ❌ WRONG!

Wait, the formula is:
```
runningBalance = previousBalance + finalCreditAmount
runningBalance = -1,000 + (-800) = -1,800
```

But logically it should be: if customer has -1,000 and uses 800, remaining = -200

Let me recalculate...

Actually: if `previousBalance = -1,000` and customer uses 800:
- The credit amount recorded should be the amount OWED (not used)
- If customer had -1,000 credit and purchases 800:
  - Old balance: -1,000
  - Purchase: +800 owed
  - New balance: -1,000 + 800 = -200

So `finalCreditAmount = +800` (customer now owes 800 more than before)
- Payment: 0 (used from balance)
- Credit: +800 (added to debt)
- Running Balance: -1,000 + 800 = -200 ✅

### Case B: Partial Credit Usage (Bill > Available Credit)
- If `billAmount > availableCredit`:
  - `paymentAmount` = billAmount - availableCredit
  - `creditAmount` = -availableCredit
  - `runningBalance` = previousBalance - availableCredit

**Example**:
- Bill: 1,500
- Previous Balance: -1,000 (has credit)
- Payment: 500 (customer pays difference)
- Credit: -1,000 (used all credit)
- Running Balance: -1,000 + (-1,000) = -2,000 ❌ WRONG!

Wait, this is also wrong. Let me think...

If customer has -1,000 credit and buys 1,500:
- They use 1,000 from credit
- They pay 500 cash
- They now owe 500 (or -500 credit)
- New balance: -1,000 + 500 = -500

But the code says:
```
runningBalance = previousBalance + finalCreditAmount
runningBalance = -1,000 + (-1,000) = -2,000
```

This doesn't match logic...

---

## Scenario 4: Fully Credit
**When**: `paymentMethod === 'FULLY_CREDIT'`  
**Description**: Customer takes items on complete credit

**Calculations**:
- `paymentAmount` = 0
- `creditAmount` = billAmount
- `runningBalance` = previousBalance + billAmount

**Example**:
- Bill: 5,000
- Previous Balance: +2,000 (owes)
- Payment: 0
- Credit: +5,000 (now owes 5,000 more)
- Running Balance: +2,000 + 5,000 = +7,000 (owes more)

**Status**: PENDING

---

## Scenario 5: Balance Payment (NEW)
**When**: `paymentType === 'BALANCE_PAYMENT'` OR (`paymentAmount === 0` AND `creditAmount` is set)  
**Description**: Customer uses their available credit balance

**Calculations**:
- `paymentAmount` = 0
- `creditAmount` = billAmount (or provided value)
- `runningBalance` = previousBalance + billAmount

**Example**:
- Bill: 500
- Previous Balance: -1,000 (has credit)
- Payment: 0
- Credit: +500 (uses 500 from balance)
- Running Balance: -1,000 + 500 = -500 (remaining credit)

**Status**: COMPLETED

---

## Overpayment Scenarios

### Customer Overpays When They Have Outstanding Balance
**When**: Customer owes money but pays more than bill

**Example**:
- Bill: 1,100
- Previous Balance: +500 (owes)
- Customer Pays: 7,000
- Credit: -5,900 (overpayment creates negative credit = credit balance)
- Running Balance: +500 + (-5,900) = -5,400 (has credit)

**Validation**: `7000 + (-5900) = 1100` ✅ equals bill amount

---

### Customer Overpays When They Have Credit Balance
**When**: Customer already has credit and pays more

**Example**:
- Bill: 5,700
- Previous Balance: -300 (has credit)
- Customer Pays: 5,700
- Credit: -300 (using previous credit)
- Net Payment Needed: 5,700 - 300 = 5,400
- Total Coverage: 5,700 + (-300) = 5,400 ✅ equals net bill

**Running Balance**: -300 + (-300) = -600 (has more credit)

---

## Payment Status Logic

The system determines payment status based on:

1. **BALANCE_PAYMENT** → COMPLETED (using credit balance)
2. **FULLY_CREDIT** → PENDING (customer owes)
3. **creditAmount > 0** → PENDING (customer still owes money)
4. **creditAmount < 0** → COMPLETED (customer has advance credit)
5. **creditAmount = 0** → COMPLETED (exactly balanced)

---

## Critical Issues Found

### Issue 1: Scenario 3 Logic Error
Lines 278-300: When customer has credit balance and auto-adjust is used, the running balance calculation is **WRONG**.

**Current Logic**:
```javascript
adjustedCreditAmount = -billAmount;  // e.g., -800
runningBalance = previousRunningBalance + finalCreditAmount;
runningBalance = -1000 + (-800) = -1800  // WRONG!
```

**Expected Logic**:
If customer has -1000 credit and purchases 800 using balance:
- They should use 800 from their -1000 credit
- Remaining balance should be -200
- But `runningBalance = -1000 + 800 = -200` (not -800 as negative credit)

**Fix Needed**: The credit amount should represent the net change in balance, not a negative value.

### Issue 2: Balance Payment vs Credit Usage Confusion
Balance Payment (Scenario 5) and Credit Usage (Scenario 3) have **overlapping logic** that may conflict.

**Scenario 3** (auto-adjust) is triggered when:
- `previousRunningBalance < 0`
- Amounts NOT explicitly provided

**Scenario 5** (balance payment) is triggered when:
- `paymentType === 'BALANCE_PAYMENT'`
- OR (`paymentAmount === 0` AND `creditAmount` is set)

Both scenarios handle "using customer's credit balance" differently!

---

## Recommendations

1. **Clarify Scenario 3 Logic**: The running balance calculation needs review
2. **Unify Scenarios 3 & 5**: Consider merging Balance Payment and Credit Usage auto-adjust
3. **Add Validation**: Ensure scenarios don't conflict with each other
4. **Fix Negative Credit Logic**: When using credit balance, the credit amount should be positive (debt added), not negative



