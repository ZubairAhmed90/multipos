# Linting Fixes

## Issues Fixed

### 1. Unescaped quotes in `pos/terminal/page.js`
- **Error:** `react/no-unescaped-entities` on lines 4517, 4518, 4522, 4523
- **Fix:** Changed `"SETTLE"` to `&quot;SETTLE&quot;` and `"PRINT"` to `&quot;PRINT&quot;`

### 2. Missing dependency warning in `purchase-orders/page.js`
- **Error:** `react-hooks/exhaustive-deps` warning for missing `filters` dependency
- **Fix:** Removed duplicate `useEffect` hooks and merged them into one hook with correct dependencies

## Changes Made

**File 1: `pos/terminal/page.js`** (lines 4517-4522)
```javascript
// Before:
💡 No items in cart - Click "SETTLE" to process outstanding payments only
💡 Outstanding payments are automatically selected - Click "PRINT" to process

// After:
💡 No items in cart - Click &quot;SETTLE&quot; to process outstanding payments only
💡 Outstanding payments are automatically selected - Click &quot;PRINT&quot; to process
```

**File 2: `purchase-orders/page.js`** (lines 184-191)
```javascript
// Before: Two separate useEffect hooks
useEffect(() => {
  dispatch(fetchPurchaseOrders(filters))
  dispatch(fetchSuppliers())
}, [dispatch])

useEffect(() => {
  dispatch(fetchPurchaseOrders(filters))
}, [dispatch, filters])

// After: Combined with correct dependencies
useEffect(() => {
  dispatch(fetchPurchaseOrders(filters))
}, [dispatch, filters])

useEffect(() => {
  dispatch(fetchSuppliers())
}, [dispatch])
```

## Result

Build should now compile successfully without linting errors! ✅



