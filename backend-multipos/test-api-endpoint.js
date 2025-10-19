const { pool } = require('./config/database');

async function testAPIEndpointDirectly() {
  try {
    console.log('🔍 Testing API Endpoint Directly...\n');
    
    // Test the exact query that the API endpoint uses
    console.log('📊 Testing searchOutstandingPayments query for Ahmed...');
    
    const [results] = await pool.execute(`
      SELECT 
        customer_name,
        customer_phone as phone,
        SUM(credit_amount) as total_outstanding,
        COUNT(id) as pending_sales_count
      FROM sales
      WHERE credit_amount > 0 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
        AND customer_name LIKE ?
      GROUP BY customer_name, customer_phone 
      HAVING total_outstanding > 0
    `, ['%Ahmed%']);
    
    console.log(`✅ API Query Results: Found ${results.length} customers`);
    
    if (results.length > 0) {
      results.forEach(customer => {
        console.log(`  - ${customer.customer_name} (${customer.phone}): $${customer.total_outstanding} (${customer.pending_sales_count} sales)`);
      });
    } else {
      console.log('❌ No results found - this explains why POS shows "No outstanding payments"');
    }
    
    // Let's also check the raw data
    console.log('\n📋 Raw sales data for Ahmed:');
    const [rawData] = await pool.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        customer_phone,
        payment_status,
        credit_amount,
        payment_amount,
        total
      FROM sales 
      WHERE customer_name LIKE '%Ahmed%'
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${rawData.length} total sales for Ahmed:`);
    rawData.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: ${sale.payment_status} | Credit: $${sale.credit_amount} | Total: $${sale.total}`);
    });
    
    // Check if there are any outstanding sales
    const outstandingSales = rawData.filter(sale => 
      (sale.payment_status === 'PENDING' || sale.payment_status === 'PARTIAL') && 
      parseFloat(sale.credit_amount) > 0
    );
    
    console.log(`\n🎯 Outstanding sales: ${outstandingSales.length}`);
    if (outstandingSales.length > 0) {
      const totalOutstanding = outstandingSales.reduce((sum, sale) => sum + parseFloat(sale.credit_amount), 0);
      console.log(`💰 Total outstanding: $${totalOutstanding.toFixed(2)}`);
    }
    
    // Test the exact API response format
    console.log('\n📤 Simulating API Response:');
    const apiResponse = {
      success: true,
      data: results.map(customer => ({
        customerName: customer.customer_name,
        phone: customer.phone,
        totalOutstanding: parseFloat(customer.total_outstanding) || 0,
        pendingSalesCount: customer.pending_sales_count
      }))
    };
    
    console.log(JSON.stringify(apiResponse, null, 2));
    
    if (apiResponse.data.length === 0) {
      console.log('\n❌ DIAGNOSIS: API endpoint returns empty data - this is why POS shows "No outstanding payments"');
      console.log('🔧 SOLUTION: Check if backend server is running with latest changes');
    } else {
      console.log('\n✅ DIAGNOSIS: API endpoint works correctly - issue might be frontend not calling API or caching');
    }
    
  } catch (error) {
    console.error('❌ Error testing API endpoint:', error);
  } finally {
    process.exit(0);
  }
}

testAPIEndpointDirectly();
