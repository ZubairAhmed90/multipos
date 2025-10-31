# Redux Slices Safety Fixes

## Issue
Build failing with `Cannot read properties of undefined (reading 'map')` in extraReducers

## Root Cause
Redux slices were trying to call `.map()` on potentially undefined arrays

## Fixes Applied

### 1. Purchase Orders Slice (`purchaseOrdersSlice.js`)

**Lines 161-170:** Fixed `fetchPurchaseOrders.fulfilled`
```javascript
// Before:
state.data = action.payload.data || []

// After:
state.data = action.payload?.data || action.payload?.orders || []
```

**Lines 181-184:** Fixed `fetchPurchaseOrder.fulfilled`
```javascript
// Before:
state.currentOrder = action.payload.data

// After:
state.currentOrder = action.payload?.data || action.payload
```

**Lines 195-201:** Fixed `createPurchaseOrder.fulfilled`
```javascript
// After:
const newOrder = action.payload?.data || action.payload
if (newOrder) {
  state.data.unshift(newOrder)
}
```

**Lines 212-224:** Fixed `updatePurchaseOrderStatus.fulfilled`
```javascript
// After:
const updatedOrder = action.payload?.data || action.payload
if (updatedOrder) {
  // Safe updates...
}
```

**Lines 235-241:** Fixed `deletePurchaseOrder.fulfilled`
```javascript
// After:
const deletedId = action.payload?.data?.id || action.payload?.id || action.meta.arg
if (deletedId) {
  state.data = state.data.filter(order => order.id !== deletedId)
}
```

### 2. Financial Vouchers Slice (`financialVoucherSlice.js`)

**Lines 66-70:** Fixed `.map()` call
```javascript
// Before:
data: response.data.data.map(transformVoucherData)

// After:
data: Array.isArray(response.data.data) ? response.data.data.map(transformVoucherData) : []
```

## Key Changes
- Added optional chaining (`?.`) to safely access nested properties
- Added `Array.isArray()` checks before calling `.map()`
- Used fallback values (`|| []`) for empty arrays
- Used `action.meta.arg` as fallback for delete operations

## Result
All Redux slices now handle undefined/null values safely without throwing errors during build ✅



