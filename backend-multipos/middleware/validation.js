const { body } = require('express-validator');

// User validation for admin creation
const userValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('role')
    .isIn(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'])
    .withMessage('Role must be ADMIN, WAREHOUSE_KEEPER, or CASHIER'),
  
  body('branchId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (isNaN(value) || parseInt(value) < 1) {
        throw new Error('Branch ID must be a valid positive integer')
      }
      return true
    }),
  
  body('warehouseId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (isNaN(value) || parseInt(value) < 1) {
        throw new Error('Warehouse ID must be a valid positive integer')
      }
      return true
    }),
  
  body('shift')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (!['MORNING', 'AFTERNOON', 'NIGHT'].includes(value)) {
        throw new Error('Shift must be MORNING, AFTERNOON, or NIGHT')
      }
      return true
    })
];

// User validation for admin updates (optional fields)
const userUpdateValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER'])
    .withMessage('Role must be ADMIN, WAREHOUSE_KEEPER, or CASHIER'),
  
  body('branchId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (isNaN(value) || parseInt(value) < 1) {
        throw new Error('Branch ID must be a valid positive integer')
      }
      return true
    }),
  
  body('warehouseId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (isNaN(value) || parseInt(value) < 1) {
        throw new Error('Warehouse ID must be a valid positive integer')
      }
      return true
    }),
  
  body('shift')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (!['MORNING', 'AFTERNOON', 'NIGHT'].includes(value)) {
        throw new Error('Shift must be MORNING, AFTERNOON, or NIGHT')
      }
      return true
    })
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const refreshValidation = [
  body('refreshToken')
    .optional()
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Branch validation
const branchValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Branch name must be between 1 and 100 characters'),
  
  body('code')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Branch code must be between 1 and 10 characters')
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage('Branch code can only contain letters, numbers, hyphens, and underscores'),
  
  body('location')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty or null values
      }
      if (value.length > 20) {
        throw new Error('Phone must not exceed 20 characters');
      }
      return true;
    })
    .withMessage('Phone must not exceed 20 characters'),
  
  body('email')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty or null values
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    })
    .withMessage('Email must be a valid email address'),
  
  body('managerName')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty or null values
      }
      if (value.length > 100) {
        throw new Error('Manager name must not exceed 100 characters');
      }
      return true;
    })
    .withMessage('Manager name must not exceed 100 characters'),
  
  body('managerPhone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty or null values
      }
      if (value.length > 20) {
        throw new Error('Manager phone must not exceed 20 characters');
      }
      return true;
    })
    .withMessage('Manager phone must not exceed 20 characters'),
  
  body('managerEmail')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') {
        return true; // Allow empty or null values
      }
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    })
    .withMessage('Manager email must be a valid email address'),
  
  body('linkedWarehouseId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined || value === '') {
        return true; // Allow null, undefined, or empty string
      }
      if (!Number.isInteger(Number(value)) || Number(value) < 1) {
        throw new Error('Linked warehouse ID must be a valid positive integer');
      }
      return true;
    }),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),
  
  body('settings.openAccount')
    .optional()
    .isBoolean()
    .withMessage('Open account setting must be a boolean'),
  
  body('settings.allowCashierInventoryEdit')
    .optional()
    .isBoolean()
    .withMessage('Allow cashier inventory edit must be a boolean'),
  
  body('settings.allowWarehouseInventoryEdit')
    .optional()
    .isBoolean()
    .withMessage('Allow warehouse inventory edit must be a boolean'),
  
  body('settings.allowWarehouseKeeperCompanyAdd')
    .optional()
    .isBoolean()
    .withMessage('Allow warehouse keeper company add must be a boolean'),
  
  body('settings.allowReturnsByCashier')
    .optional()
    .isBoolean()
    .withMessage('Allow returns by cashier must be a boolean'),
  
  body('settings.allowReturnsByWarehouseKeeper')
    .optional()
    .isBoolean()
    .withMessage('Allow returns by warehouse keeper must be a boolean')
];

