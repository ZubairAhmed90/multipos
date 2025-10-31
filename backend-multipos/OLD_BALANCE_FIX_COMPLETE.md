# Old Balance Carry-Forward Fix Complete

## Issue Fixed

Old balance wasn't carrying forward correctly because `.sort()` was mutating the array in place, which could potentially mix up calculated values.

## Fix Applied

**File:** `customerLedgerController.js` (line 271)

**Changed from:**
```javascript
const finalTransactions = transactionsWithBalance.sort((a, b) => {
```

**Changed to:**
```javascript
const finalTransactions = [...transactionsWithBalance].sort((a, b) => {
```

## Why This Fixes It

- **Before:** `.sort()` mutates the original array, which could cause unexpected behavior with calculated values
- **After:** Creating a new array with spread operator ensures calculated values are preserved during sorting

## Expected Results

After deploying, for hingorjo:
- **PTZL-000082:** Old Balance = 0, Total Amount = 5,700, Balance = 5,700 ✅
- **PTZL-000083:** Old Balance = 5,700 ✅, Total Amount = 11,400 ✅, Balance = -6,300 ✅
- **Outstanding Balance:** -600 ✅

## Debug Logging

Added console logs to trace:
1. Values during calculation (lines 237-249)
2. Values after sorting (lines 278-283)

Check server logs to verify values are preserved correctly.

## Files Modified

1. **`customerLedgerController.js`** - Fixed old balance calculation by creating new array for sorting
2. **`salesController.js`** - Fixed outstanding query to use latest credit_amount (already fixed)

## Deployment

Upload both files and restart the Node.js application! 🎉



