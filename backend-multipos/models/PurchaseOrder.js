const { executeQuery, pool } = require('../config/database');

class PurchaseOrder {
  constructor(data) {
    this.id = data.id;
    this.orderNumber = data.order_number;
    this.supplierId = data.supplier_id;
    this.scopeType = data.scope_type;
    this.scopeId = data.scope_id;
    this.orderDate = data.order_date;
    this.expectedDelivery = data.expected_delivery;
    this.actualDelivery = data.actual_delivery;
    this.status = data.status;
    this.totalAmount = data.total_amount;
    this.notes = data.notes;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // Related data (populated by JOINs)
    this.supplierName = data.supplier_name;
    this.supplierContact = data.supplier_contact;
    this.supplierPhone = data.supplier_phone;
    this.supplierEmail = data.supplier_email;
    this.scopeName = data.scope_name;
    this.createdByName = data.created_by_name;
    this.items = data.items || [];
  }

  // Static method to create a new purchase order
  static async create(orderData) {
    const {
      orderNumber, supplierId, scopeType, scopeId, orderDate,
      expectedDelivery, status, totalAmount, notes, createdBy
    } = orderData;

    const result = await executeQuery(
      `INSERT INTO purchase_orders (
        order_number, supplier_id, scope_type, scope_id, order_date,
        expected_delivery, status, total_amount, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, supplierId, scopeType, scopeId, orderDate,
        expectedDelivery || null, status || 'PENDING', totalAmount || 0.00,
        notes || null, createdBy
      ]
    );

    return await PurchaseOrder.findById(result.insertId || result.lastID);
  }

  // Static method to find purchase order by ID
  static async findById(id) {
    try {
      // First, get the basic purchase order data
      const [baseRows] = await pool.execute(
        'SELECT * FROM purchase_orders WHERE id = ?',
        [id]
      );
      
      if (baseRows.length === 0) return null;
      
      const poData = baseRows[0];
      
      // Get supplier info if supplier_id exists
      let supplierName = null;
      let supplierContact = null;
      let supplierPhone = null;
      let supplierEmail = null;
      
      if (poData.supplier_id) {
        try {
          const [suppliers] = await pool.execute(
            'SELECT name, contact_person, phone, email FROM companies WHERE id = ?',
            [poData.supplier_id]
          );
          if (suppliers.length > 0) {
            supplierName = suppliers[0].name;
            supplierContact = suppliers[0].contact_person;
            supplierPhone = suppliers[0].phone;
            supplierEmail = suppliers[0].email;
          }
        } catch (err) {
          console.error('[PurchaseOrder.findById] Error fetching supplier:', err);
        }
      }
      
      // Get scope name (branch or warehouse) - use scope_id as default
      let scopeName = poData.scope_id;
      if (poData.scope_type === 'BRANCH' && poData.scope_id) {
        try {
          // Try to get branch name by ID first
          const [branchesById] = await pool.execute(
            'SELECT name FROM branches WHERE id = ? LIMIT 1',
            [poData.scope_id]
          );
          if (branchesById && branchesById.length > 0 && branchesById[0]?.name) {
            scopeName = branchesById[0].name;
          } else {
            // Try by name if ID didn't work
            const [branchesByName] = await pool.execute(
              'SELECT name FROM branches WHERE name = ? LIMIT 1',
              [String(poData.scope_id)]
            );
            if (branchesByName && branchesByName.length > 0 && branchesByName[0]?.name) {
              scopeName = branchesByName[0].name;
            }
          }
        } catch (branchErr) {
          // Silently fail - use scope_id as fallback
          console.warn('[PurchaseOrder.findById] Branch lookup failed, using scope_id:', branchErr.message);
        }
      } else if (poData.scope_type === 'WAREHOUSE' && poData.scope_id) {
        try {
          // Try to get warehouse name by ID first
          const [warehousesById] = await pool.execute(
            'SELECT name FROM warehouses WHERE id = ? LIMIT 1',
            [poData.scope_id]
          );
          if (warehousesById && warehousesById.length > 0 && warehousesById[0]?.name) {
            scopeName = warehousesById[0].name;
          } else {
            // Try by name if ID didn't work
            const [warehousesByName] = await pool.execute(
              'SELECT name FROM warehouses WHERE name = ? LIMIT 1',
              [String(poData.scope_id)]
            );
            if (warehousesByName && warehousesByName.length > 0 && warehousesByName[0]?.name) {
              scopeName = warehousesByName[0].name;
            }
          }
        } catch (warehouseErr) {
          // Silently fail - use scope_id as fallback
          console.warn('[PurchaseOrder.findById] Warehouse lookup failed, using scope_id:', warehouseErr.message);
        }
      }
      
      // Get created by username
      let createdByName = null;
      if (poData.created_by) {
        try {
          const [users] = await pool.execute(
            'SELECT username FROM users WHERE id = ?',
            [poData.created_by]
          );
          if (users.length > 0) {
            createdByName = users[0].username;
          }
        } catch (err) {
          console.error('[PurchaseOrder.findById] Error fetching user:', err);
        }
      }
      
      // Combine all data
      const rows = [{
        ...poData,
        supplier_name: supplierName,
        supplier_contact: supplierContact,
        supplier_phone: supplierPhone,
        supplier_email: supplierEmail,
        scope_name: scopeName,
        created_by_name: createdByName
      }];

      const order = new PurchaseOrder(rows[0]);
      
      // Load order items
      order.items = await PurchaseOrderItem.findByOrderId(id);
      
      return order;
    } catch (error) {
      console.error('[PurchaseOrder.findById] Error:', error);
      // Fallback: return basic purchase order without related data
      const [baseRows] = await pool.execute(
        'SELECT * FROM purchase_orders WHERE id = ?',
        [id]
      );
      
      if (baseRows.length === 0) return null;
      
      const order = new PurchaseOrder({
        ...baseRows[0],
        supplier_name: null,
        scope_name: baseRows[0].scope_id,
        created_by_name: null
      });
      order.items = await PurchaseOrderItem.findByOrderId(id);
      return order;
    }
  }

  // Static method to find purchase orders with filters
  static async find(conditions = {}, options = {}) {
    // Use simple query without JOINs to avoid column resolution issues
    // We'll enrich the data with separate queries afterward
    let query = `
      SELECT 
        po.*,
        NULL as supplier_name,
        NULL as supplier_contact,
        NULL as supplier_phone,
        NULL as supplier_email,
        po.scope_id as scope_name,
        NULL as created_by_name
      FROM purchase_orders po
      WHERE 1=1
    `;
    const params = [];

    if (conditions.supplierId) {
      query += ' AND po.supplier_id = ?';
      params.push(conditions.supplierId);
    }

    if (conditions.scopeType) {
      query += ' AND po.scope_type = ?';
      params.push(conditions.scopeType);
    }

    if (conditions.scopeId) {
      query += ' AND po.scope_id = ?';
      params.push(conditions.scopeId);
    }

    if (conditions.status) {
      query += ' AND po.status = ?';
      params.push(conditions.status);
    }

    if (conditions.orderDateFrom) {
      query += ' AND po.order_date >= ?';
      params.push(conditions.orderDateFrom);
    }

    if (conditions.orderDateTo) {
      query += ' AND po.order_date <= ?';
      params.push(conditions.orderDateTo);
    }

    if (conditions.search) {
      query += ' AND (po.order_number LIKE ? OR c.name LIKE ?)';
      params.push(`%${conditions.search}%`, `%${conditions.search}%`);
    }

    // Add sorting
    if (options.sort) {
      const sortField = options.sort.replace(/^-/, '');
      const sortOrder = options.sort.startsWith('-') ? 'DESC' : 'ASC';
      query += ` ORDER BY po.${sortField} ${sortOrder}`;
    } else {
      query += ' ORDER BY po.created_at DESC';
    }

    // Add pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options.skip) {
        query += ' OFFSET ?';
        params.push(options.skip);
      }
    }

    const rows = await executeQuery(query, params);
    const orders = rows.map(row => new PurchaseOrder(row));
    
    // Enrich orders with supplier info and scope names using separate queries
    // This avoids JOIN complexity and column resolution issues
    for (const order of orders) {
      // Enrich supplier info
      if (order.supplierId) {
        try {
          const [suppliers] = await pool.execute(
            'SELECT name, contact_person, phone, email FROM companies WHERE id = ? LIMIT 1',
            [order.supplierId]
          );
          if (suppliers && suppliers.length > 0) {
            order.supplierName = suppliers[0].name || null;
            order.supplierContact = suppliers[0].contact_person || null;
            order.supplierPhone = suppliers[0].phone || null;
            order.supplierEmail = suppliers[0].email || null;
          }
        } catch (supplierErr) {
          // Silently fail
          console.warn('[PurchaseOrder.find] Supplier lookup failed for order', order.id);
        }
      }
      
      // Enrich scope names (branch/warehouse)
      if (order.scopeType === 'BRANCH' && order.scopeId) {
        try {
          const [branches] = await pool.execute(
            'SELECT name FROM branches WHERE id = ? LIMIT 1',
            [order.scopeId]
          );
          if (branches && branches.length > 0 && branches[0]?.name) {
            order.scopeName = branches[0].name;
          }
        } catch (branchErr) {
          // Silently fail
          console.warn('[PurchaseOrder.find] Branch lookup failed for order', order.id);
        }
      } else if (order.scopeType === 'WAREHOUSE' && order.scopeId) {
        try {
          const [warehouses] = await pool.execute(
            'SELECT name FROM warehouses WHERE id = ? LIMIT 1',
            [order.scopeId]
          );
          if (warehouses && warehouses.length > 0 && warehouses[0]?.name) {
            order.scopeName = warehouses[0].name;
          }
        } catch (warehouseErr) {
          // Silently fail
          console.warn('[PurchaseOrder.find] Warehouse lookup failed for order', order.id);
        }
      }
      
      // Enrich created by name
      if (order.createdBy) {
        try {
          const [users] = await pool.execute(
            'SELECT username FROM users WHERE id = ? LIMIT 1',
            [order.createdBy]
          );
          if (users && users.length > 0 && users[0]?.username) {
            order.createdByName = users[0].username;
          }
        } catch (userErr) {
          // Silently fail
          console.warn('[PurchaseOrder.find] User lookup failed for order', order.id);
        }
      }
    }
    
    return orders;
  }

  // Static method to count purchase orders
  static async count(conditions = {}) {
    let query = 'SELECT COUNT(*) as count FROM purchase_orders po WHERE 1=1';
    const params = [];

    if (conditions.supplierId) {
      query += ' AND po.supplier_id = ?';
      params.push(conditions.supplierId);
    }

    if (conditions.scopeType) {
      query += ' AND po.scope_type = ?';
      params.push(conditions.scopeType);
    }

    if (conditions.scopeId) {
      query += ' AND po.scope_id = ?';
      params.push(conditions.scopeId);
    }

    if (conditions.status) {
      query += ' AND po.status = ?';
      params.push(conditions.status);
    }

    if (conditions.orderDateFrom) {
      query += ' AND po.order_date >= ?';
      params.push(conditions.orderDateFrom);
    }

    if (conditions.orderDateTo) {
      query += ' AND po.order_date <= ?';
      params.push(conditions.orderDateTo);
    }

    if (conditions.search) {
      query += ' AND (po.order_number LIKE ? OR EXISTS(SELECT 1 FROM companies c WHERE c.id = po.supplier_id AND c.name LIKE ?))';
      params.push(`%${conditions.search}%`, `%${conditions.search}%`);
    }

    const rows = await executeQuery(query, params);
    return rows[0].count;
  }

  // Static method to update purchase order status
  static async updateStatus(id, status, actualDelivery = null) {
    const result = await executeQuery(
      'UPDATE purchase_orders SET status = ?, actual_delivery = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, actualDelivery, id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Purchase order not found');
    }

    return await PurchaseOrder.findById(id);
  }

  // Static method to generate order number
  static async generateOrderNumber(scopeType, scopeId) {
    const prefix = scopeType === 'WAREHOUSE' ? 'PO-WH' : 'PO-BR';
    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    
    const [rows] = await pool.execute(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number, -4) AS UNSIGNED)), 0) + 1 as next_number
       FROM purchase_orders 
       WHERE order_number LIKE ?`,
      [`${prefix}-${yearMonth}%`]
    );

    const nextNumber = rows[0].next_number;
    return `${prefix}-${yearMonth}-${nextNumber.toString().padStart(4, '0')}`;
  }

