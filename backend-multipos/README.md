# Backend Multi-POS System

A Node.js Express backend with MongoDB for a multi-POS (Point of Sale) system with role-based access control.

## Features

- **Authentication System**: JWT-based authentication with refresh tokens
- **Role-Based Access Control**: ADMIN, WAREHOUSE_KEEPER, CASHIER roles
- **Security Middleware**: Helmet, CORS, Rate limiting, Input validation
- **MongoDB Integration**: Mongoose ODM with proper schemas
- **Testing**: Jest + Supertest for API testing
- **Error Handling**: Comprehensive error handling middleware
- **Branch Management**: Complete CRUD operations for branches with configurable settings
- **Warehouse Management**: Warehouse CRUD with branch linking
- **Inventory Management**: Full inventory system with scope-based access
- **Company Management**: Customer/supplier management with transaction types
- **POS System**: Point of Sale functionality with auto-provisioning
- **Sales Management**: Complete sales and returns processing
- **Multi-tab POS**: Held bills functionality for multi-tab operations
- **Invoice Sequencing**: Unique invoice and return number generation per branch
- **Financial Management**: Comprehensive ledger system with debit/credit operations
- **Transfer System**: Inventory transfers between branches/warehouses with approval workflow
- **Dashboard Analytics**: Real-time sales, inventory, and financial summaries
- **Supplier Management**: Top suppliers analysis and transaction tracking
- **Hardware Integration**: Barcode scanners, receipt printers, cash drawers, weighing scales
- **WebSocket Support**: Real-time hardware events and multi-tab POS synchronization
- **Receipt Printing**: ESC/POS, JSON, and PDF receipt formatting
- **Multi-tab POS**: Shared hardware across multiple POS terminals

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit
- **Testing**: Jest + Supertest
- **Logging**: Morgan
- **WebSocket**: Socket.IO for real-time communication
- **Hardware**: ESC/POS printer support, barcode scanning, cash drawer control

## Project Structure

```
backend-multipos/
├── config/
│   ├── database.js          # MongoDB connection configuration
│   └── socketio.js          # Socket.IO WebSocket server configuration
├── controllers/
│   ├── authController.js    # Authentication controller
│   ├── branchController.js  # Branch CRUD controller
│   ├── warehouseController.js # Warehouse CRUD controller
│   ├── inventoryController.js # Inventory CRUD controller
│   ├── companyController.js # Company CRUD controller
│   ├── salesController.js   # Sales and returns controller
│   ├── posController.js     # POS held bills controller
│   ├── ledgerController.js  # Financial ledger controller
│   ├── transferController.js # Transfer management controller
│   ├── dashboardController.js # Dashboard analytics controller
│   └── hardwareController.js # Hardware integration controller
├── middleware/
│   ├── auth.js              # JWT authentication middleware
│   ├── rbac.js              # Role-based access control
│   ├── errorHandler.js      # Error handling middleware
│   ├── validation.js        # Input validation middleware
│   └── permissions.js       # Branch settings permission checks
├── models/
│   ├── User.js              # User model with schema
│   ├── Branch.js            # Branch model with settings
│   ├── Warehouse.js         # Warehouse model
│   ├── InventoryItem.js     # Inventory item model
│   ├── Company.js           # Company model
│   ├── POS.js               # POS model
│   ├── BranchLedger.js      # Branch ledger and invoice sequences
│   ├── Sale.js              # Sale model
│   ├── SalesReturn.js       # Sales return model
│   ├── HeldBill.js          # Held bill model for multi-tab POS
│   ├── Ledger.js            # Financial ledger model
│   ├── Transfer.js          # Transfer model
│   ├── HardwareDevice.js    # Hardware device model
│   └── HardwareSession.js   # Hardware session model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── branches.js          # Branch routes
│   ├── warehouses.js        # Warehouse routes
│   ├── inventory.js         # Inventory routes
│   ├── companies.js         # Company routes
│   ├── sales.js             # Sales and returns routes
│   ├── pos.js               # POS held bills routes
│   ├── ledger.js            # Financial ledger routes
│   ├── transfers.js         # Transfer management routes
│   ├── dashboard.js         # Dashboard analytics routes
│   └── hardware.js          # Hardware integration routes
├── utils/
│   ├── jwt.js               # JWT utility functions
│   └── receiptFormatter.js   # Receipt formatting utilities
├── tests/
│   ├── health.test.js       # Health endpoint tests
│   ├── crud.test.js         # CRUD operations tests
│   └── pos-sales.test.js    # POS and sales functionality tests
├── server.js                # Main application file
├── package.json             # Dependencies and scripts
└── .env                     # Environment variables
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend-multipos
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.template .env
```

