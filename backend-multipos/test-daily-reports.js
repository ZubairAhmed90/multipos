const mysql = require('mysql2/promise');

async function testDailyReports() {
  const connection = await mysql.createConnection({
    host: 'h40.eu.core.hostnext.net',
    user: 'petzonep_zubairahmed',
    password: 'kaimkhankhani@123',
    database: 'petzonep_software',
    port: 3306
  });

  try {
    // Test query for sales on 2025-10-27
    const [sales] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(total) as revenue
      FROM sales 
      WHERE DATE(created_at) = '2025-10-27'
      GROUP BY DATE(created_at)
    `);

    console.log('Sales on 2025-10-27:', sales);

    // Test query for all recent sales
    const [allSales] = await connection.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(total) as revenue
      FROM sales 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    console.log('\nLast 7 days sales:');
    console.table(allSales);

    // Test query for cashier role branch
    const [cashierBranch] = await connection.execute(`
      SELECT DISTINCT scope_type, scope_id 
      FROM sales 
      WHERE scope_type = 'BRANCH'
      LIMIT 10
    `);

    console.log('\nBranch sales:');
    console.table(cashierBranch);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testDailyReports();

