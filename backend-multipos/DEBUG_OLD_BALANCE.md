# Debug: Old Balance Not Carrying Forward

## Issue

Looking at hingorjo's ledger:
- **Transaction PTZL-000082:** Old Balance = 0, Balance = 5,700
- **Transaction PTZL-000083:** Old Balance = 0 (WRONG!), Total Amount = 5,700 (WRONG!), Balance = -6,300
- **Outstanding Balance:** -600 (CORRECT)

## Expected Values

- **Transaction PTZL-000082:** Old Balance = 0, Total Amount = 5,700, Balance = 5,700 ✅
- **Transaction PTZL-000083:** Old Balance = 5,700, Total Amount = 11,400, Balance = -6,300 ✅
- **Outstanding Balance:** -600 ✅

## Root Cause Analysis

### Current Calculation Logic:
1. Transactions are sorted **ascending** (oldest first) for balance calculation
2. For each transaction:
   - `oldBalance = runningBalance` (starts at 0)
   - `currentTotalAmount = subtotal + oldBalance`
   - `runningBalance = oldBalance + (total - actualPaid)`
3. Transactions are **re-sorted** **descending** (newest first) for display

### The Problem:
When sorting ascending:
- **Index 0 (PTZL-000082):** oldBalance = 0, runningBalance = 5,700 ✅
- **Index 1 (PTZL-000083):** oldBalance = 5,700, runningBalance = -6,300 ✅

When re-sorting descending for display:
- **Index 0 (PTZL-000083):** Should show old_balance = 5,700
- **Index 1 (PTZL-000082):** Should show old_balance = 0

But the image shows:
- **PTZL-000083:** old_balance = 0 (wrong)
- **PTZL-000082:** old_balance = 0 (correct)

This suggests the stored values are being **overwritten** or the **re-sorting is mixing up the values**.

## Debugging Steps Added

Added console logs to trace:
1. **During calculation (lines 237-249):** Logs each transaction's `oldBalance`, `currentTotalAmount`, and `runningBalance` as they're calculated
2. **After sorting (lines 277-282):** Logs the final transactions array after sorting to verify values are preserved

## Next Steps

After deploying, check the console logs to see:
1. What values are stored during calculation
2. What values exist after re-sorting
3. Whether the sorting is preserving the old_balance values

## Possible Fix

If the values are being overwritten during re-sorting, we may need to:
1. Create a new array instead of sorting in-place
2. Or store the index along with the transaction data



