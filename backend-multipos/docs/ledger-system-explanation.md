# Complete Ledger Management System - How Sales Are Recorded

## 🏦 **Double-Entry Bookkeeping System**

When anyone makes a sale, the system automatically records **multiple ledger entries** following proper accounting principles. Here's exactly what happens:

## 📊 **Sale Transaction Recording Process**

### **Step 1: Sale Creation**
When a sale is made (POS terminal, warehouse billing, etc.), the system:

1. **Creates the sale record** in the `sales` table
2. **Updates inventory** (reduces stock)
3. **Records ledger entries** with proper debit/credit accounts

### **Step 2: Automatic Ledger Entries**

For **every sale**, the system creates these ledger entries:

#### **💰 Cash Sale (Full Payment)**
```
DEBIT  Cash Account           $100.00  (Money received)
CREDIT Sales Revenue          $100.00  (Revenue earned)
DEBIT  Cost of Goods Sold     $60.00   (Cost of items sold)
CREDIT Inventory              $60.00   (Inventory reduced)
```

#### **💳 Partial Payment Sale**
```
DEBIT  Cash Account           $60.00   (Partial payment received)
DEBIT  Accounts Receivable    $40.00   (Credit to customer)
CREDIT Sales Revenue          $100.00  (Total revenue)
DEBIT  Cost of Goods Sold     $60.00   (Cost of items sold)
CREDIT Inventory              $60.00   (Inventory reduced)
```

#### **📝 Full Credit Sale**
```
DEBIT  Accounts Receivable    $100.00  (Full credit to customer)
CREDIT Sales Revenue          $100.00  (Revenue earned)
DEBIT  Cost of Goods Sold     $60.00   (Cost of items sold)
CREDIT Inventory              $60.00   (Inventory reduced)
```

## 🏢 **Account Types and Their Roles**

### **Asset Accounts (Debit increases, Credit decreases)**
- **Cash Account**: Money in hand/cash register
- **Accounts Receivable**: Money owed by customers
- **Inventory**: Value of goods in stock

### **Revenue Accounts (Credit increases, Debit decreases)**
- **Sales Revenue**: Income from sales

### **Expense Accounts (Debit increases, Credit decreases)**
- **Cost of Goods Sold**: Cost of inventory sold

### **Liability Accounts (Credit increases, Debit decreases)**
- **Accounts Payable**: Money owed to suppliers

## 📋 **Detailed Example: $100 Sale with $60 Partial Payment**

### **Sale Details:**
- **Total**: $100.00
- **Payment**: $60.00 (Cash)
- **Credit**: $40.00 (Customer owes)
- **Cost**: $60.00 (Items cost)

### **Ledger Entries Created:**

| Account | Type | Amount | Description |
|---------|------|--------|-------------|
| **Cash Account** | DEBIT | $60.00 | Sale PTHL-000001 - Cash Payment |
| **Accounts Receivable** | DEBIT | $40.00 | Sale PTHL-000001 - Credit to Customer |
| **Sales Revenue** | CREDIT | $100.00 | Sale PTHL-000001 - Revenue |
| **Cost of Goods Sold** | DEBIT | $60.00 | Sale PTHL-000001 - Cost of Goods Sold |
| **Inventory** | CREDIT | $60.00 | Sale PTHL-000001 - Inventory Reduction |

### **Account Balances After Sale:**

| Account | Balance | Type |
|---------|---------|------|
| **Cash Account** | +$60.00 | Asset |
| **Accounts Receivable** | +$40.00 | Asset |
| **Sales Revenue** | +$100.00 | Revenue |
| **Cost of Goods Sold** | +$60.00 | Expense |
| **Inventory** | -$60.00 | Asset |

## 🔄 **Partial Payment Collection**

When customer pays the remaining $40:

### **New Ledger Entries:**
```
DEBIT  Cash Account           $40.00   (Payment received)
CREDIT Accounts Receivable    $40.00   (Credit cleared)
```

