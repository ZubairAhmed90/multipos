# Salesperson Management System

## Overview

The salesperson management system allows you to track which salesperson brought each sale in warehouse operations. This system provides complete traceability and performance tracking for individual salespeople.

## Features

### 1. Salesperson Management
- Create, read, update, and delete salespeople
- Assign salespeople to specific warehouses
- Set commission rates for each salesperson
- Track salesperson status (ACTIVE/INACTIVE)

### 2. Sales Tracking
- Link sales to specific salespeople
- Generate salesperson-specific invoice numbers
- Track salesperson performance metrics
- Monitor sales by payment method

### 3. Invoice Numbering
- **Format**: `{WAREHOUSE_CODE}-{SALESPERSON_CODE}-{000001}`
- **Example**: `WH01-AHM-000001` (Warehouse WH01, Salesperson Ahmed, Sale #1)
- Each salesperson has their own sequential numbering

## Database Schema

### Salespeople Table
```sql
CREATE TABLE salespeople (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100),
  warehouse_id INT,
  commission_rate DECIMAL(5,2) DEFAULT 0.00,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);
```

### Sales Table (Enhanced)
The `customer_info` field now includes salesperson data:
```json
{
  "id": "retailer_id",
  "name": "customer_name",
  "paymentTerms": "payment_terms",
  "paymentMethod": "payment_method",
  "salesperson": {
    "id": "salesperson_id",
    "name": "salesperson_name",
    "phone": "salesperson_phone"
  }
}
```

## API Endpoints

### Salespeople Management

#### Get All Salespeople
```
GET /api/salespeople
```
**Query Parameters:**
- `warehouseId` - Filter by warehouse
- `search` - Search by name or phone

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "name": "Ahmed Khan",
      "phone": "03001234567",
      "email": "ahmed@example.com",
      "warehouse_id": 1,
      "commission_rate": 5.00,
      "status": "ACTIVE",
      "created_at": "2023-12-15T10:00:00.000Z",
      "updated_at": "2023-12-15T10:00:00.000Z"
    }
  ]
}
```

#### Get Single Salesperson
```
GET /api/salespeople/:id
```

#### Create Salesperson
```
POST /api/salespeople
```
**Body:**
```json
{
  "name": "Ahmed Khan",
  "phone": "03001234567",
  "email": "ahmed@example.com",
  "warehouseId": 1,
  "commissionRate": 5.00,
  "status": "ACTIVE"
}
```

#### Update Salesperson
```
PUT /api/salespeople/:id
```

#### Delete Salesperson
```
DELETE /api/salespeople/:id
```

#### Get Salesperson Performance
```
GET /api/salespeople/:id/performance
```
**Query Parameters:**
- `startDate` - Start date for performance period
- `endDate` - End date for performance period

**Response:**
```json
{
  "success": true,
  "data": {
    "salesperson": {
      "id": 1,
      "name": "Ahmed Khan",
      "phone": "03001234567",
      "warehouse_id": 1,
      "commission_rate": 5.00
    },
    "statistics": {
      "totalSales": 25,
      "totalAmount": 125000.00,
      "averageSale": 5000.00,
      "minSale": 1000.00,
      "maxSale": 15000.00,
      "firstSaleDate": "2023-12-01T10:00:00.000Z",
      "lastSaleDate": "2023-12-15T15:30:00.000Z"
    },
    "paymentMethods": [
      {
        "payment_method": "CASH",
        "count": 15,
        "amount": 75000.00
      },
      {
        "payment_method": "CREDIT",
        "count": 10,
        "amount": 50000.00
      }
    ],
    "recentSales": [
      {
        "id": 125,
        "invoice_no": "WH01-AHM-000025",
        "total": 5000.00,
        "payment_method": "CASH",
        "created_at": "2023-12-15T15:30:00.000Z"
      }
    ]
  }
}
```

## Warehouse Sale Creation

### Enhanced Warehouse Sale Data
When creating a warehouse sale, include salesperson information:

```javascript
const saleData = {
  retailerId: "retailer_123",
  warehouseKeeperId: 1,
  salespersonId: 1,        // New: Salesperson who brought the sale
  salespersonName: "Ahmed Khan",  // New: Salesperson name
  salespersonPhone: "03001234567", // New: Salesperson phone
  items: [...],
  totalAmount: 5000.00,
  taxAmount: 500.00,
  discountAmount: 0.00,
  finalAmount: 5500.00,
  paymentMethod: "CASH",
  notes: "Sale notes"
};
```

### Invoice Number Generation
The system automatically generates salesperson-specific invoice numbers:
- **Format**: `{WAREHOUSE_CODE}-{SALESPERSON_CODE}-{000001}`
- **Example**: `WH01-AHM-000001`

## Usage Examples

### 1. Creating a Salesperson
```javascript
const response = await fetch('/api/salespeople', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    name: 'Ahmed Khan',
    phone: '03001234567',
    email: 'ahmed@example.com',
    warehouseId: 1,
    commissionRate: 5.00,
    status: 'ACTIVE'
  })
});
```

### 2. Creating a Warehouse Sale with Salesperson
```javascript
const saleData = {
  retailerId: "retailer_123",
  warehouseKeeperId: 1,
  salespersonId: 1,
  salespersonName: "Ahmed Khan",
  salespersonPhone: "03001234567",
  items: [
    {
      inventoryItemId: 1,
      quantity: 10,
      unitPrice: 100.00,
      discount: 0.00
    }
  ],
  totalAmount: 1000.00,
  taxAmount: 100.00,
  discountAmount: 0.00,
  finalAmount: 1100.00,
  paymentMethod: "CASH",
  notes: "Sale brought by Ahmed Khan"
};

const response = await fetch('/api/warehouse-sales', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify(saleData)
});
```

### 3. Getting Salesperson Performance
```javascript
const response = await fetch('/api/salespeople/1/performance?startDate=2023-12-01&endDate=2023-12-31', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const performance = await response.json();
console.log(`Total Sales: ${performance.data.statistics.totalSales}`);
console.log(`Total Amount: ${performance.data.statistics.totalAmount}`);
```

## Benefits

1. **Complete Traceability**: Know exactly which salesperson brought each sale
2. **Performance Tracking**: Monitor individual salesperson performance
3. **Commission Calculation**: Easy commission calculation based on sales
4. **Salesperson-Specific Invoicing**: Clear invoice numbering for each salesperson
5. **Warehouse Management**: Better organization of warehouse sales operations
6. **Reporting**: Detailed reports on salesperson performance and sales patterns

## Migration

To set up the salesperson system, run the migration:

```sql
-- Run the migration file
SOURCE multipos/backend-multipos/migrations/create_salespeople_table.sql;
```

This will create the salespeople table and insert sample data.

## Security

- All endpoints require authentication
- Admin and Warehouse Keeper roles can manage salespeople
- Only Admin can delete salespeople
- Salespeople can only be deleted if they have no associated sales

## Future Enhancements

1. **Commission Calculation**: Automatic commission calculation and payment tracking
2. **Sales Targets**: Set and track sales targets for salespeople
3. **Performance Analytics**: Advanced analytics and reporting
4. **Mobile App**: Mobile app for salespeople to track their sales
5. **Notifications**: Notifications for sales milestones and achievements



