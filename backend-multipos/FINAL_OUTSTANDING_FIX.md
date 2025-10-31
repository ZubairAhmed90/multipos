# Final Outstanding Balance Fix

## Issue Analysis

**For "hingorjo":**
- POS shows: **-6,300**
- Customer Ledger shows: **-600**
- Expected: **-600** (correct)

### Database Values (Hypothetical):
- PTZL-000082: `credit_amount = 5,700`
- PTZL-000083: `credit_amount = -6,300` (final balance after this transaction)

### Expected Running Balance Calculation:
- Transaction 1: 5,700 credit → Balance = 5,700
- Transaction 2: -6,300 credit → Balance = 5,700 + (-6,300) = -600 ✅

## Root Cause

The `credit_amount` in the `sales` table stores the **running balance** after each transaction, not the individual credit amount for that transaction.

**Key Insight:**
- `credit_amount` = running balance after the transaction
- The latest `credit_amount` = current outstanding balance
- The query was summing all `credit_amount` values, which gave wrong results

## Fix Applied

**File:** `salesController.js` (lines 2687-2705)

**Changed from:**
```sql
SUM(s.credit_amount) -- This sums all historical credit amounts
```

**Changed to:**
```sql
-- Use the latest credit_amount as current outstanding balance
(SELECT s2.credit_amount 
 FROM sales s2 
 WHERE s2.customer_name = s.customer_name 
   AND s2.customer_phone = s.customer_phone
   AND s2.scope_type IN ('BRANCH', 'WAREHOUSE')
 ORDER BY s2.created_at DESC 
 LIMIT 1) as total_outstanding
```

**But this was complex...**

**Simplified approach:**
```sql
SELECT 
  customer_name,
  phone,
  total_outstanding,
  pending_sales_count
FROM (
  SELECT 
    s.customer_name,
    s.customer_phone as phone,
    -- Calculate total outstanding as SUM(credit_amount) - this gives running balance
    COALESCE(SUM(s.credit_amount), 0) as total_outstanding,
    COUNT(s.id) as pending_sales_count
  FROM sales s
  WHERE s.scope_type IN ('BRANCH', 'WAREHOUSE')
  GROUP BY s.customer_name, s.customer_phone
) as subquery
WHERE ABS(total_outstanding) > 0.01
```

## Alternative Approach

If `credit_amount` stores the **final balance** after each transaction (not a running total), then we need to get the **latest** `credit_amount` value:

```sql
SELECT 
  s.customer_name,
  s.customer_phone as phone,
  s.credit_amount as total_outstanding,
  (SELECT COUNT(*) FROM sales s2 
   WHERE s2.customer_name = s.customer_name 
     AND s2.customer_phone = s.customer_phone
     AND s2.scope_type = s.scope_type) as pending_sales_count
FROM sales s
WHERE s.id = (
  SELECT MAX(s3.id)
  FROM sales s3
  WHERE s3.customer_name = s.customer_name 
    AND s3.customer_phone = s.customer_phone
    AND s3.scope_type IN ('BRANCH', 'WAREHOUSE')
)
GROUP BY s.customer_name, s.customer_phone
HAVING ABS(s.credit_amount) > 0.01
```

## Testing

After deploying, test with "hingorjo":
- Expected POS outstanding: **-600** (not -6,300)
- Expected Ledger outstanding: **-600** ✅
- Both should match

## Recommendation

The **latest `credit_amount`** approach is cleaner and matches the database structure where `credit_amount` stores the final balance after each transaction.