4. Configure environment variables in `.env`:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/multipos
MONGODB_URI_TEST=mongodb://localhost:27017/multipos_test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

5. Start MongoDB server (make sure MongoDB is installed and running)

6. Run the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication Routes

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (requires auth)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user (requires auth)

### Branch Routes

- `GET /api/branches` - Get all branches (Admin, Warehouse Keeper)
- `GET /api/branches/:id` - Get single branch (Admin, Warehouse Keeper)
- `POST /api/branches` - Create new branch (Admin only)
- `PUT /api/branches/:id` - Update branch (Admin only)
- `DELETE /api/branches/:id` - Delete branch (Admin only)

### Warehouse Routes

- `GET /api/warehouses` - Get all warehouses (Admin, Warehouse Keeper)
- `GET /api/warehouses/:id` - Get single warehouse (Admin, Warehouse Keeper)
- `POST /api/warehouses` - Create new warehouse (Admin only)
- `PUT /api/warehouses/:id` - Update warehouse (Admin only)
- `DELETE /api/warehouses/:id` - Delete warehouse (Admin only)

### Inventory Routes

- `GET /api/inventory` - Get all inventory items (Admin, Warehouse Keeper, Cashier)
- `GET /api/inventory/:id` - Get single inventory item (Admin, Warehouse Keeper, Cashier)
- `POST /api/inventory` - Create new inventory item (Admin, Warehouse Keeper with permission)
- `PUT /api/inventory/:id` - Update inventory item (Admin, Warehouse Keeper with permission)
- `DELETE /api/inventory/:id` - Delete inventory item (Admin only)
- `PATCH /api/inventory/:id/quantity` - Update inventory quantity (Admin, Warehouse Keeper with permission)

### Company Routes

- `GET /api/companies` - Get all companies (Admin, Warehouse Keeper)
- `GET /api/companies/:id` - Get single company (Admin, Warehouse Keeper)
- `POST /api/companies` - Create new company (Admin, Warehouse Keeper with permission)
- `PUT /api/companies/:id` - Update company (Admin, Warehouse Keeper)
- `DELETE /api/companies/:id` - Delete company (Admin only)

### Sales Routes

- `GET /api/sales` - Get all sales (Admin, Cashier, Warehouse Keeper)
- `GET /api/sales/:id` - Get single sale (Admin, Cashier, Warehouse Keeper)
- `POST /api/sales` - Create new sale (Admin, Cashier)
- `GET /api/sales/returns` - Get all returns (Admin, Cashier, Warehouse Keeper)
- `GET /api/sales/returns/:id` - Get single return (Admin, Cashier, Warehouse Keeper)
- `POST /api/sales/returns` - Create new return (Admin, Cashier, Warehouse Keeper)

### POS Routes

- `GET /api/pos/hold` - Get all held bills (Admin, Cashier)
- `GET /api/pos/hold/:id` - Get single held bill (Admin, Cashier)
- `POST /api/pos/hold` - Hold a bill (Admin, Cashier)
- `PUT /api/pos/hold/:id/resume` - Resume a held bill (Admin, Cashier)
- `PUT /api/pos/hold/:id/complete` - Complete a held bill (Admin, Cashier)
- `DELETE /api/pos/hold/:id` - Delete a held bill (Admin, Cashier)

### Financial Ledger Routes

- `GET /api/ledger/:scopeType/:scopeId/:partyType/:partyId` - Get ledger (Admin, Warehouse Keeper)
- `GET /api/ledger/scope/:scopeType/:scopeId` - Get all ledgers for scope (Admin, Warehouse Keeper)
- `GET /api/ledger/:scopeType/:scopeId/:partyType/:partyId/entries` - Get ledger entries (Admin, Warehouse Keeper)
- `GET /api/ledger/balance/:scopeType/:scopeId` - Get balance summary (Admin, Warehouse Keeper)
- `POST /api/ledger/:scopeType/:scopeId/:partyType/:partyId/debit` - Add debit entry (Admin, Warehouse Keeper)
- `POST /api/ledger/:scopeType/:scopeId/:partyType/:partyId/credit` - Add credit entry (Admin, Warehouse Keeper)

### Transfer Routes

- `GET /api/transfers` - Get all transfers (Admin, Warehouse Keeper)
- `GET /api/transfers/:id` - Get single transfer (Admin, Warehouse Keeper)
- `POST /api/transfers` - Create transfer (Admin, Warehouse Keeper)
- `PUT /api/transfers/:id/approve` - Approve transfer (Admin, Warehouse Keeper)
- `PUT /api/transfers/:id/reject` - Reject transfer (Admin, Warehouse Keeper)
- `PUT /api/transfers/:id/complete` - Complete transfer (Admin, Warehouse Keeper)
- `PUT /api/transfers/:id/cancel` - Cancel transfer (Admin, Warehouse Keeper)