// Warehouse validation
const warehouseValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Warehouse name must be between 1 and 100 characters'),
  
  body('code')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Warehouse code must be between 1 and 10 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Warehouse code can only contain uppercase letters and numbers'),
  
  body('location')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location must be between 1 and 200 characters'),
  
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacity must be a positive integer'),
  
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  
  body('manager')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Manager name must not exceed 100 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Status must be active, inactive, or maintenance'),
  
  body('linkedBranchId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Linked branch ID must be a valid integer')
];

// Inventory item validation
// Inventory update validation (more lenient than create validation)
const inventoryItemUpdateValidation = [
  body('sku')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('SKU must be between 1 and 20 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('SKU can only contain uppercase letters, numbers, and hyphens'),
  
  body('barcode')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        return true; // Allow empty strings
      }
      if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 50) {
        return true; // Allow valid barcodes
      }
      throw new Error('Barcode must be between 1 and 50 characters');
    })
    .withMessage('Barcode must be between 1 and 50 characters'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Item name must be between 1 and 200 characters'),
  
  body('category')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  
  body('unit')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Unit must be between 1 and 20 characters'),
  
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  
  body('sellingPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number'),
  
  body('currentStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Current stock must be a non-negative integer'),
  
  body('minStockLevel')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock level must be a non-negative integer'),
  
  body('maxStockLevel')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Maximum stock level must be a non-negative integer'),
  
  body('scopeType')
    .optional()
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer')
];

const inventoryItemValidation = [
  body('sku')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('SKU must be between 1 and 20 characters')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('SKU can only contain uppercase letters, numbers, and hyphens'),
  
  body('barcode')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        return true; // Allow empty strings
      }
      if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 50) {
        return true; // Allow valid barcodes
      }
      throw new Error('Barcode must be between 1 and 50 characters');
    })
    .withMessage('Barcode must be between 1 and 50 characters'),
  
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Item name must be between 1 and 200 characters'),
  
  body('category')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category must be between 1 and 100 characters'),
  
  body('unit')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Unit must be between 1 and 20 characters'),
  
  body('costPrice')
    .isFloat({ min: 0 })
    .withMessage('Cost price must be a positive number'),
  
  body('sellingPrice')
    .isFloat({ min: 0 })
    .withMessage('Selling price must be a positive number'),
  
  body('currentStock')
    .isInt({ min: 0 })
    .withMessage('Current stock must be a non-negative integer'),
  
  body('minStockLevel')
    .isInt({ min: 0 })
    .withMessage('Minimum stock level must be a non-negative integer'),
  
  body('maxStockLevel')
    .isInt({ min: 0 })
    .withMessage('Maximum stock level must be a non-negative integer'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer')
];

