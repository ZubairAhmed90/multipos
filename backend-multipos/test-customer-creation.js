const { pool } = require('./config/database');

(async () => {
  try {
    console.log('🧪 Testing Customer Creation Logic...');
    
    // Test data similar to what POS would send
    const testData = {
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      scopeType: 'BRANCH',
      scopeId: 1, // Now sending branchId as number
      finalCreditAmount: 100.00
    };
    
    console.log('📝 Test data:', testData);
    
    // Simulate the customer creation logic from salesController.js
    const { customerName, customerPhone, scopeType, scopeId, finalCreditAmount } = testData;
    
    console.log('🔍 Creating customer record for:', { customerName, customerPhone, scopeType, scopeId, scopeIdType: typeof scopeId });
    
    // Check if customer already exists
    const [existingCustomers] = await pool.execute(
      'SELECT id FROM customers WHERE name = ? OR phone = ?',
      [customerName, customerPhone]
    );
    
    if (existingCustomers.length === 0) {
      console.log('✅ Customer does not exist, creating new one...');
      
      // Create new customer record with proper branch/warehouse scope
      const customerData = {
        name: customerName || 'Walk-in Customer',
        email: '',
        phone: customerPhone || '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        customer_type: 'INDIVIDUAL',
        credit_limit: 0.00,
        current_balance: finalCreditAmount || 0.00,
        payment_terms: 'CASH',
        branch_id: scopeType === 'BRANCH' ? (typeof scopeId === 'number' ? scopeId : parseInt(scopeId)) : null,
        warehouse_id: scopeType === 'WAREHOUSE' ? (typeof scopeId === 'number' ? scopeId : parseInt(scopeId)) : null,
        status: 'ACTIVE',
        notes: `Auto-created from POS sale`,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      console.log('📝 Customer data to insert:', customerData);
      
      const [customerResult] = await pool.execute(`
        INSERT INTO customers (
          name, email, phone, address, city, state, zip_code, 
          customer_type, credit_limit, current_balance, payment_terms,
          branch_id, warehouse_id, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        customerData.name,
        customerData.email,
        customerData.phone,
        customerData.address,
        customerData.city,
        customerData.state,
        customerData.zip_code,
        customerData.customer_type,
        customerData.credit_limit,
        customerData.current_balance,
        customerData.payment_terms,
        customerData.branch_id,
        customerData.warehouse_id,
        customerData.status,
        customerData.notes,
        customerData.created_at,
        customerData.updated_at
      ]);
      
      const customerId = customerResult.insertId;
      console.log('✅ Customer created successfully with ID:', customerId);
      console.log('🏢 Branch ID set to:', customerData.branch_id);
      console.log('🏭 Warehouse ID set to:', customerData.warehouse_id);
      
      // Verify the customer was created correctly
      const [verifyCustomer] = await pool.execute(
        'SELECT id, name, phone, branch_id, warehouse_id, current_balance FROM customers WHERE id = ?',
        [customerId]
      );
      
      console.log('🔍 Verification - Created customer:', verifyCustomer[0]);
      
      // Clean up test data
      await pool.execute('DELETE FROM customers WHERE id = ?', [customerId]);
      console.log('🧹 Test customer cleaned up');
      
    } else {
      console.log('ℹ️ Customer already exists with ID:', existingCustomers[0].id);
    }
    
    console.log('🎉 Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
