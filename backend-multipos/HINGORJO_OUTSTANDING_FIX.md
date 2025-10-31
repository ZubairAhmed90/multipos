# Hingorjo Outstanding Balance Fix

## Issue

- **POS shows:** -6,300
- **Customer Ledger shows:** -600
- **Expected:** -600 ✅

## Root Cause

The outstanding query was summing all historical `credit_amount` values instead of using the **latest** `credit_amount` (which stores the running balance after each transaction).

## Fix Applied

**File:** `salesController.js` (lines 2687-2707)

**Changed the query to:**
```sql
SELECT 
  s.customer_name,
  s.customer_phone as phone,
  -- Use the latest credit_amount as current outstanding balance
  s.credit_amount as total_outstanding,
  (SELECT COUNT(*) FROM sales s2 
   WHERE s2.customer_name = s.customer_name 
     AND s2.customer_phone = s.customer_phone
     AND s2.scope_type IN ('BRANCH', 'WAREHOUSE')) as pending_sales_count
FROM sales s
WHERE s.scope_type IN ('BRANCH', 'WAREHOUSE')
  AND s.id = (
    SELECT MAX(s3.id)
    FROM sales s3
    WHERE s3.customer_name = s.customer_name 
      AND s3.customer_phone = s.customer_phone
      AND s3.scope_type IN ('BRANCH', 'WAREHOUSE')
  )
  AND ABS(s.credit_amount) > 0.01
```

**Key Changes:**
1. Uses `s.credit_amount` (the latest value) instead of `SUM(s.credit_amount)`
2. Filters to get only the latest transaction per customer using `s.id = (SELECT MAX(...))`
3. Removed `GROUP BY` clause (not needed for this query structure)
4. Filters out zero balances using `ABS(s.credit_amount) > 0.01`

## Expected Results

After deploying, for "hingorjo":
- POS outstanding should show: **-600** ✅ (not -6,300)
- Customer Ledger outstanding: **-600** ✅ (already correct)
- Both should match now!

## Files to Upload

1. **`salesController.js`** - Fixed outstanding query to use latest credit_amount

Upload and restart the Node.js application! 🎉



