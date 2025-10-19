const { pool } = require('./config/database');

async function checkOutstandingStatus() {
  try {
    console.log('🔍 Checking Outstanding Payment Status Updates...\n');
    
    // Check Ahmed's current outstanding payments
    const [outstanding] = await pool.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        customer_phone,
        total,
        payment_amount,
        credit_amount,
        payment_status,
        payment_method,
        created_at
      FROM sales 
      WHERE customer_name LIKE '%Ahmed%' 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
        AND credit_amount > 0
      ORDER BY created_at ASC
    `);
    
    console.log(`📊 Found ${outstanding.length} outstanding payments:`);
    outstanding.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: $${sale.total} | ${sale.payment_method} | ${sale.payment_status} | Credit: $${sale.credit_amount}`);
    });
    
    if (outstanding.length === 0) {
      console.log('✅ No outstanding payments found - all payments have been cleared!');
      return;
    }
    
    // Check if any sales have been partially cleared but still show PARTIAL status
    const partialPayments = outstanding.filter(sale => 
      sale.payment_status === 'PARTIAL' && 
      parseFloat(sale.payment_amount) > 0 &&
      parseFloat(sale.credit_amount) > 0
    );
    
    console.log(`\n🔍 Partial payments that should be cleared: ${partialPayments.length}`);
    partialPayments.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: Payment $${sale.payment_amount} | Credit $${sale.credit_amount} | Status: ${sale.payment_status}`);
    });
    
    // Check completed sales to see if any were previously outstanding
    const [completed] = await pool.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        payment_status,
        payment_amount,
        credit_amount,
        payment_method,
        updated_at
      FROM sales 
      WHERE customer_name LIKE '%Ahmed%' 
        AND payment_status = 'COMPLETED'
        AND credit_amount = 0
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    console.log(`\n✅ Recently completed sales (last 5):`);
    completed.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: $${sale.payment_amount} | ${sale.payment_method} | Updated: ${sale.updated_at}`);
    });
    
    console.log('\n🎯 Analysis:');
    if (partialPayments.length > 0) {
      console.log('❌ ISSUE FOUND: Some partial payments are not being automatically updated to COMPLETED');
      console.log('   This suggests the clear-outstanding API is not being called or is failing');
    } else {
      console.log('✅ No issues found with partial payment status updates');
    }
    
  } catch (error) {
    console.error('❌ Error checking outstanding status:', error);
  } finally {
    process.exit(0);
  }
}

checkOutstandingStatus();
