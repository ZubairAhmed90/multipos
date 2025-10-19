const { pool } = require('./config/database');

async function testOutstandingPaymentsWithPartialStatus() {
  try {
    console.log('🔍 Testing Outstanding Payments with PARTIAL Status...\n');
    
    // Test the query that includes both PENDING and PARTIAL statuses
    console.log('📊 Testing query for Ahmed with both PENDING and PARTIAL statuses...');
    
    const [results] = await pool.execute(`
      SELECT 
        customer_name,
        customer_phone as phone,
        SUM(credit_amount) as total_outstanding,
        COUNT(id) as pending_sales_count,
        GROUP_CONCAT(DISTINCT payment_status) as payment_statuses
      FROM sales
      WHERE credit_amount > 0 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
        AND customer_name LIKE ?
      GROUP BY customer_name, customer_phone 
      HAVING total_outstanding > 0
    `, ['%Ahmed%']);
    
    console.log(`✅ Found ${results.length} customers with outstanding payments:`);
    
    results.forEach(customer => {
      console.log(`  - ${customer.customer_name} (${customer.phone}): $${customer.total_outstanding} (${customer.pending_sales_count} sales)`);
      console.log(`    Payment Statuses: ${customer.payment_statuses}`);
    });
    
    // Show all Ahmed's sales records with their statuses
    console.log('\n📋 All Ahmed sales records with payment statuses:');
    const [allSales] = await pool.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        customer_phone,
        total,
        payment_method,
        payment_status,
        credit_amount,
        payment_amount
      FROM sales 
      WHERE customer_name LIKE ?
      ORDER BY created_at DESC
    `, ['%Ahmed%']);
    
    allSales.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: $${sale.total} | ${sale.payment_method} | ${sale.payment_status} | Credit: $${sale.credit_amount}`);
    });
    
    console.log('\n✅ Test completed! The fix should now show both PENDING and PARTIAL payments in outstanding search.');
    console.log('🎯 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test in POS: Search for "Ahmed"');
    console.log('   3. You should now see outstanding payments including partial payments');
    
  } catch (error) {
    console.error('❌ Error testing fix:', error);
  } finally {
    process.exit(0);
  }
}

testOutstandingPaymentsWithPartialStatus();
