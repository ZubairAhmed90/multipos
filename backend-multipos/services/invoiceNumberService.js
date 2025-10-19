const { pool } = require('../config/database');

class InvoiceNumberService {
  /**
   * Generate invoice number with branch/warehouse code prefix and sequential numbering
   * Format: {CODE}-{000001}
   * Example: PTHL-000001, WH01-000001
   */
  static async generateInvoiceNumber(scopeType, scopeId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get the code for the branch or warehouse
      let code = '';
      let entityName = '';
      
      if (scopeType === 'BRANCH') {
        const [branches] = await connection.execute(
          'SELECT id, name, code FROM branches WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (branches.length === 0) {
          throw new Error(`Branch not found: ${scopeId}`);
        }
        const branch = branches[0];
        code = branch.code;
        entityName = branch.name;
        
        // If no code exists, generate one from name
        if (!code) {
          code = branch.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (code.length < 2) {
            code = 'BR' + branch.id.toString().padStart(2, '0');
          }
          
          // Update the branch with the generated code
          await connection.execute(
            'UPDATE branches SET code = ? WHERE id = ?',
            [code, branch.id]
          );
          console.log(`[InvoiceNumberService] Generated code ${code} for branch ${branch.name}`);
        }
      } else if (scopeType === 'WAREHOUSE') {
        const [warehouses] = await connection.execute(
          'SELECT id, name, code FROM warehouses WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (warehouses.length === 0) {
          throw new Error(`Warehouse not found: ${scopeId}`);
        }
        const warehouse = warehouses[0];
        code = warehouse.code;
        entityName = warehouse.name;
        
        // If no code exists, generate one from name
        if (!code) {
          code = warehouse.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (code.length < 2) {
            code = 'WH' + warehouse.id.toString().padStart(2, '0');
          }
          
          // Update the warehouse with the generated code
          await connection.execute(
            'UPDATE warehouses SET code = ? WHERE id = ?',
            [code, warehouse.id]
          );
          console.log(`[InvoiceNumberService] Generated code ${code} for warehouse ${warehouse.name}`);
        }
      } else {
        throw new Error(`Invalid scope type: ${scopeType}`);
      }
      
      if (!code) {
        throw new Error(`No code found for ${scopeType}: ${scopeId}`);
      }
      
      // Get the highest existing invoice number for this code
      const [maxRows] = await connection.execute(
        'SELECT invoice_no FROM sales WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1',
        [`${code}-%`]
      );
      
      let nextNumber = 1;
      if (maxRows.length > 0) {
        const lastInvoice = maxRows[0].invoice_no;
        // Extract the number part after the code and hyphen
        const match = lastInvoice.match(new RegExp(`^${code}-(\\d+)$`));
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const invoiceNumber = `${code}-${nextNumber.toString().padStart(6, '0')}`;
      
      // Verify the invoice number doesn't already exist (extra safety check)
      const [existingRows] = await connection.execute(
        'SELECT id FROM sales WHERE invoice_no = ?',
        [invoiceNumber]
      );
      
      if (existingRows.length > 0) {
        // If it exists, increment and try again
        nextNumber++;
        const invoiceNumber2 = `${code}-${nextNumber.toString().padStart(6, '0')}`;
        
        await connection.commit();
        console.log(`[InvoiceNumberService] Generated invoice number: ${invoiceNumber2} (collision avoided)`);
        return invoiceNumber2;
      }
      
      await connection.commit();
      console.log(`[InvoiceNumberService] Generated invoice number: ${invoiceNumber} for ${scopeType} ${entityName}`);
      return invoiceNumber;
      
    } catch (error) {
      await connection.rollback();
      console.error(`[InvoiceNumberService] Error generating invoice number: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Generate invoice number with salesperson identification for warehouses
   * Format: {WAREHOUSE_CODE}-{SALESPERSON_CODE}-{000001}
   * Example: WH01-AHM-000001, WH01-SAL-000001
   */
  static async generateInvoiceNumberWithSalesperson(scopeType, scopeId, userId) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get the warehouse code
      let warehouseCode = '';
      if (scopeType === 'WAREHOUSE') {
        const [warehouses] = await connection.execute(
          'SELECT code FROM warehouses WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (warehouses.length === 0) {
          throw new Error(`Warehouse not found: ${scopeId}`);
        }
        warehouseCode = warehouses[0].code;
      } else {
        throw new Error(`Salesperson-specific numbering only supported for warehouses`);
      }
      
      if (!warehouseCode) {
        throw new Error(`No code found for warehouse: ${scopeId}`);
      }
      
      // Get salesperson code (first 3 letters of username)
      const [users] = await connection.execute(
        'SELECT username FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        throw new Error(`User not found: ${userId}`);
      }
      
      const username = users[0].username;
      const salespersonCode = username.substring(0, 3).toUpperCase();
      
      // Get the next invoice number for this warehouse-salesperson combination
      const prefix = `${warehouseCode}-${salespersonCode}`;
      const [countRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?',
        [`${prefix}-%`]
      );
      
      const nextNumber = (countRows[0].count || 0) + 1;
      const invoiceNumber = `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
      
      // Verify the invoice number doesn't already exist
      const [existingRows] = await connection.execute(
        'SELECT id FROM sales WHERE invoice_no = ?',
        [invoiceNumber]
      );
      
      if (existingRows.length > 0) {
        // If it exists, try the next number
        const [countRows2] = await connection.execute(
          'SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?',
          [`${prefix}-%`]
        );
        const nextNumber2 = countRows2[0].count + 1;
        const invoiceNumber2 = `${prefix}-${nextNumber2.toString().padStart(6, '0')}`;
        
        await connection.commit();
        return invoiceNumber2;
      }
      
      await connection.commit();
      return invoiceNumber;
      
    } catch (error) {
      await connection.rollback();
      console.error(`[InvoiceNumberService] Error generating invoice number: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Generate invoice number with custom prefix
   * Format: {PREFIX}-{000001}
   */
  static async generateInvoiceNumberWithPrefix(prefix) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get the next invoice number for this prefix
      const [countRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?',
        [`${prefix}-%`]
      );
      
      const nextNumber = (countRows[0].count || 0) + 1;
      const invoiceNumber = `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
      
      // Verify the invoice number doesn't already exist
      const [existingRows] = await connection.execute(
        'SELECT id FROM sales WHERE invoice_no = ?',
        [invoiceNumber]
      );
      
      if (existingRows.length > 0) {
        // If it exists, try the next number
        const [countRows2] = await connection.execute(
          'SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?',
          [`${prefix}-%`]
        );
        const nextNumber2 = countRows2[0].count + 1;
        const invoiceNumber2 = `${prefix}-${nextNumber2.toString().padStart(6, '0')}`;
        
        await connection.commit();
        return invoiceNumber2;
      }
      
      await connection.commit();
      return invoiceNumber;
      
    } catch (error) {
      await connection.rollback();
      console.error(`[InvoiceNumberService] Error generating invoice number: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get the next invoice number for a specific code without generating it
   * Useful for previewing what the next number will be
   */
  static async getNextInvoiceNumber(scopeType, scopeId) {
    const connection = await pool.getConnection();
    
    try {
      // Get the code for the branch or warehouse
      let code = '';
      if (scopeType === 'BRANCH') {
        const [branches] = await connection.execute(
          'SELECT code FROM branches WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (branches.length === 0) {
          throw new Error(`Branch not found: ${scopeId}`);
        }
        code = branches[0].code;
      } else if (scopeType === 'WAREHOUSE') {
        const [warehouses] = await connection.execute(
          'SELECT code FROM warehouses WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (warehouses.length === 0) {
          throw new Error(`Warehouse not found: ${scopeId}`);
        }
        code = warehouses[0].code;
      } else {
        throw new Error(`Invalid scope type: ${scopeType}`);
      }
      
      if (!code) {
        throw new Error(`No code found for ${scopeType}: ${scopeId}`);
      }
      
      // Get the count of existing invoices for this code
      const [countRows] = await connection.execute(
        'SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE ?',
        [`${code}-%`]
      );
      
      const nextNumber = (countRows[0].count || 0) + 1;
      return `${code}-${nextNumber.toString().padStart(6, '0')}`;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Validate invoice number format
   * Should match pattern: {CODE}-{000001}
   */
  static validateInvoiceNumber(invoiceNumber) {
    const pattern = /^[A-Z0-9]+-\d{6}$/;
    return pattern.test(invoiceNumber);
  }
  
  /**
   * Extract code and number from invoice number
   * Returns: { code: 'PTHL', number: 1 }
   */
  static parseInvoiceNumber(invoiceNumber) {
    const match = invoiceNumber.match(/^([A-Z0-9]+)-(\d{6})$/);
    if (!match) {
      throw new Error(`Invalid invoice number format: ${invoiceNumber}`);
    }
    
    return {
      code: match[1],
      number: parseInt(match[2], 10)
    };
  }
  
  /**
   * Get invoice statistics for a specific code
   */
  static async getInvoiceStats(scopeType, scopeId) {
    const connection = await pool.getConnection();
    
    try {
      // Get the code for the branch or warehouse
      let code = '';
      if (scopeType === 'BRANCH') {
        const [branches] = await connection.execute(
          'SELECT code FROM branches WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (branches.length === 0) {
          throw new Error(`Branch not found: ${scopeId}`);
        }
        code = branches[0].code;
      } else if (scopeType === 'WAREHOUSE') {
        const [warehouses] = await connection.execute(
          'SELECT code FROM warehouses WHERE id = ? OR name = ?',
          [scopeId, scopeId]
        );
        if (warehouses.length === 0) {
          throw new Error(`Warehouse not found: ${scopeId}`);
        }
        code = warehouses[0].code;
      } else {
        throw new Error(`Invalid scope type: ${scopeType}`);
      }
      
      if (!code) {
        throw new Error(`No code found for ${scopeType}: ${scopeId}`);
      }
      
      // Get statistics
      const [statsRows] = await connection.execute(
        `SELECT 
          COUNT(*) as total_invoices,
          MIN(invoice_no) as first_invoice,
          MAX(invoice_no) as last_invoice,
          MIN(created_at) as first_date,
          MAX(created_at) as last_date
        FROM sales 
        WHERE invoice_no LIKE ?`,
        [`${code}-%`]
      );
      
      const stats = statsRows[0];
      const nextNumber = (stats.total_invoices || 0) + 1;
      
      return {
        code,
        totalInvoices: stats.total_invoices || 0,
        firstInvoice: stats.first_invoice,
        lastInvoice: stats.last_invoice,
        firstDate: stats.first_date,
        lastDate: stats.last_date,
        nextInvoiceNumber: `${code}-${nextNumber.toString().padStart(6, '0')}`
      };
      
    } finally {
      connection.release();
    }
  }
}

module.exports = InvoiceNumberService;
