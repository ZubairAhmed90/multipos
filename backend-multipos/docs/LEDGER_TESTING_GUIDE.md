# 🧪 Ledger Management Testing Guide

## 📋 Prerequisites

1. **Database Setup**: Ensure both `ledgers` and `ledger_entries` tables exist
2. **Default Accounts**: Populate default ledger accounts
3. **User Permissions**: Ensure you have ADMIN role for full testing

## 🔍 Step 1: Check Current Status

Run the ledger data check script:

```bash
cd multipos/backend-multipos
node scripts/check-ledger-data.js
```

This will show you:
- Number of accounts and entries
- Sample data
- Account balances
- Any missing data

## 🏗️ Step 2: Populate Default Accounts (If Needed)

If no accounts exist, populate them via API:

```bash
# Using curl
curl -X POST http://localhost:5000/api/ledger/accounts/populate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Or use the frontend:
1. Go to Ledger Management → Chart of Accounts
2. Click "Populate Default Accounts" (if available)

## 💰 Step 3: Add Sample Data (Optional)

To test with sample transactions:

```bash
cd multipos/backend-multipos
node scripts/populate-sample-ledger-entries.js
```

This creates sample sales, payments, and inventory transactions.

## 🧪 Step 4: Test Frontend Components

### Chart of Accounts Tab
1. **View Accounts**: Should show all ledger accounts
2. **Search**: Test searching by account name or description
3. **Filter**: Test filtering by account type and status
4. **Add Account**: Create a new account (Admin only)
5. **Edit Account**: Modify existing account details
6. **Delete Account**: Remove an account (Admin only)

### Transaction Entries Tab
1. **View Entries**: Should show all ledger transactions
2. **Search**: Test searching by description, reference, or account
3. **Filter**: Test filtering by account, type, and date range
4. **Add Entry**: Create manual journal entries
5. **Edit Entry**: Modify existing entries
6. **Delete Entry**: Remove entries

### Balance Summary Tab
1. **Financial Metrics**: Check totals for assets, liabilities, etc.
2. **Financial Ratios**: Verify working capital, current ratio, etc.
3. **Account Breakdown**: View accounts by type
4. **Accounting Equation**: Ensure Assets = Liabilities + Equity

## 🔄 Step 5: Test Sales Integration

### Create a Test Sale
1. Go to POS Terminal
2. Add items to cart
3. Process payment (cash or partial)
4. Check if ledger entries are created automatically

### Verify Ledger Entries
After creating a sale, check:
- Cash Account: Should have debit entry
- Sales Revenue: Should have credit entry
- Accounts Receivable: Should have debit entry (if partial payment)
- Cost of Goods Sold: Should have debit entry
- Inventory: Should have credit entry

## 📊 Step 6: Test API Endpoints

### Chart of Accounts API
```bash
# Get all accounts
curl -X GET http://localhost:5000/api/ledger/accounts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create new account
curl -X POST http://localhost:5000/api/ledger/accounts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "Test Account",
    "accountType": "asset",
    "balance": 1000.00,
    "description": "Test account for API testing"
  }'
```

### Transaction Entries API
```bash
# Get all entries
curl -X GET http://localhost:5000/api/ledger/entries \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create new entry
curl -X POST http://localhost:5000/api/ledger/account/1/entry \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DEBIT",
    "amount": 500.00,
    "description": "Test transaction",
    "reference": "Test",
    "referenceId": "TEST-001"
  }'
```

### Balance Summary API
```bash
# Get balance summary
curl -X GET http://localhost:5000/api/ledger/balance/BRANCH/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐛 Step 7: Common Issues & Solutions

### Issue: No Data Showing
**Solution**: 
1. Check if accounts are populated
2. Verify user permissions
3. Check API endpoints are working

### Issue: Field Mapping Errors
**Solution**:
1. Check browser console for errors
2. Verify API response format
3. Ensure field names match backend schema

### Issue: Permission Denied
**Solution**:
1. Ensure user has ADMIN role
2. Check authentication token
3. Verify route permissions

### Issue: Accounting Equation Not Balanced
**Solution**:
1. Check for missing entries
2. Verify debit/credit amounts
3. Review account type rules

## ✅ Step 8: Validation Checklist

### Frontend Validation
- [ ] All tabs load without errors
- [ ] Search and filters work correctly
- [ ] Data displays properly in tables
- [ ] Forms validate input correctly
- [ ] Actions (add/edit/delete) work
- [ ] Summary calculations are accurate

### Backend Validation
- [ ] API endpoints return correct data
- [ ] Permissions are enforced
- [ ] Database constraints are respected
- [ ] Error handling works properly
- [ ] Sales integration creates entries

### Integration Validation
- [ ] Sales create proper ledger entries
- [ ] Account balances update correctly
- [ ] Financial ratios calculate properly
- [ ] Data persists across sessions

## 🎯 Expected Results

After successful testing, you should see:

1. **Chart of Accounts**: 5+ default accounts with proper types
2. **Transaction Entries**: Sample transactions with proper debit/credit entries
3. **Balance Summary**: Accurate financial metrics and ratios
4. **Sales Integration**: Automatic ledger entry creation for sales
5. **API Responses**: Proper JSON responses with correct field names

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify database connectivity
3. Check API endpoint responses
4. Review user permissions
5. Ensure all migrations are applied

## 🚀 Next Steps

Once testing is complete:
1. Train users on the new interface
2. Set up proper account structures
3. Configure user permissions
4. Monitor system performance
5. Plan for additional features

Happy testing! 🎉



