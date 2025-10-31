const { executeQuery } = require('../config/database');

// GET /api/returns/restock
// Admin-only read of Return Restock movements with filters
async function getReturnRestock(req, res) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { scopeType, scopeId, status, search, from, to, page = 1, limit = 100 } = req.query;

    const where = ["sm.movement_type = 'RETURN'"];
    const params = [];

    if (scopeType && (scopeType === 'WAREHOUSE' || scopeType === 'BRANCH')) {
      where.push('sm.to_scope_type = ?');
      params.push(scopeType);
    }
    if (scopeId) {
      where.push('sm.to_scope_id = ?');
      params.push(scopeId);
    }
    if (from) {
      where.push('DATE(sm.created_at) >= ?');
      params.push(from);
    }
    if (to) {
      where.push('DATE(sm.created_at) <= ?');
      params.push(to);
    }
    if (search) {
      where.push('(ii.sku LIKE ? OR ii.name LIKE ? OR s.invoice_no LIKE ? OR b.name LIKE ? OR w.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status && ['PENDING','PARTIAL','COMPLETED'].includes(status)) {
      if (status === 'PENDING') where.push('(COALESCE(sm.quantity,0)=0)');
      if (status === 'PARTIAL') where.push('(COALESCE(sm.quantity,0)>0 AND COALESCE(sm.quantity,0)<COALESCE(sri.quantity,0))');
      if (status === 'COMPLETED') where.push('(COALESCE(sm.quantity,0)=COALESCE(sri.quantity,0))');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const baseSelect = `SELECT 
      sm.id,
      sm.created_at AS date,
      sm.to_scope_type AS scope_type,
      sm.to_scope_id AS scope_id,
      CASE WHEN sm.to_scope_type='WAREHOUSE' THEN w.name ELSE b.name END AS scope_name,
      s.invoice_no,
      ii.sku,
      ii.name AS item_name,
      COALESCE(sri.quantity,0) AS returned_qty,
      COALESCE(sm.quantity,0) AS restocked_qty,
      (COALESCE(sri.quantity,0) - COALESCE(sm.quantity,0)) AS not_restocked_qty,
      u.username AS performed_by
    FROM stock_movements sm
    LEFT JOIN inventory_items ii ON ii.id = sm.inventory_item_id
    LEFT JOIN sales_return_items sri ON sri.return_id = sm.reference_id AND sri.inventory_item_id = sm.inventory_item_id
    LEFT JOIN sales_returns sr ON sr.id = sm.reference_id
    LEFT JOIN sales s ON s.id = sr.original_sale_id
    LEFT JOIN users u ON u.id = sm.created_by
    LEFT JOIN warehouses w ON (sm.to_scope_type='WAREHOUSE' AND w.id = sm.to_scope_id)
    LEFT JOIN branches b ON (sm.to_scope_type='BRANCH' AND b.id = sm.to_scope_id)`;

    const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const orderLimit = ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';

    let rows = [];
    try {
      rows = await executeQuery(baseSelect + whereClause + orderLimit, [...params, parseInt(limit), offset]);
    } catch (e) {
      console.error('Error executing return restock query:', e);
      // Fallback if table/columns not present yet
      return res.json({ success: true, data: [], hint: 'Return restock log not available yet.' });
    }

    return res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Error in getReturnRestock:', err);
    return res.status(500).json({ success: false, message: 'Error loading return restock log', error: err.message });
  }
}

// POST /api/returns/:returnId/items/:itemId/restock { qty }
// Decrease remaining qty on return line and increase inventory stock
async function restockReturnItem(req, res) {
  try {
    const { returnId, itemId } = req.params;
    const { qty } = req.body || {};

    const restockQty = parseFloat(qty);
    if (!Number.isFinite(restockQty) || restockQty <= 0) {
      return res.status(400).json({ success: false, message: 'qty must be a positive number' });
    }

    // Load return line
    const items = await executeQuery(
      `SELECT sri.id, sri.return_id, sri.inventory_item_id,
              sri.quantity AS total_qty,
              sri.remaining_quantity,
              sr.return_no, sr.status,
              ii.scope_type, ii.scope_id
       FROM sales_return_items sri
       LEFT JOIN sales_returns sr ON sr.id = sri.return_id
       LEFT JOIN inventory_items ii ON ii.id = sri.inventory_item_id
       WHERE sri.id = ? AND sri.return_id = ?`,
      [itemId, returnId]
    );

    if (!items || items.length === 0) {
      return res.status(404).json({ success: false, message: 'Return item not found' });
    }

    const line = items[0];
    const remainingBefore = Number(line.remaining_quantity);
    if (restockQty > remainingBefore) {
      return res.status(400).json({ success: false, message: 'qty exceeds remaining to restock' });
    }

    // Start transaction
    await executeQuery('START TRANSACTION');
    try {
      // Decrease remaining on return line
      await executeQuery(
        `UPDATE sales_return_items 
         SET remaining_quantity = remaining_quantity - ?
         WHERE id = ? AND return_id = ?`,
        [restockQty, itemId, returnId]
      );

      // Increase inventory stock
      await executeQuery(
        `UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`,
        [restockQty, line.inventory_item_id]
      );

      // Optional: insert stock movement (if table exists)
      try {
        await executeQuery(
          `INSERT INTO stock_movements (movement_type, inventory_item_id, quantity, reference_type, reference_id, to_scope_type, to_scope_id, created_by, created_at)
           VALUES ('RETURN', ?, ?, 'RETURN', ?, ?, ?, ?, NOW())`,
          [line.inventory_item_id, restockQty, returnId, line.scope_type, line.scope_id, req.user?.id || null]
        );
      } catch (e) {
        console.error('Error inserting stock movement:', e);
        // ignore if table does not exist
      }

      // If all items for this return are now zero, mark return completed
      const remaining = await executeQuery(
        `SELECT SUM(remaining_quantity) AS remaining FROM sales_return_items WHERE return_id = ?`,
        [returnId]
      );
      const remainingQty = Number(remaining?.[0]?.remaining || 0);
      if (remainingQty === 0) {
        await executeQuery(`UPDATE sales_returns SET status = 'completed' WHERE id = ?`, [returnId]);
      }

      await executeQuery('COMMIT');

      const remainingAfter = remainingBefore - restockQty;

      return res.json({
        success: true,
        message: 'Return restocked successfully',
        data: {
          returnId: Number(returnId),
          itemId: Number(itemId),
          restocked: restockQty,
          totalReturned: Number(line.total_qty),
          remainingAfter,
          completed: remainingQty === 0
        }
      });
    } catch (txErr) {
      await executeQuery('ROLLBACK');
      throw txErr;
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error restocking return item', error: err.message });
  }
}

module.exports = { getReturnRestock, restockReturnItem };