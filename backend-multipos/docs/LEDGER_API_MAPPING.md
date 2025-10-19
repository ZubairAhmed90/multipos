# Ledger Management API & Field Mapping

## 📊 Database Schema

### `ledgers` Table (Chart of Accounts)
```sql
CREATE TABLE ledgers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_name VARCHAR(100) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  description TEXT,
  scope_type ENUM('BRANCH', 'WAREHOUSE', 'COMPANY') DEFAULT 'BRANCH',
  scope_id INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `ledger_entries` Table (Transaction Entries)
```sql
CREATE TABLE ledger_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ledger_id INT NOT NULL,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  type ENUM('DEBIT', 'CREDIT') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  reference_id VARCHAR(100),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🔗 API Endpoints

### Chart of Accounts (Ledger Accounts)

#### GET `/api/ledger/accounts`
- **Purpose**: Fetch all ledger accounts
- **Query Parameters**:
  - `page` (optional): Page number for pagination
  - `limit` (optional): Items per page
  - `status` (optional): Filter by status (ACTIVE/INACTIVE)
  - `accountType` (optional): Filter by account type
- **Response**: Array of account objects
- **Permissions**: Admin, Manager, Warehouse Keeper

#### POST `/api/ledger/accounts`
- **Purpose**: Create new ledger account
- **Body Fields**:
  - `accountName` (required): Account name
  - `accountType` (required): asset/liability/equity/revenue/expense
  - `balance` (required): Opening balance (number)
  - `description` (required): Account description
  - `status` (optional): ACTIVE/INACTIVE (default: ACTIVE)
- **Permissions**: Admin only

#### PUT `/api/ledger/accounts/:id`
- **Purpose**: Update existing ledger account
- **Body Fields**: Same as POST (all optional)
- **Permissions**: Admin, Warehouse Keeper

#### DELETE `/api/ledger/accounts/:id`
- **Purpose**: Delete ledger account
- **Permissions**: Admin only

#### POST `/api/ledger/accounts/populate`
- **Purpose**: Populate default accounts (one-time setup)
- **Permissions**: Admin only

### Transaction Entries

#### GET `/api/ledger/entries`
- **Purpose**: Fetch all ledger entries
- **Query Parameters**:
  - `ledgerId` (optional): Filter by specific account
  - `type` (optional): Filter by DEBIT/CREDIT
  - `startDate` (optional): Filter from date
  - `endDate` (optional): Filter to date
  - `page` (optional): Page number
  - `limit` (optional): Items per page
- **Response**: Array of entry objects with account details
- **Permissions**: Admin, Manager, Warehouse Keeper

#### POST `/api/ledger/account/:accountId/entry`
- **Purpose**: Create new ledger entry
- **Body Fields**:
  - `type` (required): DEBIT/CREDIT
  - `amount` (required): Transaction amount (number)
  - `description` (required): Transaction description
  - `reference` (optional): Reference type (e.g., "Invoice", "Payment")
  - `referenceId` (optional): Reference ID (e.g., "INV-001")
- **Permissions**: Admin, Manager, Warehouse Keeper

#### PUT `/api/ledger/entries/:id`
- **Purpose**: Update ledger entry
- **Body Fields**: Same as POST (all optional)
- **Permissions**: Admin, Manager, Warehouse Keeper

#### DELETE `/api/ledger/entries/:id`
- **Purpose**: Delete ledger entry
- **Permissions**: Admin, Manager, Warehouse Keeper

### Balance Summary

#### GET `/api/ledger/balance/:scopeType/:scopeId`
- **Purpose**: Get balance summary for scope
- **Parameters**:
  - `scopeType`: BRANCH/WAREHOUSE/COMPANY
  - `scopeId`: ID of the scope
- **Response**: Summary object with totals by account type
- **Permissions**: Admin, Manager, Warehouse Keeper

## 🔄 Field Mapping (Frontend ↔ Backend)

### Account Fields
| Frontend Field | Backend Field | Type | Description |
|----------------|---------------|------|-------------|
| `id` | `id` | number | Account ID |
| `accountName` | `account_name` | string | Account name |
| `accountType` | `account_type` | enum | asset/liability/equity/revenue/expense |
| `balance` | `balance` | decimal | Current balance |
| `currency` | `currency` | string | Currency code (USD) |
| `status` | `status` | enum | ACTIVE/INACTIVE |
| `description` | `description` | text | Account description |
| `scopeType` | `scope_type` | enum | BRANCH/WAREHOUSE/COMPANY |
| `scopeId` | `scope_id` | number | Scope ID |
| `createdAt` | `created_at` | timestamp | Creation date |
| `updatedAt` | `updated_at` | timestamp | Last update |

