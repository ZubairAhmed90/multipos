const { pool } = require('../config/database');

class LedgerService {
  /**
   * Record a sale transaction in the ledger with proper debit/credit entries
   * This follows double-entry bookkeeping principles
   */
  static async recordSaleTransaction(saleData) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const {
        saleId,
        invoiceNo,
        scopeType,
        scopeId,
        totalAmount,
        paymentAmount,
        creditAmount,
        paymentMethod,
        customerInfo,
        userId,
        items = []
      } = saleData;
      
      console.log('[LedgerService] Recording sale transaction:', {
        saleId,
        invoiceNo,
        totalAmount,
        paymentAmount,
        creditAmount,
        paymentMethod
      });
      
      // Get or create ledger accounts
      const cashAccount = await this.getOrCreateAccount('Cash Account', 'asset', scopeType, scopeId);
      const salesRevenueAccount = await this.getOrCreateAccount('Sales Revenue', 'revenue', scopeType, scopeId);
      const accountsReceivableAccount = await this.getOrCreateAccount('Accounts Receivable', 'asset', scopeType, scopeId);
      const inventoryAccount = await this.getOrCreateAccount('Inventory', 'asset', scopeType, scopeId);
      const costOfGoodsSoldAccount = await this.getOrCreateAccount('Cost of Goods Sold', 'expense', scopeType, scopeId);
      
      // Calculate cost of goods sold
      let totalCost = 0;
      for (const item of items) {
        if (item.costPrice) {
          totalCost += item.costPrice * item.quantity;
        }
      }
      
      // Record the sale transaction with double-entry bookkeeping
      const transactionDate = new Date();
      
       // Check if user exists, if not use NULL
       const [users] = await connection.execute('SELECT id FROM users WHERE id = ?', [userId]);
       const validUserId = users.length > 0 ? userId : null;
       
       // 1. DEBIT: Cash Account (for payment received)
       if (paymentAmount > 0) {
         await this.createLedgerEntry(connection, {
           accountId: cashAccount.id,
           type: 'DEBIT',
           amount: paymentAmount,
           description: `Sale ${invoiceNo} - Cash Payment`,
           reference: 'SALE',
           referenceId: saleId,
           date: transactionDate,
           createdBy: validUserId
         });
       }
       
       // 2. DEBIT: Accounts Receivable (for credit amount)
       if (creditAmount > 0) {
         await this.createLedgerEntry(connection, {
           accountId: accountsReceivableAccount.id,
           type: 'DEBIT',
           amount: creditAmount,
           description: `Sale ${invoiceNo} - Credit to ${customerInfo?.name || 'Customer'}`,
           reference: 'SALE',
           referenceId: saleId,
           date: transactionDate,
           createdBy: validUserId
         });
       }
       
       // 3. CREDIT: Sales Revenue Account
       await this.createLedgerEntry(connection, {
         accountId: salesRevenueAccount.id,
         type: 'CREDIT',
         amount: totalAmount,
         description: `Sale ${invoiceNo} - Revenue`,
         reference: 'SALE',
         referenceId: saleId,
         date: transactionDate,
         createdBy: validUserId
       });
       
       // 4. DEBIT: Cost of Goods Sold (if items have cost data)
       if (totalCost > 0) {
         await this.createLedgerEntry(connection, {
           accountId: costOfGoodsSoldAccount.id,
           type: 'DEBIT',
           amount: totalCost,
           description: `Sale ${invoiceNo} - Cost of Goods Sold`,
           reference: 'SALE',
           referenceId: saleId,
           date: transactionDate,
           createdBy: validUserId
         });
         
         // 5. CREDIT: Inventory Account (reduce inventory value)
         await this.createLedgerEntry(connection, {
           accountId: inventoryAccount.id,
           type: 'CREDIT',
           amount: totalCost,
           description: `Sale ${invoiceNo} - Inventory Reduction`,
           reference: 'SALE',
           referenceId: saleId,
           date: transactionDate,
           createdBy: validUserId
         });
       }
      
      await connection.commit();
      console.log('[LedgerService] Sale transaction recorded successfully');
      