  // Instance method to save purchase order
  async save() {
    if (this.id) {
      // Update existing purchase order
      await executeQuery(
        `UPDATE purchase_orders SET 
         order_number = ?, supplier_id = ?, scope_type = ?, scope_id = ?, 
         order_date = ?, expected_delivery = ?, actual_delivery = ?, 
         status = ?, total_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          this.orderNumber, this.supplierId, this.scopeType, this.scopeId,
          this.orderDate, this.expectedDelivery, this.actualDelivery,
          this.status, this.totalAmount, this.notes, this.id
        ]
      );
    } else {
      // Create new purchase order
      const result = await executeQuery(
        `INSERT INTO purchase_orders (
          order_number, supplier_id, scope_type, scope_id, order_date,
          expected_delivery, actual_delivery, status, total_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.orderNumber, this.supplierId, this.scopeType, this.scopeId,
          this.orderDate, this.expectedDelivery, this.actualDelivery,
          this.status, this.totalAmount, this.notes, this.createdBy
        ]
      );
      this.id = result.insertId || result.lastID;
    }
    return this;
  }

  // Instance method to add item to order
  async addItem(itemData) {
    const item = new PurchaseOrderItem({
      ...itemData,
      purchaseOrderId: this.id
    });
    return await item.save();
  }

