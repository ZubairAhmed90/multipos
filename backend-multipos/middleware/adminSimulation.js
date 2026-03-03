const adminSimulation = (req, res, next) => {
  // If no user yet (auth hasn't run), skip
  if (!req.user || req.user.role !== 'ADMIN') return next();
  
  const scopeType = req.headers['x-simulate-scope-type'];
  const scopeId = req.headers['x-simulate-scope-id'];
  
  if (scopeType && scopeId) {
    if (scopeType === 'WAREHOUSE') {
      req.user.warehouseId = parseInt(scopeId);
      req.user.simulatedRole = 'WAREHOUSE_KEEPER';
    } else if (scopeType === 'BRANCH') {
      req.user.branchId = parseInt(scopeId);
      req.user.simulatedRole = 'CASHIER';
    }
    req.user.isSimulating = true;
  }
  
  next();
};

module.exports = adminSimulation;