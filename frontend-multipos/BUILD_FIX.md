# Build Fix Instructions

## Issue
Build failing with linting errors for unescaped quotes in `pos/terminal/page.js`

## Status
✅ **All linting errors have been fixed in the code**

The linting errors have been resolved:
- Line 4517: Changed `Click "SETTLE"` to `Click &quot;SETTLE&quot;`
- Line 4522: Changed `Click "PRINT"` to `Click &quot;PRINT&quot;`

## If Build Still Fails

The build may be using cached files. Try these steps:

1. **Stop the dev server** (if running)

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   ```

3. **Clear node_modules cache:**
   ```bash
   rm -rf node_modules/.cache
   ```

4. **Rebuild:**
   ```bash
   npm run build
   ```

5. **If still failing, restart dev server:**
   ```bash
   npm run dev
   ```

## Files Modified
- `pos/terminal/page.js` - Fixed unescaped quotes (lines 4517, 4522)
- `purchase-orders/page.js` - Fixed useEffect dependencies (lines 183-191)

All linting errors have been resolved! ✅



