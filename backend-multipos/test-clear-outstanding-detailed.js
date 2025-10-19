const { pool } = require('./config/database');

async function testClearOutstandingAPI() {
  try {
    console.log('🔍 Testing Clear Outstanding API Logic...\n');
    
    // First, let's see Ahmed's current outstanding payments
    console.log('📊 Ahmed\'s current outstanding payments:');
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
        created_at,
        updated_at
      FROM sales 
      WHERE customer_name LIKE '%Ahmed%' 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
        AND credit_amount > 0
      ORDER BY created_at ASC
    `);
    
    console.log(`Found ${outstanding.length} outstanding sales:`);
    outstanding.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: $${sale.total} | ${sale.payment_method} | ${sale.payment_status} | Credit: $${sale.credit_amount} | Updated: ${sale.updated_at}`);
    });
    
    if (outstanding.length === 0) {
      console.log('❌ No outstanding payments found for Ahmed. Cannot test clearing.');
      return;
    }
    
    const totalOutstanding = outstanding.reduce((sum, sale) => sum + parseFloat(sale.credit_amount), 0);
    console.log(`\n💰 Total outstanding amount: $${totalOutstanding.toFixed(2)}`);
    
    // Test the exact API logic
    console.log(`\n🧪 Testing clear-outstanding API logic...`);
    
    const customerName = 'Ahmed';
    const phone = '0908090921';
    const paymentAmount = totalOutstanding;
    const paymentMethod = 'CASH';
    
    console.log('📤 API Parameters:', {
      customerName,
      phone,
      paymentAmount,
      paymentMethod
    });
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get all outstanding sales for the customer (exact API logic)
      const [outstandingSales] = await connection.execute(
        `SELECT id, invoice_no, credit_amount, payment_amount, total, payment_status
         FROM sales 
         WHERE customer_name = ? AND customer_phone = ? 
           AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL') 
           AND credit_amount > 0
         ORDER BY created_at ASC`,
        [customerName, phone]
      );
      
      console.log(`\n🔍 Found ${outstandingSales.length} sales to process:`);
      outstandingSales.forEach(sale => {
        console.log(`  - ${sale.invoice_no}: Credit $${sale.credit_amount} | Payment $${sale.payment_amount} | Status: ${sale.payment_status}`);
      });
      
      let remainingPayment = parseFloat(paymentAmount);
      let processedSales = [];
      
      console.log(`\n🔄 Processing payments (remaining: $${remainingPayment})...`);
      
      // Process each outstanding sale
      for (const sale of outstandingSales) {
        if (remainingPayment <= 0) {
          console.log(`  ⏹️ No more payment to apply (remaining: $${remainingPayment})`);
          break;
        }
        
        const currentCredit = parseFloat(sale.credit_amount);
        const paymentToApply = Math.min(remainingPayment, currentCredit);
        
        console.log(`  📝 Processing ${sale.invoice_no}:`);
        console.log(`    - Current Credit: $${currentCredit}`);
        console.log(`    - Payment to Apply: $${paymentToApply}`);
        
        // Update the sale
        const newPaymentAmount = parseFloat(sale.payment_amount) + paymentToApply;
        const newCreditAmount = currentCredit - paymentToApply;
        const newPaymentStatus = newCreditAmount <= 0 ? 'COMPLETED' : 'PARTIAL';
        
        console.log(`    - New Payment Amount: $${newPaymentAmount}`);
        console.log(`    - New Credit Amount: $${newCreditAmount}`);
        console.log(`    - New Status: ${newPaymentStatus} (${newCreditAmount <= 0 ? 'COMPLETED' : 'PARTIAL'})`);
        
        await connection.execute(
          `UPDATE sales 
           SET payment_amount = ?, 
               credit_amount = ?, 
               payment_status = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [newPaymentAmount, newCreditAmount, newPaymentStatus, sale.id]
        );
        
        processedSales.push({
          saleId: sale.id,
          invoiceNo: sale.invoice_no,
          paymentApplied: paymentToApply,
          remainingCredit: newCreditAmount,
          newStatus: newPaymentStatus
        });
        
        console.log(`    ✅ Updated successfully!`);
        
        remainingPayment -= paymentToApply;
        console.log(`    - Remaining Payment: $${remainingPayment}`);
      }
      
      await connection.commit();
      
      console.log(`\n✅ Transaction committed successfully!`);
      console.log(`📊 Processed ${processedSales.length} sales:`);
      processedSales.forEach(sale => {
        console.log(`  - ${sale.invoiceNo}: Applied $${sale.paymentApplied} | Remaining: $${sale.remainingCredit} | Status: ${sale.newStatus}`);
      });
      
      // Verify the results
      console.log('\n🔍 Verifying results...');
      const [updatedSales] = await connection.execute(`
        SELECT 
          id,
          invoice_no,
          payment_status,
          credit_amount,
          payment_amount,
          updated_at
        FROM sales 
        WHERE customer_name LIKE '%Ahmed%'
        ORDER BY created_at DESC
      `);
      
      console.log('📋 All Ahmed sales after clearing:');
      updatedSales.forEach(sale => {
        console.log(`  - ${sale.invoice_no}: ${sale.payment_status} | Credit: $${sale.credit_amount} | Payment: $${sale.payment_amount} | Updated: ${sale.updated_at}`);
      });
      
      // Check if any sales still have outstanding amounts
      const stillOutstanding = updatedSales.filter(sale => 
        (sale.payment_status === 'PENDING' || sale.payment_status === 'PARTIAL') && 
        parseFloat(sale.credit_amount) > 0
      );
      
      if (stillOutstanding.length === 0) {
        console.log('\n🎉 SUCCESS: All outstanding payments have been cleared!');
        console.log('✅ All partial payment statuses have been updated to COMPLETED');
      } else {
        console.log(`\n⚠️  WARNING: ${stillOutstanding.length} sales still have outstanding amounts`);
        stillOutstanding.forEach(sale => {
          console.log(`  - ${sale.invoice_no}: ${sale.payment_status} | Credit: $${sale.credit_amount}`);
        });
      }
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Transaction rolled back due to error:', error);
      throw error;
    } finally {
      connection.release();
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing clear outstanding API:', error);
  } finally {
    process.exit(0);
  }
}

testClearOutstandingAPI();