// Company validation
const companyValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Company name must be between 1 and 200 characters'),
  
  body('contactPerson')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Contact person must be between 1 and 200 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  
  body('phone')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Phone number is required'),
  
  body('address')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Address must be between 1 and 500 characters'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended'])
    .withMessage('Status must be active, inactive, or suspended'),
  
  body('transactionType')
    .optional()
    .isIn(['CASH', 'CREDIT', 'CARD', 'DIGITAL'])
    .withMessage('Transaction type must be CASH, CREDIT, CARD, or DIGITAL'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE', 'COMPANY'])
    .withMessage('Scope type must be BRANCH, WAREHOUSE, or COMPANY'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer')
];

// Sales validation
const validateSale = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.inventoryItemId')
    .isInt({ min: 1 })
    .withMessage('Inventory item ID must be a valid positive integer'),
  
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('items.*.unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  
  body('items.*.discount')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Discount must be a non-negative number');
      }
      return true;
    })
    .withMessage('Discount must be a non-negative number'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer'),
  
  body('subtotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a non-negative number'),
  
  body('tax')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Tax must be a non-negative number');
      }
      return true;
    })
    .withMessage('Tax must be a non-negative number'),
  
  body('discount')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Discount must be a non-negative number');
      }
      return true;
    })
    .withMessage('Discount must be a non-negative number'),
  
  body('total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total must be a non-negative number'),
  
  body('paymentStatus')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])
    .withMessage('Payment status must be PENDING, COMPLETED, FAILED, or REFUNDED'),
  
  body('status')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'CANCELLED'])
    .withMessage('Status must be PENDING, COMPLETED, or CANCELLED'),
  
  body('paymentMethod')
    .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'])
    .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT'),
  
  body('customerInfo.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  
  body('customerInfo.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone cannot exceed 20 characters'),
  
  body('customerInfo.email')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Customer email must be a valid email address');
      }
      return true;
    })
    .withMessage('Customer email must be a valid email address'),
  
  body('customerInfo.address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Customer address cannot exceed 200 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Sale update validation (more lenient than create validation)
const validateSaleUpdate = [
  body('subtotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a non-negative number'),
  
  body('tax')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Tax must be a non-negative number');
      }
      return true;
    })
    .withMessage('Tax must be a non-negative number'),
  
  body('discount')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Discount must be a non-negative number');
      }
      return true;
    })
    .withMessage('Discount must be a non-negative number'),
  
  body('total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total must be a non-negative number'),
  
  body('paymentStatus')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])
    .withMessage('Payment status must be PENDING, COMPLETED, FAILED, or REFUNDED'),
  
  body('status')
    .optional()
    .isIn(['PENDING', 'COMPLETED', 'CANCELLED'])
    .withMessage('Status must be PENDING, COMPLETED, or CANCELLED'),
  
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'])
    .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT'),
  
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  
  body('customerPhone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone cannot exceed 20 characters'),
  
  body('customerEmail')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Customer email must be a valid email address');
      }
      return true;
    })
    .withMessage('Customer email must be a valid email address'),
  
  body('customerAddress')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Customer address cannot exceed 200 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Return validation
const validateReturn = [
  body('linkedSaleId')
    .isInt({ min: 1 })
    .withMessage('Linked sale ID must be a valid positive integer'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required for return'),
  
  body('items.*.inventoryItemId')
    .isInt({ min: 1 })
    .withMessage('Inventory item ID must be a valid positive integer'),
  
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('items.*.originalPrice')
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  
  body('reason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Return reason must be between 1 and 500 characters'),
  
  body('returnType')
    .isIn(['FULL', 'PARTIAL'])
    .withMessage('Return type must be FULL or PARTIAL'),
  
  body('refundMethod')
    .isIn(['CASH', 'CARD_REFUND', 'STORE_CREDIT'])
    .withMessage('Refund method must be CASH, CARD_REFUND, or STORE_CREDIT'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// POS hold bill validation
const validateHoldBill = [
  body('branchId')
    .isInt({ min: 1 })
    .withMessage('Branch ID must be a valid positive integer'),
  
  body('terminalId')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Terminal ID must be between 1 and 20 characters'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.inventoryItemId')
    .isInt({ min: 1 })
    .withMessage('Inventory item ID must be a valid positive integer'),
  
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('items.*.unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  
  body('items.*.discount')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Discount must be a non-negative number');
      }
      return true;
    })
    .withMessage('Discount must be a non-negative number'),
  
  body('customerInfo.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  
  body('customerInfo.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Customer phone cannot exceed 20 characters'),
  
  body('customerInfo.email')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Customer email must be a valid email address');
      }
      return true;
    })
    .withMessage('Customer email must be a valid email address'),
  
  body('customerInfo.address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Customer address cannot exceed 200 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('holdReason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Hold reason cannot exceed 200 characters')
];

// POS complete bill validation
const validateCompleteBill = [
  body('paymentMethod')
    .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'])
    .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT')
];

// Ledger entry validation
const validateLedgerEntry = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  
  body('reference')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Reference must be between 1 and 50 characters'),
  
  body('referenceId')
    .isMongoId()
    .withMessage('Reference ID must be a valid MongoDB ObjectId')
];

