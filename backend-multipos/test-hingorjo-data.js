const mysql = require('mysql2/promise');

async function testHingorjoData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'petzonep_software',
    port: 3306
  });

  try {
    // Get all transactions for hingorjo
    const [sales] = await connection.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        customer_phone,
        total,
        payment_amount,
        credit_amount,
        created_at
      FROM sales
      WHERE customer_name LIKE '%hingorjo%' OR customer_phone LIKE '%098009076%'
      ORDER BY created_at ASC
    `);

    console.log('\n📊 ALL TRANSACTIONS FOR HINGORJO:');
    console.log('=====================================');
    
    let runningBalance = 0;
    sales.forEach((sale, index) => {
      const oldBalance = runningBalance;
      const actualPaid = sale.payment_amount < 0 ? 0 : sale.payment_amount;
      const contribution = sale.total - actualPaid;
      runningBalance = oldBalance + contribution;
      
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`  Invoice: ${sale.invoice_no}`);
      console.log(`  Total: ${sale.total}`);
      console.log(`  Payment: ${sale.payment_amount}`);
      console.log(`  Credit: ${sale.credit_amount}`);
      console.log(`  Old Balance: ${oldBalance}`);
      console.log(`  Contribution: ${contribution}`);
      console.log(`  New Balance: ${runningBalance}`);
    });

    console.log('\n📊 SUMMARY:');
    console.log(`Total Outstanding: ${runningBalance}`);
    
    // Test the query
    const [outstanding] = await connection.execute(`
      SELECT 
        customer_name,
        customer_phone,
        SUM(total - IF(payment_amount < 0, 0, payment_amount)) as total_outstanding
      FROM sales
      WHERE customer_name LIKE '%hingorjo%' OR customer_phone LIKE '%098009076%'
      GROUP BY customer_name, customer_phone
    `);

    console.log('\n📊 OUTSTANDING QUERY RESULT:');
    console.log(JSON.stringify(outstanding, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

testHingorjoData();



