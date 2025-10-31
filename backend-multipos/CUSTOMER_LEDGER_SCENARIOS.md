# Customer Ledger Balance Calculation Scenarios

## Formula
```
New Balance = (Old Balance + Current Bill) - Actual Payment
```

Where:
- **Old Balance**: Previous outstanding balance (negative = customer credit, positive = customer owes)
- **Current Bill**: Amount of items being purchased
- **Actual Payment**: Money paid by customer
- **New Balance**: Resulting outstanding balance

## Scenario 1: Using Credit (Customer Has Existing Credit)

### Transaction:
- Old Balance: **-300** (customer has 300 credit)
- Current Bill: **250**
- Actual Payment: **0** (using credit only)

### Calculation:
```
New Balance = (-300) + 250 - 0 = -50
```

### Result:
- Customer used 250 of their 300 credit
- Remaining credit: **-50**

---

## Scenario 2: Using Credit with Partial Payment

### Transaction:
- Old Balance: **-300** (customer has 300 credit)
- Current Bill: **250**
- Actual Payment: **100** (paying part cash, part credit)

### Calculation:
```
New Balance = (-300) + 250 - 100 = -150
```

### Result:
- Customer paid 100 cash
- Used 150 credit
- Remaining credit: **-150**

---

## Scenario 3: Overpayment (Creates New Credit)

### Transaction:
- Old Balance: **1000** (customer owes 1000)
- Current Bill: **500**
- Actual Payment: **2000** (customer overpaid)

### Calculation:
```
New Balance = 1000 + 500 - 2000 = -500
```

### Result:
- Customer owed 1500 total
- Paid 2000 (500 extra)
- Now has **-500** credit

---

## Scenario 4: Building Debt (Normal Purchase)

### Transaction:
- Old Balance: **1000** (customer owes 1000)
- Current Bill: **500**
- Actual Payment: **200** (partial payment)

### Calculation:
```
New Balance = 1000 + 500 - 200 = 1300
```

### Result:
- Customer now owes **1300**
- Debt increased by 300

---

## Scenario 5: Paying Off Debt

### Transaction:
- Old Balance: **1000** (customer owes 1000)
- Current Bill: **500**
- Actual Payment: **1500** (full payment)

### Calculation:
```
New Balance = 1000 + 500 - 1500 = 0
```

### Result:
- Debt fully paid
- Balance: **0**

---

## Scenario 6: Creating Credit from Negative

### Transaction:
- Old Balance: **-500** (customer has 500 credit)
- Current Bill: **300**
- Actual Payment: **0** (using credit only)

### Calculation:
```
New Balance = -500 + 300 - 0 = -200
```

### Result:
- Customer used 200 credit
- Remaining credit: **-200**

---

## Scenario 7: Overpayment from Negative Balance

### Transaction:
- Old Balance: **-300** (customer has 300 credit)
- Current Bill: **250**
- Actual Payment: **250** (paying in cash)

### Calculation:
```
New Balance = -300 + 250 - 250 = -300
```

### Result:
- Customer paid 250 cash
- Credit unchanged: **-300**

---

## Payment Types Reference

### 1. FULL_PAYMENT
- **Payment**: Full amount of the bill
- **Credit Usage**: None
- **Result**: Customer owes: Old Balance - Payment

### 2. PARTIAL_PAYMENT
- **Payment**: Less than bill amount
- **Credit Usage**: Bill - Payment (if customer has credit)
- **Result**: Debt increases by (Bill - Payment)

### 3. FULLY_CREDIT
- **Payment**: 0
- **Credit Usage**: Full bill amount
- **Result**: Uses credit only

### 4. BALANCE_PAYMENT
- **Payment**: Uses existing credit
- **Credit Usage**: Bill amount (from credit)
- **Result**: Credit decreases by Bill amount

---

## Implementation in Customer Ledger

### Key Functions:
1. **`getCustomerLedger`** (Line ~200): Calculates running balance for summary view
2. **`getDetailedCustomerLedgerData`** (Line ~850): Calculates running balance for detailed transaction list

### Current Formula (Line 232):
```javascript
runningBalance = totalAmountDue - actualPayment;
```

Where:
- `totalAmountDue = oldBalance + currentBillAmount`
- `actualPayment = parseFloat(paid_amount || 0)`

### Special Cases:

#### FULLY_CREDIT Payment (Line 224-226):
```javascript
if (transaction.payment_method === 'FULLY_CREDIT') {
  actualPayment = 0; // No cash payment
}
```

#### Negative Payment Handling (Line 875-878):
```javascript
if (actualPayment < 0) {
  // Negative payment means customer is using credit
  runningBalance = oldBalance + currentBillAmount;
}
```

---

## Testing Scenarios

### Test Case 1: Ali Hassa
- **Transaction 1**: Buy 2500, pay 5000 → Balance: -2500
- **Transaction 2**: Buy 280, pay 0 → Balance: -2220
- **Expected**: Final balance -2220 (credit)

### Test Case 2: Adnan
- **Transaction 1**: Buy 2500, pay 5000 → Balance: -2500
- **Transaction 2**: Buy 280, pay 0 → Balance: -2220
- **Transaction 3**: Buy 1500, pay 0 → Balance: -720
- **Expected**: Final balance -720 (credit)

### Test Case 3: Standard Customer
- **Transaction 1**: Buy 1000, pay 0 → Balance: 1000
- **Transaction 2**: Buy 500, pay 200 → Balance: 1300
- **Transaction 3**: Buy 300, pay 1500 → Balance: 100
- **Expected**: Final balance 100 (owes)

---

## Database Storage

### Fields Used:
- `total` / `amount`: Bill amount
- `payment_amount`: Actual payment made
- `credit_amount`: Credit used (stored for reference)
- `total_outstanding`: Calculated as `total - payment_amount`

### How Outstanding is Calculated:
```sql
SELECT SUM(total - payment_amount) as total_outstanding
FROM sales
WHERE customer_id = ?
```

This gives the **net outstanding balance** (can be negative for credit).