// Transfer validation
const validateTransfer = [
  body('from.scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('From scope type must be BRANCH or WAREHOUSE'),
  
  body('from.scopeId')
    .isMongoId()
    .withMessage('From scope ID must be a valid MongoDB ObjectId'),
  
  body('to.scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('To scope type must be BRANCH or WAREHOUSE'),
  
  body('to.scopeId')
    .isMongoId()
    .withMessage('To scope ID must be a valid MongoDB ObjectId'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required for transfer'),
  
  body('items.*.inventoryItemId')
    .isInt({ min: 1 })
    .withMessage('Inventory item ID must be a valid positive integer'),
  
  body('items.*.quantity')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  
  body('reason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Transfer reason must be between 1 and 500 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
];

// Transfer rejection validation
const validateTransferRejection = [
  body('rejectionReason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Rejection reason must be between 1 and 500 characters')
];

// Hardware operation validation
const validateHardwareOperation = [
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer'),
  
  body('terminalId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Terminal ID must be between 1 and 20 characters'),
  
  body('deviceId')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Device ID must be between 1 and 50 characters')
];

// Barcode scan validation
const validateBarcodeScan = [
  body('barcode')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Barcode must be between 1 and 50 characters'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer')
];

// Receipt print validation
const validateReceiptPrint = [
  body('saleId')
    .isInt({ min: 1 })
    .withMessage('Sale ID must be a valid positive integer'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer')
];

// Weighing scale validation
const validateWeighingScale = [
  body('itemId')
    .isMongoId()
    .withMessage('Item ID must be a valid MongoDB ObjectId'),
  
  body('weight')
    .isFloat({ min: 0 })
    .withMessage('Weight must be a positive number')
];

// Device registration validation
const validateDeviceRegistration = [
  body('deviceId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Device ID must be between 1 and 50 characters'),
  
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be between 1 and 100 characters'),
  
  body('type')
    .isIn(['BARCODE_SCANNER', 'RECEIPT_PRINTER', 'CASH_DRAWER', 'WEIGHING_SCALE', 'DISPLAY'])
    .withMessage('Device type must be BARCODE_SCANNER, RECEIPT_PRINTER, CASH_DRAWER, WEIGHING_SCALE, or DISPLAY'),
  
  body('scopeType')
    .isIn(['BRANCH', 'WAREHOUSE'])
    .withMessage('Scope type must be BRANCH or WAREHOUSE'),
  
  body('scopeId')
    .isInt({ min: 1 })
    .withMessage('Scope ID must be a valid positive integer'),
  
  body('terminalId')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Terminal ID must be between 1 and 20 characters')
];

module.exports = {
  userValidation,
  userUpdateValidation,
  loginValidation,
  refreshValidation,
  branchValidation,
  warehouseValidation,
  inventoryItemValidation,
  inventoryItemUpdateValidation,
  companyValidation,
  validateSale,
  validateSaleUpdate,
  validateReturn,
  validateHoldBill,
  validateCompleteBill,
  validateLedgerEntry,
  validateTransfer,
  validateTransferRejection,
  validateHardwareOperation,
  validateBarcodeScan,
  validateReceiptPrint,
  validateWeighingScale,
  validateDeviceRegistration,
  
  // Shift validation
  validateShift: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Shift name is required')
      .isLength({ max: 100 })
      .withMessage('Shift name cannot exceed 100 characters'),
    body('startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('endTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
    body('branchId')
      .isMongoId()
      .withMessage('Valid branch ID is required')
  ],
  
  // Shift update validation (all fields optional)
  validateShiftUpdate: [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Shift name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Shift name cannot exceed 100 characters'),
    body('startTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Start time must be in HH:MM format'),
    body('endTime')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('End time must be in HH:MM format'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean')
  ],
  
  validateShiftAssignment: [
    body('userId')
      .isMongoId()
      .withMessage('Valid user ID is required'),
    body('role')
      .isIn(['CASHIER', 'WAREHOUSE_KEEPER'])
      .withMessage('Role must be either CASHIER or WAREHOUSE_KEEPER')
  ],

  // Warehouse Sale Validation
  validateWarehouseSale: [
    body('retailerId')
      .notEmpty()
      .withMessage('Retailer ID is required')
      .isInt()
      .withMessage('Retailer ID must be a valid integer'),
    
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one item is required'),
    
    body('items.*.itemId')
      .notEmpty()
      .withMessage('Item ID is required')
      .isInt()
      .withMessage('Item ID must be a valid integer'),
    
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    
    body('items.*.unitPrice')
      .isFloat({ min: 0 })
      .withMessage('Unit price must be a positive number'),
    
    body('items.*.totalPrice')
      .isFloat({ min: 0 })
      .withMessage('Total price must be a positive number'),
    
    body('totalAmount')
      .isFloat({ min: 0 })
      .withMessage('Total amount must be a positive number'),
    
    body('taxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Tax amount must be a positive number'),
    
    body('discountAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Discount amount must be a positive number'),
    
    body('finalAmount')
      .isFloat({ min: 0 })
      .withMessage('Final amount must be a positive number'),
    
    body('paymentMethod')
      .optional()
      .isIn(['CASH', 'CARD', 'CREDIT', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_MONEY'])
      .withMessage('Payment method must be CASH, CARD, CREDIT, BANK_TRANSFER, CHEQUE, or MOBILE_MONEY'),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters')
  ],

  // Retailer Validation
  validateRetailer: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    
    body('address')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Address must not exceed 200 characters'),
    
    body('city')
      .optional()
      .isLength({ max: 50 })
      .withMessage('City must not exceed 50 characters'),
    
    body('state')
      .optional()
      .isLength({ max: 50 })
      .withMessage('State must not exceed 50 characters'),
    
    body('zipCode')
      .optional()
      .isLength({ max: 10 })
      .withMessage('ZIP code must not exceed 10 characters'),
    
    body('businessType')
      .optional()
      .isIn(['RETAILER', 'WHOLESALER', 'DISTRIBUTOR', 'OTHER'])
      .withMessage('Business type must be RETAILER, WHOLESALER, DISTRIBUTOR, or OTHER'),
    
    body('taxId')
      .optional()
      .isLength({ max: 20 })
      .withMessage('Tax ID must not exceed 20 characters'),
    
    body('creditLimit')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Credit limit must be a positive number'),
    
    body('paymentTerms')
      .optional()
      .isIn(['CASH', 'NET_15', 'NET_30', 'NET_60'])
      .withMessage('Payment terms must be CASH, NET_15, NET_30, or NET_60'),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters')
  ],

  // Customer Validation
  validateCustomer: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),
    
    body('address')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Address must not exceed 200 characters'),
    
    body('city')
      .optional()
      .isLength({ max: 50 })
      .withMessage('City must not exceed 50 characters'),
    
    body('state')
      .optional()
      .isLength({ max: 50 })
      .withMessage('State must not exceed 50 characters'),
    
    body('zipCode')
      .optional()
      .isLength({ max: 10 })
      .withMessage('ZIP code must not exceed 10 characters'),
    
    body('customerType')
      .optional()
      .isIn(['INDIVIDUAL', 'BUSINESS', 'RETAILER', 'WHOLESALER'])
      .withMessage('Customer type must be INDIVIDUAL, BUSINESS, RETAILER, or WHOLESALER'),
    
    body('creditLimit')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Credit limit must be a positive number'),
    
    body('paymentTerms')
      .optional()
      .isIn(['CASH', 'NET_15', 'NET_30', 'NET_60'])
      .withMessage('Payment terms must be CASH, NET_15, NET_30, or NET_60'),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters')
  ],

  // Credit/Debit Transaction Validation
  validateCreditDebitTransaction: [
    body('customerId')
      .notEmpty()
      .withMessage('Customer ID is required')
      .isInt()
      .withMessage('Customer ID must be a valid integer'),
    
    body('transactionType')
      .isIn(['CREDIT', 'DEBIT'])
      .withMessage('Transaction type must be CREDIT or DEBIT'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    
    body('description')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Description must be between 1 and 200 characters'),
    
    body('referenceType')
      .optional()
      .isIn(['SALE', 'RETURN', 'PAYMENT', 'ADJUSTMENT', 'REFUND', 'OTHER'])
      .withMessage('Reference type must be SALE, RETURN, PAYMENT, ADJUSTMENT, REFUND, or OTHER'),
    
    body('referenceId')
      .optional()
      .isInt()
      .withMessage('Reference ID must be a valid integer'),
    
    body('paymentMethod')
      .optional()
      .isIn(['CASH', 'CARD', 'DIGITAL', 'CREDIT', 'CHEQUE'])
      .withMessage('Payment method must be CASH, CARD, DIGITAL, CREDIT, or CHEQUE'),
    
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes must not exceed 500 characters')
  ],

  // Billing Validation
  validateBilling: [
    body('invoiceNumber')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 50) {
          return true; // Allow valid invoice numbers
        }
        throw new Error('Invoice number must be between 1 and 50 characters');
      })
      .withMessage('Invoice number must be between 1 and 50 characters'),
    
    body('clientName')
      .custom((value) => {
        if (value === null || value === undefined) {
          return true; // Allow null or undefined values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 200) {
          return true; // Allow valid client names
        }
        throw new Error('Client name must be between 1 and 200 characters');
      })
      .withMessage('Client name must be between 1 and 200 characters'),
    
    body('clientEmail')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
          return true; // Basic email validation
        }
        throw new Error('Client email must be a valid email address');
      })
      .withMessage('Client email must be a valid email address'),
    
    body('clientPhone')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 20) {
          return true; // Allow valid phone numbers
        }
        throw new Error('Client phone must not exceed 20 characters');
      })
      .withMessage('Client phone must not exceed 20 characters'),
    
    body('clientAddress')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 500) {
          return true; // Allow valid addresses
        }
        throw new Error('Client address must not exceed 500 characters');
      })
      .withMessage('Client address must not exceed 500 characters'),
    
    body('amount')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid amounts
        }
        throw new Error('Amount must be a non-negative number');
      })
      .withMessage('Amount must be a non-negative number'),
    
    body('tax')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid tax amounts
        }
        throw new Error('Tax must be a non-negative number');
      })
      .withMessage('Tax must be a non-negative number'),
    
    body('discount')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid discount amounts
        }
        throw new Error('Discount must be a non-negative number');
      })
      .withMessage('Discount must be a non-negative number'),
    
    body('dueDate')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return true; // Allow YYYY-MM-DD format
        }
        throw new Error('Due date must be a valid date in YYYY-MM-DD format');
      })
      .withMessage('Due date must be a valid date in YYYY-MM-DD format'),
    
    body('service')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 200) {
          return true; // Allow valid services
        }
        throw new Error('Service must be between 1 and 200 characters');
      })
      .withMessage('Service must be between 1 and 200 characters'),
    
    body('description')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 1000) {
          return true; // Allow valid descriptions
        }
        throw new Error('Description must not exceed 1000 characters');
      })
      .withMessage('Description must not exceed 1000 characters'),
    
    body('status')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
        const normalizedValue = value.toLowerCase(); // Normalize to lowercase
        if (validStatuses.includes(normalizedValue)) {
          return true; // Allow valid statuses (case-insensitive)
        }
        throw new Error('Status must be pending, paid, overdue, or cancelled');
      })
      .withMessage('Status must be pending, paid, overdue, or cancelled'),
    
    body('paymentMethod')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const validMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'];
        if (validMethods.includes(value)) {
          return true; // Allow valid payment methods
        }
        throw new Error('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT');
      })
      .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT'),
    
    body('paymentDate')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return true; // Allow YYYY-MM-DD format
        }
        throw new Error('Payment date must be a valid date in YYYY-MM-DD format');
      })
      .withMessage('Payment date must be a valid date in YYYY-MM-DD format'),
    
    body('notes')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 500) {
          return true; // Allow valid notes
        }
        throw new Error('Notes must not exceed 500 characters');
      })
      .withMessage('Notes must not exceed 500 characters')
  ],

  // Billing Update Validation (more lenient than create validation)
  validateBillingUpdate: [
    body('invoiceNumber')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 50) {
          return true; // Allow valid invoice numbers
        }
        throw new Error('Invoice number must be between 1 and 50 characters');
      })
      .withMessage('Invoice number must be between 1 and 50 characters'),
    
    body('clientName')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined) {
          return true; // Allow null or undefined values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 200) {
          return true; // Allow valid client names
        }
        throw new Error('Client name must be between 1 and 200 characters');
      })
      .withMessage('Client name must be between 1 and 200 characters'),
    
    body('clientEmail')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return true; // Allow valid email addresses
        }
        throw new Error('Client email must be a valid email address');
      })
      .withMessage('Client email must be a valid email address'),
    
    body('clientPhone')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 20) {
          return true; // Allow valid phone numbers
        }
        throw new Error('Client phone must not exceed 20 characters');
      })
      .withMessage('Client phone must not exceed 20 characters'),
    
    body('clientAddress')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 500) {
          return true; // Allow valid addresses
        }
        throw new Error('Client address must not exceed 500 characters');
      })
      .withMessage('Client address must not exceed 500 characters'),
    
    body('amount')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid amounts
        }
        throw new Error('Amount must be a non-negative number');
      })
      .withMessage('Amount must be a non-negative number'),
    
    body('tax')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid tax amounts
        }
        throw new Error('Tax must be a non-negative number');
      })
      .withMessage('Tax must be a non-negative number'),
    
    body('discount')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          return true; // Allow valid discount amounts
        }
        throw new Error('Discount must be a non-negative number');
      })
      .withMessage('Discount must be a non-negative number'),
    
    body('dueDate')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && !isNaN(Date.parse(value))) {
          return true; // Allow valid dates
        }
        throw new Error('Due date must be a valid date');
      })
      .withMessage('Due date must be a valid date'),
    
    body('service')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 200) {
          return true; // Allow valid services
        }
        throw new Error('Service must be between 1 and 200 characters');
      })
      .withMessage('Service must be between 1 and 200 characters'),
    
    body('description')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 1000) {
          return true; // Allow valid descriptions
        }
        throw new Error('Description must not exceed 1000 characters');
      })
      .withMessage('Description must not exceed 1000 characters'),
    
    body('status')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
        const normalizedValue = value.toLowerCase();
        if (validStatuses.includes(normalizedValue)) {
          return true; // Allow valid statuses (case-insensitive)
        }
        throw new Error('Status must be pending, paid, overdue, or cancelled');
      })
      .withMessage('Status must be pending, paid, overdue, or cancelled'),
    
    body('paymentMethod')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'].includes(value)) {
          return true; // Allow valid payment methods
        }
        throw new Error('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT');
      })
      .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, or MOBILE_PAYMENT'),
    
    body('paymentDate')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && !isNaN(Date.parse(value))) {
          return true; // Allow valid dates
        }
        throw new Error('Payment date must be a valid date');
      })
      .withMessage('Payment date must be a valid date'),
    
    body('notes')
      .optional()
      .custom((value) => {
        if (value === null || value === undefined || value === '') {
          return true; // Allow null, undefined, or empty values
        }
        if (typeof value === 'string' && value.trim().length <= 500) {
          return true; // Allow valid notes
        }
        throw new Error('Notes must not exceed 500 characters');
      })
      .withMessage('Notes must not exceed 500 characters')
  ]
};