### **Updated Balances:**
| Account | Balance | Type |
|---------|---------|------|
| **Cash Account** | +$100.00 | Asset |
| **Accounts Receivable** | $0.00 | Asset |
| **Sales Revenue** | +$100.00 | Revenue |
| **Cost of Goods Sold** | +$60.00 | Expense |
| **Inventory** | -$60.00 | Asset |

## 📊 **Trial Balance**

The system maintains a **trial balance** to ensure all debits equal credits:

### **Debit Side:**
- Cash Account: $100.00
- Cost of Goods Sold: $60.00
- **Total Debits: $160.00**

### **Credit Side:**
- Sales Revenue: $100.00
- Inventory: $60.00
- **Total Credits: $160.00**

✅ **Balanced: $160.00 = $160.00**

## 🎯 **Key Features**

### **1. Automatic Account Creation**
- If accounts don't exist, they're created automatically
- Each branch/warehouse has its own set of accounts
- Accounts are properly categorized (Asset, Revenue, Expense, etc.)

### **2. Real-Time Balance Updates**
- Account balances update immediately after each transaction
- No manual intervention required
- Accurate financial reporting

### **3. Complete Audit Trail**
- Every transaction is recorded with:
  - Date and time
  - User who created it
  - Reference to original sale
  - Description of the transaction

### **4. Scope-Based Accounting**
- **Branch Sales**: Recorded in branch-specific accounts
- **Warehouse Sales**: Recorded in warehouse-specific accounts
- **Separate ledgers** for each location

## 🔍 **What You'll See in Ledger Management**

### **Account List:**
```
Cash Account (PTHL)           $1,250.00  [Asset]
Accounts Receivable (PTHL)    $340.00    [Asset]
Sales Revenue (PTHL)          $2,100.00  [Revenue]
Cost of Goods Sold (PTHL)     $1,260.00  [Expense]
Inventory (PTHL)              $800.00    [Asset]
```

### **Transaction History:**
```
Date       | Account              | Type  | Amount | Description
2023-12-15 | Cash Account         | DEBIT | $60.00 | Sale PTHL-000001 - Cash Payment
2023-12-15 | Accounts Receivable  | DEBIT | $40.00 | Sale PTHL-000001 - Credit to Customer
2023-12-15 | Sales Revenue        | CREDIT| $100.00| Sale PTHL-000001 - Revenue
2023-12-15 | Cost of Goods Sold   | DEBIT | $60.00 | Sale PTHL-000001 - Cost of Goods Sold
2023-12-15 | Inventory            | CREDIT| $60.00 | Sale PTHL-000001 - Inventory Reduction
```

### **Trial Balance:**
```
Account Type    | Total Debits | Total Credits
Assets          | $2,390.00    | $60.00
Revenue         | $0.00        | $2,100.00
Expenses        | $1,260.00    | $0.00
TOTALS          | $3,650.00    | $2,160.00
```

## 🚀 **Benefits**

1. **Complete Financial Tracking**: Every sale is properly recorded
2. **Automatic Bookkeeping**: No manual ledger entries needed
3. **Real-Time Balances**: Always up-to-date account balances
4. **Audit Trail**: Complete history of all transactions
5. **Proper Accounting**: Follows double-entry bookkeeping principles
6. **Scope Separation**: Each location has its own accounts
7. **Partial Payment Support**: Properly handles credit sales
8. **Inventory Tracking**: Cost of goods sold automatically calculated

## 📈 **Financial Reports Available**

1. **Trial Balance**: Shows all account balances
2. **Account Statements**: Detailed history for each account
3. **Sales Reports**: Revenue and cost analysis
4. **Cash Flow**: Cash in/out tracking
5. **Accounts Receivable**: Outstanding customer credits
6. **Inventory Valuation**: Current inventory value

**Every sale automatically creates proper ledger entries with debit and credit accounts, maintaining complete financial records!** 🎯



