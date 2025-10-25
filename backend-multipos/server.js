const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const { connectDB, closeDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const branchRoutes = require('./routes/branches');
const warehouseRoutes = require('./routes/warehouses');
const inventoryRoutes = require('./routes/inventory');
const companyRoutes = require('./routes/companies');
const salesRoutes = require('./routes/sales');
const posRoutes = require('./routes/pos');
const ledgerRoutes = require('./routes/ledger');
const transferRoutes = require('./routes/transfers');
const dashboardRoutes = require('./routes/dashboard');
const hardwareRoutes = require('./routes/hardware');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const shiftRoutes = require('./routes/shifts');
const warehouseSalesRoutes = require('./routes/warehouseSales');
const retailerRoutes = require('./routes/retailers');
const warehouseSalesAnalyticsRoutes = require('./routes/warehouseSalesAnalytics');
const customerRoutes = require('./routes/customers');
const warehouseLedgerRoutes = require('./routes/warehouseLedger');
const companyLedgerRoutes = require('./routes/companyLedger');
const customerLedgerRoutes = require('./routes/customerLedger');
const receiptRoutes = require('./routes/receipt');
const reportsRoutes = require('./routes/reports');
const stockReportRoutes = require('./routes/stockReportRoutes');
const financialVoucherRoutes = require('./routes/financialVoucherRoutes');
const salespeopleRoutes = require('./routes/salespeople');
const returnsRoutes = require('./routes/returns');
const purchaseOrdersRoutes = require('./routes/purchaseOrders');
const app = express();

// Connect to MySQL (only if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3001',
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000, // 5 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/warehouse-sales', warehouseSalesRoutes);
app.use('/api/retailers', retailerRoutes);
app.use('/api/warehouse-sales-analytics', warehouseSalesAnalyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/warehouse-ledger', warehouseLedgerRoutes);
app.use('/api/company-ledger', companyLedgerRoutes);
app.use('/api/customer-ledger', customerLedgerRoutes);
app.use('/api/receipt', receiptRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/stock-reports', stockReportRoutes);
app.use('/api/financial-vouchers', financialVoucherRoutes);
app.use('/api/salespeople', salespeopleRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await closeDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
// Only start the server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(() => {
    const address = server.address();
    console.log(`🚀 Server running on http://${address.address}:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
  });
}

module.exports = app;
