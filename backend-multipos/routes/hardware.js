const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validateHardwareOperation } = require('../middleware/validation');
const {
  scanBarcode,
  printReceipt,
  openCashDrawer,
  getWeight,
  getHardwareDevices,
  registerDevice,
  updateDeviceStatus,
  deleteDevice,
  getHardwareSessions,
  getLatestEvents,
  getEventsSince,
  getHardwareStatus
} = require('../controllers/hardwareController');

// All routes require authentication
router.use(auth);

// Barcode Scanner
router.post('/scan',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']), // Temporarily disabled
  validateHardwareOperation,
  scanBarcode
);

// Receipt Printer
router.post('/print-receipt',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']), // Temporarily disabled
  validateHardwareOperation,
  printReceipt
);

// Cash Drawer
router.post('/open-cashdrawer',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']),
  validateHardwareOperation,
  openCashDrawer
);

// Weighing Scale
router.post('/scale',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']),
  validateHardwareOperation,
  getWeight
);

// Test route without RBAC to verify auth middleware
router.get('/test-auth',
  (req, res) => {
    res.json({
      success: true,
      message: 'Auth middleware working',
      user: req.user
    });
  }
);

// Test route to verify RBAC middleware
router.get('/test-rbac',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  (req, res) => {
    res.json({
      success: true,
      message: 'RBAC middleware working',
      user: req.user
    });
  }
);

// Hardware Device Management
router.get('/devices/all',
  rbac(['ADMIN']),
  getHardwareDevices
);

router.get('/devices/:scopeType/:scopeId',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER']), // Temporarily disabled
  getHardwareDevices
);

router.post('/devices/register',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER']), // Temporarily disabled
  validateHardwareOperation,
  registerDevice
);

router.put('/devices/:deviceId/status',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER']),
  validateHardwareOperation,
  updateDeviceStatus
);

router.delete('/devices/:id',
  rbac(['ADMIN']),
  deleteDevice
);

// Hardware Sessions
router.get('/sessions',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER']), // Temporarily disabled
  getHardwareSessions
);

// Real-time data endpoints (replaces WebSocket)
router.get('/events/latest',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']),
  getLatestEvents
);

router.get('/events/since',
  rbac(['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']),
  getEventsSince
);

router.get('/status',
  // rbac(['ADMIN', 'WAREHOUSE_KEEPER']), // Temporarily disabled
  getHardwareStatus
);

module.exports = router;