  // Instance method to calculate total amount
  async calculateTotal() {
    const items = await PurchaseOrderItem.findByOrderId(this.id);
    this.totalAmount = items.reduce((total, item) => total + (item.totalPrice || 0), 0);
    await this.save();
    return this.totalAmount;
  }
}

// Purchase Order Item class
class PurchaseOrderItem {
  constructor(data) {
    this.id = data.id;
    this.purchaseOrderId = data.purchase_order_id;
    this.inventoryItemId = data.inventory_item_id;
    this.itemName = data.item_name;
    this.itemSku = data.item_sku;
    this.itemCategory = data.item_category || 'General';
    this.itemDescription = data.item_description;
    this.quantityOrdered = data.quantity_ordered;
    this.quantityReceived = data.quantity_received;
    this.unitPrice = data.unit_price;
    this.totalPrice = data.total_price;
    this.notes = data.notes;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static method to create purchase order item
  static async create(itemData) {
    const {
      purchaseOrderId, inventoryItemId, itemName, itemSku, itemCategory, itemDescription,
      quantityOrdered, quantityReceived, unitPrice, totalPrice, notes
    } = itemData;

    // Check if item_category column exists, if not, use NULL
    const result = await executeQuery(
      `INSERT INTO purchase_order_items (
        purchase_order_id, inventory_item_id, item_name, item_sku, item_category, item_description,
        quantity_ordered, quantity_received, unit_price, total_price, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseOrderId, inventoryItemId || null, itemName, itemSku || null, itemCategory || 'General',
        itemDescription || null, quantityOrdered, quantityReceived || 0,
        unitPrice, totalPrice, notes || null
      ]
    );

    return await PurchaseOrderItem.findById(result.insertId || result.lastID);
  }

  // Static method to find purchase order item by ID
  static async findById(id) {
    const rows = await executeQuery(
      'SELECT * FROM purchase_order_items WHERE id = ?',
      [id]
    );

    if (rows.length === 0) return null;
    return new PurchaseOrderItem(rows[0]);
  }

  // Static method to find items by purchase order ID
  static async findByOrderId(orderId) {
    const rows = await executeQuery(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id',
      [orderId]
    );

    return rows.map(row => new PurchaseOrderItem(row));
  }

  // Instance method to save purchase order item
  async save() {
    if (this.id) {
      // Update existing item
      await executeQuery(
        `UPDATE purchase_order_items SET 
         purchase_order_id = ?, inventory_item_id = ?, item_name = ?, item_sku = ?, 
         item_category = ?, item_description = ?, quantity_ordered = ?, quantity_received = ?, 
         unit_price = ?, total_price = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          this.purchaseOrderId, this.inventoryItemId, this.itemName, this.itemSku,
          this.itemCategory || 'General', this.itemDescription, this.quantityOrdered, this.quantityReceived,
          this.unitPrice, this.totalPrice, this.notes, this.id
        ]
      );
    } else {
      // Create new item
      const result = await executeQuery(
        `INSERT INTO purchase_order_items (
          purchase_order_id, inventory_item_id, item_name, item_sku, item_category, item_description,
          quantity_ordered, quantity_received, unit_price, total_price, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.purchaseOrderId, this.inventoryItemId, this.itemName, this.itemSku,
          this.itemCategory || 'General', this.itemDescription, this.quantityOrdered, this.quantityReceived,
          this.unitPrice, this.totalPrice, this.notes
        ]
      );
      this.id = result.insertId || result.lastID;
    }
    return this;
  }

  // Instance method to update received quantity
  async updateReceivedQuantity(quantity) {
    this.quantityReceived = quantity;
    await this.save();
    return this;
  }
}

module.exports = { PurchaseOrder, PurchaseOrderItem };
