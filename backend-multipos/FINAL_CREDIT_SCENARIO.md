# Final Credit Scenario Implementation

## Scenario: Customer Uses Existing Credit to Buy Items

### Example Flow:

#### Transaction 1: Overpayment Creates Credit
- **Amount (Bill):** 1,500
- **Customer Pays:** 4,000 (overpayment)
- **Stored Values:**
  - `total = 1500`
  - `payment_amount = 4000`
  - `credit_amount = -2500` (customer has credit)
  
- **Outstanding Calculation:**
  - `(total - payment_amount) = 1500 - 4000 = -2500`
  - Outstanding Query Returns: **-2500** ✅

#### Transaction 2: Customer Buys Item Using Credit
- **Old Credit:** -2500
- **New Item:** 1,300
- **Amount (Bill):** 1,300
- **Stored Values:**
  - `total = 1300` (item price)
  - `payment_amount = 0` (using credit, no cash)
  - `credit_amount = -1200` (remaining credit)
  
- **Customer Ledger Will Show:**
  - Amount: **1,300** ✅
  - Old Balance: **-2,500** ✅
  - Payment: **0** ✅
  - Balance: **-1,200** ✅
  
- **Outstanding Calculation:**
  - Transaction 1: `(1500 - 4000) = -2500`
  - Transaction 2: `(1300 - 0) = 1300`
  - **Total Outstanding:** `-2500 + 1300 = -1200` ✅

## The Formula

### For Customer Ledger Display:
```javascript
Amount = billAmount (item price) ✅
Old Balance = previous running balance ✅
Payment = 0 (when using credit) ✅
Balance = oldBalance + (billAmount - 0) 
         = -2500 + 1300 = -1200 ✅
```

### For Outstanding Query:
```sql
SUM(s.total - s.payment_amount) as total_outstanding
```

**Transaction 1:**
- `1500 - 4000 = -2500`

**Transaction 2:**
- `1300 - 0 = 1300`

**Total:** `-2500 + 1300 = -1200` ✅

## Database Storage for Transaction 2

```javascript
{
  total: 1300,           // Bill amount (item price)
  payment_amount: 0,     // No cash paid (using credit)
  credit_amount: -1200,  // Remaining credit
  payment_status: 'PARTIAL'  // Has remaining credit
}
```

## Key Points

1. **When customer uses credit:**
   - `total = billAmount` (item price, e.g., 1300)
   - `payment_amount = 0` (no cash paid)
   - `credit_amount = remainingCredit` (e.g., -1200)

2. **Outstanding query calculation:**
   - Transaction contribution: `total - payment_amount`
   - For credit usage: `1300 - 0 = 1300`
   - This gets added to previous outstanding: `-2500 + 1300 = -1200` ✅

3. **Customer ledger display:**
   - Shows item price (1300)
   - Shows old balance (-2500)
   - Shows payment (0)
   - Shows new balance (-1200)

## Implementation

### Line ~228-233: Credit Usage Logic
```javascript
if (finalTotal < 0) {
  // Customer has credit and is buying items
  finalPaymentAmount = 0;  // No cash paid
  finalCreditAmount = finalTotal;  // Remaining credit
}
```

### Line ~441: Store bill amount in total
```javascript
total: billAmount || 0,  // Store 1300, not -1200
```

### Outstanding Query:
```sql
SUM(s.total - s.payment_amount)
```

This calculates:
- Transaction 1: `1500 - 4000 = -2500`
- Transaction 2: `1300 - 0 = 1300`
- **Total: -2500 + 1300 = -1200** ✅

## Expected Results

### Outstanding Query Response:
```json
{
  "customerName": "Adnan",
  "phone": "0800297461",
  "totalOutstanding": -1200,
  "isCredit": true
}
```

### Customer Ledger Response:
```json
{
  "transactions": [
    {
      "invoice_no": "PTZL-000001",
      "amount": 1300,
      "old_balance": -2500,
      "payment": 0,
      "balance": -1200,
      "status": "PARTIAL"
    },
    {
      "invoice_no": "PTZL-000000",
      "amount": 1500,
      "old_balance": 0,
      "payment": 4000,
      "balance": -2500,
      "status": "PARTIAL"
    }
  ],
  "summary": {
    "outstandingBalance": -1200
  }
}
```


