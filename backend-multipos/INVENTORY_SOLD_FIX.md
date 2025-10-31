# Inventory Sold Items Fix

## Issue

The "Sold" column in the inventory management interface shows 0 for all items, even though sales have been processed.

## Root Cause

The `inventoryController.js` was querying the wrong table. It was looking for `stock_movements` table (which doesn't exist), but sales are actually recorded in the `stock_reports` table.

## Fix Applied

**File:** `inventoryController.js` (lines 110-119)

**Changed from:**
```javascript
LEFT JOIN (
  SELECT 
    inventory_item_id,
    SUM(CASE WHEN movement_type = 'PURCHASE' THEN quantity ELSE 0 END) as total_purchased,
    SUM(CASE WHEN movement_type = 'SALE' THEN ABS(quantity) ELSE 0 END) as total_sold,
    SUM(CASE WHEN movement_type = 'RETURN' THEN quantity ELSE 0 END) as total_returned,
    SUM(CASE WHEN movement_type = 'ADJUSTMENT' THEN quantity ELSE 0 END) as total_adjusted
  FROM stock_movements 
  GROUP BY inventory_item_id
) sr ON i.id = sr.inventory_item_id
```

**Changed to:**
```javascript
LEFT JOIN (
  SELECT 
    inventory_item_id,
    SUM(CASE WHEN transaction_type = 'PURCHASE' THEN quantity_change ELSE 0 END) as total_purchased,
    SUM(CASE WHEN transaction_type = 'SALE' THEN ABS(quantity_change) ELSE 0 END) as total_sold,
    SUM(CASE WHEN transaction_type = 'RETURN' THEN quantity_change ELSE 0 END) as total_returned,
    SUM(CASE WHEN transaction_type = 'ADJUSTMENT' THEN quantity_change ELSE 0 END) as total_adjusted
  FROM stock_reports 
  GROUP BY inventory_item_id
) sr ON i.id = sr.inventory_item_id
```

**Key Changes:**
1. Changed `stock_movements` to `stock_reports` ✅
2. Changed `movement_type` to `transaction_type` ✅
3. Changed `quantity` to `quantity_change` ✅

## How It Works

When a sale is created (`salesController.js` line 554):
1. Calls `createSaleTransaction()` which writes to `stock_reports` table
2. Records transaction type as 'SALE' 
3. Records `quantity_change` as negative (sales reduce stock)

The inventory query now correctly reads from `stock_reports` to calculate:
- `total_purchased` - sum of PURCHASE transactions
- `total_sold` - sum of SALE transactions (absolute value)
- `total_returned` - sum of RETURN transactions
- `total_adjusted` - sum of ADJUSTMENT transactions

## Expected Results

After deploying:
- Items that have been sold will show the correct "Sold" count
- Items that have been returned will show the correct "Returned" count
- Items that have been purchased will show the correct "Purchased" count

## Files Modified

1. **`inventoryController.js`** - Fixed table and column names for sold items query

Upload and restart the Node.js application! 🎉