      return {
        success: true,
        message: 'Sale transaction recorded in ledger',
        entries: [
          { account: 'Cash Account', type: 'DEBIT', amount: paymentAmount },
          { account: 'Accounts Receivable', type: 'DEBIT', amount: creditAmount },
          { account: 'Sales Revenue', type: 'CREDIT', amount: totalAmount },
          { account: 'Cost of Goods Sold', type: 'DEBIT', amount: totalCost },
          { account: 'Inventory', type: 'CREDIT', amount: totalCost }
        ]
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('[LedgerService] Error recording sale transaction:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get or create a ledger account
   */
  static async getOrCreateAccount(accountName, accountType, scopeType, scopeId) {
    const connection = await pool.getConnection();
    
    try {
      // Try to find existing account
      const [existing] = await connection.execute(
        'SELECT * FROM ledgers WHERE account_name = ? AND scope_type = ? AND scope_id = ?',
        [accountName, scopeType, scopeId]
      );
      
      if (existing.length > 0) {
        return existing[0];
      }
      
      // Create new account
      const [result] = await connection.execute(
        `INSERT INTO ledgers (account_name, account_type, balance, currency, status, description, scope_type, scope_id, party_type, party_id, created_at, updated_at)
         VALUES (?, ?, 0.00, 'PKR', 'ACTIVE', ?, ?, ?, 'SYSTEM', 'DEFAULT', NOW(), NOW())`,
        [accountName, accountType, `Auto-created ${accountType} account`, scopeType, scopeId]
      );
      
      const [newAccount] = await connection.execute(
        'SELECT * FROM ledgers WHERE id = ?',
        [result.insertId]
      );
      
      console.log(`[LedgerService] Created new account: ${accountName} (${accountType})`);
      return newAccount[0];
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Create a ledger entry
   */
  static async createLedgerEntry(connection, entryData) {
    const {
      accountId,
      type,
      amount,
      description,
      reference,
      referenceId,
      date,
      createdBy
    } = entryData;
    
     // Insert ledger entry (using correct column names based on your table structure)
     // branch_id should reference branches table, not ledgers table
     const [result] = await connection.execute(
       `INSERT INTO ledger_entries (entry_type, reference_id, description, debit_amount, credit_amount, branch_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
       [type, referenceId, description, type === 'DEBIT' ? amount : 0, type === 'CREDIT' ? amount : 0, 1, createdBy || null]
     );
    
    // Update account balance
    if (type === 'DEBIT') {
      await connection.execute(
        'UPDATE ledgers SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
        [amount, accountId]
      );
    } else if (type === 'CREDIT') {
      await connection.execute(
        'UPDATE ledgers SET balance = balance - ?, updated_at = NOW() WHERE id = ?',
        [amount, accountId]
      );
    }
    
    console.log(`[LedgerService] Created ${type} entry: ${amount} for account ${accountId}`);
    return result.insertId;
  }
  
  /**
   * Record a partial payment (when customer pays remaining credit)
   */
  static async recordPartialPayment(paymentData) {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const {
        saleId,
        invoiceNo,
        paymentAmount,
        scopeType,
        scopeId,
        userId
      } = paymentData;
      
      // Get accounts
      const cashAccount = await this.getOrCreateAccount('Cash Account', 'asset', scopeType, scopeId);
      const accountsReceivableAccount = await this.getOrCreateAccount('Accounts Receivable', 'asset', scopeType, scopeId);
      
      const transactionDate = new Date();
      
      // DEBIT: Cash Account (payment received)
      await this.createLedgerEntry(connection, {
        accountId: cashAccount.id,
        type: 'DEBIT',
        amount: paymentAmount,
        description: `Partial Payment for Sale ${invoiceNo}`,
        reference: 'PARTIAL_PAYMENT',
        referenceId: saleId,
        date: transactionDate,
        createdBy: userId
      });
      
      // CREDIT: Accounts Receivable (reduce credit balance)
      await this.createLedgerEntry(connection, {
        accountId: accountsReceivableAccount.id,
        type: 'CREDIT',
        amount: paymentAmount,
        description: `Partial Payment for Sale ${invoiceNo}`,
        reference: 'PARTIAL_PAYMENT',
        referenceId: saleId,
        date: transactionDate,
        createdBy: userId
      });
      
      await connection.commit();
      console.log('[LedgerService] Partial payment recorded successfully');
      
      return {
        success: true,
        message: 'Partial payment recorded in ledger'
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('[LedgerService] Error recording partial payment:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get ledger entries for a specific account
   */
  static async getAccountEntries(accountId, startDate = null, endDate = null) {
    const connection = await pool.getConnection();
    
    try {
      let query = `
        SELECT 
          le.*,
          l.account_name,
          l.account_type,
          u.username as created_by_name
        FROM ledger_entries le
        LEFT JOIN ledgers l ON le.branch_id = l.scope_id
        LEFT JOIN users u ON le.created_by = u.id
        WHERE le.branch_id = ?
      `;
      const params = [accountId];
      
      if (startDate) {
        query += ' AND le.date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND le.date <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY le.date DESC, le.created_at DESC';
      
      const [entries] = await connection.execute(query, params);
      return entries;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get account balance
   */
  static async getAccountBalance(accountId) {
    const connection = await pool.getConnection();
    
    try {
      const [accounts] = await connection.execute(
        'SELECT balance FROM ledgers WHERE id = ?',
        [accountId]
      );
      
      return accounts.length > 0 ? parseFloat(accounts[0].balance) : 0;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get trial balance for a scope
   */
  static async getTrialBalance(scopeType, scopeId) {
    const connection = await pool.getConnection();
    
    try {
      const [accounts] = await connection.execute(
        `SELECT 
          account_name,
          account_type,
          balance,
          CASE 
            WHEN account_type IN ('asset', 'expense') THEN balance
            ELSE 0
          END as debit_balance,
          CASE 
            WHEN account_type IN ('liability', 'equity', 'revenue') THEN balance
            ELSE 0
          END as credit_balance
        FROM ledgers 
        WHERE scope_type = ? AND scope_id = ? AND status = 'ACTIVE'
        ORDER BY account_type, account_name`,
        [scopeType, scopeId]
      );
      
      const totalDebits = accounts.reduce((sum, acc) => sum + parseFloat(acc.debit_balance), 0);
      const totalCredits = accounts.reduce((sum, acc) => sum + parseFloat(acc.credit_balance), 0);
      
      return {
        accounts,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01
      };
      
    } finally {
      connection.release();
    }
  }
}

module.exports = LedgerService;
