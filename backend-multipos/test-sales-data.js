const mysql = require('mysql2/promise');

async function testSalesData() {
  const connection = await mysql.createConnection({
    host: 'h40.eu.core.hostnext.net',
    user: 'petzonep_zubairahmed',
    password: 'kaimkhankhani@123',
    database: 'petzonep_software',
    port: 3306
  });

  try {
    console.log('✅ Connected to database\n');

    // Test 1: Check if there are ANY sales
    const [allSales] = await connection.execute('SELECT COUNT(*) as count FROM sales');
    console.log('Total sales in database:', allSales[0].count);

    // Test 2: Check sales by date
    const [salesByDate] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(total) as revenue
      FROM sales 
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 10
    `);
    
    console.log('\n📅 Sales by Date (Last 10 days):');
    salesByDate.forEach(row => {
      console.log(`${row.date}: ${row.count} transactions, Revenue: ${row.revenue}`);
    });

    // Test 3: Check for 2025-10-27 specifically
    const [oct27Sales] = await connection.execute(`
      SELECT 
        id,
        DATE(created_at) as date,
        total,
        payment_method,
        scope_type,
        scope_id
      FROM sales 
      WHERE DATE(created_at) = '2025-10-27'
      LIMIT 10
    `);
    
    console.log('\n📊 Sales on 2025-10-27:', oct27Sales.length);
    if (oct27Sales.length > 0) {
      oct27Sales.forEach(sale => {
        console.log(`  - ID: ${sale.id}, Total: ${sale.total}, Payment: ${sale.payment_method}, Scope: ${sale.scope_type}/${sale.scope_id}`);
      });
    }

    // Test 4: Check branch sales
    const [branchSales] = await connection.execute(`
      SELECT DISTINCT scope_type, scope_id, COUNT(*) as count
      FROM sales 
      WHERE scope_type = 'BRANCH'
      GROUP BY scope_type, scope_id
    `);
    
    console.log('\n🏪 Branch Sales:');
    branchSales.forEach(row => {
      console.log(`  - ${row.scope_type}/${row.scope_id}: ${row.count} sales`);
    });

    // Test 5: Latest sales
    const [latestSales] = await connection.execute(`
      SELECT 
        id,
        DATE(created_at) as date,
        TIME(created_at) as time,
        total,
        payment_method,
        scope_type,
        scope_id
      FROM sales 
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\n🕐 Latest 5 Sales:');
    latestSales.forEach(sale => {
      console.log(`  - ${sale.date} ${sale.time}: ${sale.total} (${sale.payment_method}) from ${sale.scope_type}/${sale.scope_id}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

testSalesData();


