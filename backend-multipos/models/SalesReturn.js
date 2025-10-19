  const { pool } = require('../config/database');

  class SalesReturn {
    constructor(data) {
      this.id = data.id;
      this.returnNo = data.return_no;
      this.originalSaleId = data.original_sale_id;
      this.userId = data.user_id;
      this.reason = data.reason;
      this.notes = data.notes;
      this.totalRefund = data.total_refund;
      this.status = data.status;
      this.processedBy = data.processed_by;
      this.approvedBy = data.approved_by;
      this.createdAt = data.created_at;
      this.updatedAt = data.updated_at;
    }

  // Static method to create a new sales return
  static async create(returnData) {
    
    const { 
      originalSaleId, 
      userId, 
      reason, 
      notes, 
      totalRefund, 
      items = [],
      processedBy
    } = returnData;
      
      // Generate return number
      const returnNo = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      try {
        // Check if sales_returns table exists and create if needed
        try {
          const [tables] = await pool.execute("SHOW TABLES LIKE 'sales_returns'");
          if (tables.length === 0) {
            await pool.execute(`
              CREATE TABLE IF NOT EXISTS sales_returns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                return_no VARCHAR(50) UNIQUE NOT NULL,
                original_sale_id INT NOT NULL,
                user_id INT NOT NULL,
                reason VARCHAR(100) NOT NULL,
                notes TEXT,
                total_refund DECIMAL(10,2) NOT NULL DEFAULT 0,
                status ENUM('pending', 'approved', 'completed', 'rejected') DEFAULT 'pending',
                processed_by INT,
                approved_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (original_sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
              )
            `);
          }
        } catch (tableError) {
          console.error('[DEBUG] Error checking sales_returns table:', tableError);
          throw new Error('Failed to verify sales_returns table');
        }

        // Start transaction
        await pool.execute('START TRANSACTION');
        
      // Insert sales return
      const [result] = await pool.execute(
        `INSERT INTO sales_returns (return_no, original_sale_id, user_id, reason, notes, total_refund, status, processed_by) 
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
        [returnNo, originalSaleId, userId, reason, notes || null, totalRefund || 0, processedBy]
      );
        
        const salesReturnId = result.insertId;
        
        // Insert return items if provided
        if (items && items.length > 0) {
          // Check if sales_return_items table exists and create if needed
          try {
            // First check if the table exists
            const [tables] = await pool.execute("SHOW TABLES LIKE 'sales_return_items'");
            
            if (tables.length === 0) {
              // Create the table if it doesn't exist
            await pool.execute(`
              CREATE TABLE IF NOT EXISTS sales_return_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                return_id INT NOT NULL,
                inventory_item_id INT NOT NULL,
                quantity DECIMAL(10,3) NOT NULL,
                refund_amount DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
            `);
            } else {
              // Get table structure if table exists
              const [tableInfo] = await pool.execute("DESCRIBE sales_return_items");
            }
          } catch (tableError) {
            console.error('[DEBUG] Error checking sales_return_items table:', tableError);
            throw new Error('Failed to verify sales_return_items table');
          }
          
          for (const item of items) {
            
            // Double-check table exists before inserting
            try {
              const [tableCheck] = await pool.execute("SHOW TABLES LIKE 'sales_return_items'");
              if (tableCheck.length === 0) {
              await pool.execute(`
                CREATE TABLE IF NOT EXISTS sales_return_items (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  return_id INT NOT NULL,
                  inventory_item_id INT NOT NULL,
                  quantity DECIMAL(10,3) NOT NULL,
                  refund_amount DECIMAL(10,2) NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
              `);
              }
              
            await pool.execute(
              `INSERT INTO sales_return_items (return_id, inventory_item_id, quantity, refund_amount, created_at) 
               VALUES (?, ?, ?, ?, NOW())`,
              [
                salesReturnId,
                item.inventoryItemId,
                item.quantity,
                item.refundAmount
              ]
            );
            } catch (insertError) {
              console.error('[DEBUG] Error inserting return item:', insertError);
              console.error('[DEBUG] Insert error details:', {
                message: insertError.message,
                code: insertError.code,
                sqlMessage: insertError.sqlMessage
              });
              throw insertError;
            }
          }
        }
        
        // Commit transaction
        await pool.execute('COMMIT');
        
        return await SalesReturn.findById(salesReturnId);
      } catch (error) {
        // Rollback transaction on error
        await pool.execute('ROLLBACK');
        throw error;
      }
    }

    // Static method to find sales return by ID
    static async findById(id) {
      const [rows] = await pool.execute(
        'SELECT * FROM sales_returns WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) return null;
      return new SalesReturn(rows[0]);
    }

    // Static method to get return items for a sales return
    static async getReturnItems(salesReturnId) {
      const [rows] = await pool.execute(
        `SELECT 
          sri.*,
          ii.name as inventory_item_name,
          ii.sku as inventory_sku,
          ii.selling_price as inventory_price
        FROM sales_return_items sri
        LEFT JOIN inventory_items ii ON sri.inventory_item_id = ii.id
        WHERE sri.sales_return_id = ?
        ORDER BY sri.id`,
        [salesReturnId]
      );
      
      return rows.map(item => ({
        id: item.id,
        salesReturnId: item.sales_return_id,
        inventoryItemId: item.inventory_item_id,
        itemName: item.item_name,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        refundAmount: parseFloat(item.refund_amount),
        reason: item.reason,
        createdAt: item.created_at,
        // Additional inventory info
        inventoryItemName: item.inventory_item_name,
        inventorySku: item.inventory_sku,
        inventoryPrice: parseFloat(item.inventory_price) || 0
      }));
    }

    // Static method to find sales return
    static async findOne(conditions) {
      let query = 'SELECT * FROM sales_returns WHERE ';
      const params = [];
      const conditionsArray = [];

      if (conditions.returnNo) {
        conditionsArray.push('return_no = ?');
        params.push(conditions.returnNo);
      }

      if (conditions._id) {
        conditionsArray.push('id = ?');
        params.push(conditions._id);
      }

      if (conditions.id) {
        conditionsArray.push('id = ?');
        params.push(conditions.id);
      }

      if (conditionsArray.length === 0) return null;

      query += conditionsArray.join(' AND ');
      query += ' LIMIT 1';

      const [rows] = await pool.execute(query, params);
      
      if (rows.length === 0) return null;
      return new SalesReturn(rows[0]);
    }

    // Instance method to save sales return
    async save() {
      if (this.id) {
        // Update existing sales return
        await pool.execute(
          `UPDATE sales_returns SET return_no = ?, original_sale_id = ?, reason = ?, 
          total_amount = ?, status = ?, processed_by = ?, approved_by = ? 
          WHERE id = ?`,
          [this.returnNo, this.originalSaleId, this.reason, this.totalAmount, 
          this.status, this.processedBy, this.approvedBy, this.id]
        );
      } else {
        // Create new sales return
        const result = await pool.execute(
          `INSERT INTO sales_returns (return_no, original_sale_id, reason, total_amount, status, processed_by, approved_by) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [this.returnNo, this.originalSaleId, this.reason, this.totalAmount, 
          this.status, this.processedBy, this.approvedBy]
        );
        this.id = result[0].insertId;
      }
      return this;
    }

    // Static method to find sales returns with pagination
    static async find(conditions = {}, options = {}) {
      let query = 'SELECT * FROM sales_returns WHERE 1=1';
      const params = [];

      if (conditions.status) {
        query += ' AND status = ?';
        params.push(conditions.status);
      }

      if (conditions.processedBy) {
        query += ' AND processed_by = ?';
        params.push(conditions.processedBy);
      }

      if (conditions.approvedBy) {
        query += ' AND approved_by = ?';
        params.push(conditions.approvedBy);
      }

      // Add sorting
      if (options.sort) {
        const sortField = options.sort.replace(/^-/, ''); // Remove minus sign
        const sortOrder = options.sort.startsWith('-') ? 'DESC' : 'ASC';
        query += ` ORDER BY ${sortField} ${sortOrder}`;
      } else {
        query += ' ORDER BY created_at DESC';
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

      const [rows] = await pool.execute(query, params);
      return rows.map(row => new SalesReturn(row));
    }

    // Static method to count sales returns
    static async count(conditions = {}) {
      let query = 'SELECT COUNT(*) as count FROM sales_returns WHERE 1=1';
      const params = [];

      if (conditions.status) {
        query += ' AND status = ?';
        params.push(conditions.status);
      }

      if (conditions.processedBy) {
        query += ' AND processed_by = ?';
        params.push(conditions.processedBy);
      }

      if (conditions.approvedBy) {
        query += ' AND approved_by = ?';
        params.push(conditions.approvedBy);
      }

      const [rows] = await pool.execute(query, params);
      return rows[0].count;
    }

    // Static method to update sales return
    static async updateOne(conditions, updateData) {
      let query = 'UPDATE sales_returns SET ';
      const params = [];
      const setClauses = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          setClauses.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });

      if (setClauses.length === 0) return { modifiedCount: 0 };

      query += setClauses.join(', ');
      query += ' WHERE ';

      const whereClauses = [];
      if (conditions._id) {
        whereClauses.push('id = ?');
        params.push(conditions._id);
      }
      if (conditions.id) {
        whereClauses.push('id = ?');
        params.push(conditions.id);
      }
      if (conditions.returnNo) {
        whereClauses.push('return_no = ?');
        params.push(conditions.returnNo);
      }

      if (whereClauses.length === 0) return { modifiedCount: 0 };

      query += whereClauses.join(' AND ');

      const [result] = await pool.execute(query, params);
      return { modifiedCount: result.affectedRows };
    }

    // Static method to delete sales return
    static async deleteOne(conditions) {
      let query = 'DELETE FROM sales_returns WHERE ';
      const params = [];
      const whereClauses = [];

      if (conditions._id) {
        whereClauses.push('id = ?');
        params.push(conditions._id);
      }
      if (conditions.id) {
        whereClauses.push('id = ?');
        params.push(conditions.id);
      }
      if (conditions.returnNo) {
        whereClauses.push('return_no = ?');
        params.push(conditions.returnNo);
      }

      if (whereClauses.length === 0) return { deletedCount: 0 };

      query += whereClauses.join(' AND ');

      const [result] = await pool.execute(query, params);
      return { deletedCount: result.affectedRows };
    }
  }

  module.exports = SalesReturn;