### Entry Fields
| Frontend Field | Backend Field | Type | Description |
|----------------|---------------|------|-------------|
| `id` | `id` | number | Entry ID |
| `ledgerId` | `ledger_id` | number | Account ID |
| `date` | `date` | timestamp | Transaction date |
| `type` | `type` | enum | DEBIT/CREDIT |
| `amount` | `amount` | decimal | Transaction amount |
| `description` | `description` | text | Transaction description |
| `reference` | `reference` | string | Reference type |
| `referenceId` | `reference_id` | string | Reference ID |
| `createdBy` | `created_by` | number | User ID who created |
| `createdAt` | `created_at` | timestamp | Creation date |
| `updatedAt` | `updated_at` | timestamp | Last update |
| `accountName` | `account_name` | string | Account name (joined) |
| `accountType` | `account_type` | enum | Account type (joined) |

## 🎯 Redux State Structure

```javascript
const ledgerState = {
  // Accounts
  accounts: [],                    // Array of account objects
  accountsLoading: false,          // Loading state
  accountsError: null,             // Error message
  
  // Entries
  entries: [],                     // Array of entry objects
  entriesLoading: false,           // Loading state
  entriesError: null,              // Error message
  
  // Balance Summary
  balanceSummary: null,            // Summary object
  balanceLoading: false,           // Loading state
  balanceError: null,              // Error message
  
  // UI State
  selectedAccount: null,           // Currently selected account
  selectedEntry: null,             // Currently selected entry
  
  // Pagination
  accountsPagination: {
    page: 1,
    limit: 10,
    total: 0
  },
  entriesPagination: {
    page: 1,
    limit: 20,
    total: 0
  }
}
```

## 🔐 Permissions & Access Control

### Role-Based Access
- **ADMIN**: Full access to all ledger operations
- **MANAGER**: Read access + create/update entries
- **WAREHOUSE_KEEPER**: Read access + create/update entries
- **CASHIER**: No access to ledger management

### Scope-Based Filtering
- Users can only see accounts/entries for their assigned scope
- Branch users see branch-specific data
- Warehouse users see warehouse-specific data
- Admin users see all data

## 🚀 Integration Points

### Sales Integration
- Sales automatically create ledger entries via `LedgerService.recordSaleTransaction()`
- Creates debit entries for cash/receivables
- Creates credit entries for revenue
- Updates inventory and COGS accounts

### Inventory Integration
- Inventory changes create ledger entries
- Stock adjustments update inventory accounts
- Cost changes update COGS accounts

### Payment Integration
- Payment processing updates cash/receivables accounts
- Partial payments create proper debit/credit entries
- Credit sales create receivables entries

## 📈 Financial Calculations

### Account Type Rules
- **Assets**: Debit increases, Credit decreases
- **Liabilities**: Credit increases, Debit decreases
- **Equity**: Credit increases, Debit decreases
- **Revenue**: Credit increases, Debit decreases
- **Expenses**: Debit increases, Credit decreases

### Balance Calculations
- Account balance = Sum of all debits - Sum of all credits
- For asset accounts: Positive balance = Debit balance
- For liability/equity accounts: Positive balance = Credit balance

### Financial Ratios
- **Working Capital**: Current Assets - Current Liabilities
- **Current Ratio**: Current Assets / Current Liabilities
- **Debt-to-Equity**: Total Liabilities / Total Equity
- **Profit Margin**: (Revenue - Expenses) / Revenue * 100

## 🔧 Error Handling

### Common Error Scenarios
1. **Account not found**: 404 with message
2. **Invalid account type**: 400 with validation error
3. **Insufficient permissions**: 403 with access denied
4. **Database constraint violation**: 400 with constraint error
5. **Invalid amount**: 400 with validation error

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 📝 Validation Rules

### Account Validation
- Account name: Required, 1-100 characters
- Account type: Required, must be valid enum value
- Balance: Required, must be numeric, can be negative
- Description: Required, 1-500 characters
- Status: Optional, must be ACTIVE or INACTIVE

### Entry Validation
- Type: Required, must be DEBIT or CREDIT
- Amount: Required, must be positive number
- Description: Required, 1-500 characters
- Reference: Optional, max 100 characters
- Reference ID: Optional, max 100 characters

This comprehensive mapping ensures proper integration between the frontend components and backend API! 🎯