### Dashboard Routes

- `GET /api/dashboard/sales-summary` - Sales analytics dashboard (Admin, Warehouse Keeper, Cashier)
- `GET /api/dashboard/inventory-summary` - Inventory analytics dashboard (Admin, Warehouse Keeper)
- `GET /api/dashboard/suppliers` - Suppliers analytics dashboard (Admin, Warehouse Keeper)
- `GET /api/dashboard/companies` - Companies analytics dashboard (Admin, Warehouse Keeper)
- `GET /api/dashboard/financial-summary` - Financial analytics dashboard (Admin, Warehouse Keeper)

### Hardware Integration Routes

- `POST /api/hardware/scan` - Scan barcode (Admin, Warehouse Keeper, Cashier)
- `POST /api/hardware/print-receipt` - Print receipt/invoice (Admin, Warehouse Keeper, Cashier)
- `POST /api/hardware/open-cashdrawer` - Open cash drawer (Admin, Warehouse Keeper, Cashier)
- `POST /api/hardware/scale` - Get weight from scale (Admin, Warehouse Keeper, Cashier)
- `GET /api/hardware/devices/:scopeType/:scopeId` - Get hardware devices (Admin, Warehouse Keeper)
- `POST /api/hardware/devices/register` - Register hardware device (Admin, Warehouse Keeper)
- `PUT /api/hardware/devices/:deviceId/status` - Update device status (Admin, Warehouse Keeper)
- `GET /api/hardware/sessions` - Get hardware sessions (Admin, Warehouse Keeper)

### WebSocket Events

- **Connection**: `ws://localhost:3000/ws/hardware`
- **Events**: `SCAN`, `PRINT`, `OPEN_DRAWER`, `WEIGH`, `DISPLAY`
- **Rooms**: Scope-based rooms for multi-tab POS synchronization

### Health Check

- `GET /api/health` - Server health status

## User Roles & Permissions

### ADMIN
- Full system access
- Can CRUD all resources
- Bypasses all permission checks

### WAREHOUSE_KEEPER
- Can view branches and warehouses
- Can manage inventory (with branch settings check)
- Can manage companies (with branch settings check)
- Cannot delete inventory or companies

### CASHIER
- Can view inventory items
- Cannot create/edit inventory unless branch setting allows
- Cannot manage companies
- Cannot access branch/warehouse management
- Can create sales and process returns (with branch settings)
- Can hold, resume, and complete bills
- Can view sales and returns history

## Branch Settings

Each branch has configurable settings that control permissions:

- `openAccount`: Allow open account transactions
- `allowCashierInventoryEdit`: Allow cashiers to edit inventory
- `allowWarehouseInventoryEdit`: Allow warehouse keepers to edit inventory
- `allowWarehouseKeeperCompanyAdd`: Allow warehouse keepers to add companies
- `allowReturnsByCashier`: Allow cashiers to process returns
- `allowReturnsByWarehouseKeeper`: Allow warehouse keepers to process returns
- `autoProvisionPOS`: Auto-provision POS terminal when branch is created
- `autoProvisionInventory`: Auto-provision inventory namespace when branch is created
- `autoProvisionLedger`: Auto-provision branch ledger when branch is created

## Testing

Run tests:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **Health Check Tests**: Basic server functionality
- **CRUD Tests**: Complete CRUD operations for all models
- **Permission Tests**: Role-based access control validation
- **Branch Settings Tests**: Permission checks based on branch settings
- **POS and Sales Tests**: Complete POS and sales functionality validation
  - Sales reduce inventory, returns restore inventory
  - Cashier can hold/resume bills
  - Invoice sequence per branch is unique
- **Financial and Dashboard Tests**: Comprehensive financial module validation
  - Ledger balances update correctly with debit/credit operations
  - Transfers decrement source and increment destination on approval
  - Dashboards return correct aggregated data
  - Financial calculations and validations
- **Hardware and WebSocket Tests**: Complete hardware integration validation
  - Barcode scanning functionality and data validation
  - Receipt printing with ESC/POS, JSON, and PDF formats
  - Cash drawer control and timing validation
  - Weighing scale integration and price calculations
  - WebSocket event handling and room management
  - Multi-tab POS workflow validation
  - Auto-provisioning of POS and ledger
  - Permission-based access control

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request rate limiting
- **Input Validation**: Request data validation
- **Password Hashing**: bcrypt password hashing
- **JWT Tokens**: Secure authentication tokens
- **Role-Based Access**: Fine-grained permissions
- **Branch Settings**: Configurable permission controls

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/multipos |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 24h |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | 7d |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 300000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |

## License

MIT
