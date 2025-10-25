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
    const rows = await executeQuery(`
      SELECT 
        po.*,
        c.name as supplier_name,
        c.contact_person as supplier_contact,
        c.phone as supplier_phone,
        c.email as supplier_email,
        COALESCE(b.name, w.name) as scope_name,
        u.username as created_by_name
      FROM purchase_orders po
      LEFT JOIN companies c ON po.supplier_id = c.id
      LEFT JOIN branches b ON po.scope_type = 'BRANCH' AND po.scope_id = b.id
      LEFT JOIN warehouses w ON po.scope_type = 'WAREHOUSE' AND po.scope_id = w.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ?
    `, [id]);

    if (rows.length === 0) return null;
    
    const order = new PurchaseOrder(rows[0]);
    
    // Load order items
    order.items = await PurchaseOrderItem.findByOrderId(id);
    
    return order;
  }

  // Static method to find purchase orders with filters
  static async find(conditions = {}, options = {}) {
    let query = `
      SELECT 
        po.*,
        c.name as supplier_name,
        c.contact_person as supplier_contact,
        c.phone as supplier_phone,
        c.email as supplier_email,
        COALESCE(b.name, w.name) as scope_name,
        u.username as created_by_name
      FROM purchase_orders po
      LEFT JOIN companies c ON po.supplier_id = c.id
      LEFT JOIN branches b ON po.scope_type = 'BRANCH' AND po.scope_id = b.id
      LEFT JOIN warehouses w ON po.scope_type = 'WAREHOUSE' AND po.scope_id = w.id
      LEFT JOIN users u ON po.created_by = u.id
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
    return rows.map(row => new PurchaseOrder(row));
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
      purchaseOrderId, inventoryItemId, itemName, itemSku, itemDescription,
      quantityOrdered, quantityReceived, unitPrice, totalPrice, notes
    } = itemData;

    const result = await executeQuery(
      `INSERT INTO purchase_order_items (
        purchase_order_id, inventory_item_id, item_name, item_sku, item_description,
        quantity_ordered, quantity_received, unit_price, total_price, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseOrderId, inventoryItemId || null, itemName, itemSku || null,
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
         item_description = ?, quantity_ordered = ?, quantity_received = ?, 
         unit_price = ?, total_price = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          this.purchaseOrderId, this.inventoryItemId, this.itemName, this.itemSku,
          this.itemDescription, this.quantityOrdered, this.quantityReceived,
          this.unitPrice, this.totalPrice, this.notes, this.id
        ]
      );
    } else {
      // Create new item
      const result = await executeQuery(
        `INSERT INTO purchase_order_items (
          purchase_order_id, inventory_item_id, item_name, item_sku, item_description,
          quantity_ordered, quantity_received, unit_price, total_price, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.purchaseOrderId, this.inventoryItemId, this.itemName, this.itemSku,
          this.itemDescription, this.quantityOrdered, this.quantityReceived,
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
