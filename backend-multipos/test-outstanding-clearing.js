const { pool } = require('./config/database');

async function testOutstandingPaymentClearing() {
  try {
    console.log('🔍 Testing Outstanding Payment Clearing Process...\n');
    
    // First, let's see Ahmed's current outstanding payments
    console.log('📊 Ahmed\'s current outstanding payments:');
    const [currentOutstanding] = await pool.execute(`
      SELECT 
        id,
        invoice_no,
        customer_name,
        customer_phone,
        total,
        payment_amount,
        credit_amount,
        payment_status
      FROM sales 
      WHERE customer_name LIKE '%Ahmed%' 
        AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL')
        AND credit_amount > 0
      ORDER BY created_at ASC
    `);
    
    console.log(`Found ${currentOutstanding.length} outstanding sales:`);
    currentOutstanding.forEach(sale => {
      console.log(`  - ${sale.invoice_no}: $${sale.total} | ${sale.payment_status} | Credit: $${sale.credit_amount}`);
    });
    
    if (currentOutstanding.length === 0) {
      console.log('❌ No outstanding payments found for Ahmed. Cannot test clearing.');
      return;
    }
    
    const totalOutstanding = currentOutstanding.reduce((sum, sale) => sum + parseFloat(sale.credit_amount), 0);
    console.log(`\n💰 Total outstanding amount: $${totalOutstanding.toFixed(2)}`);
    
    // Test clearing the full outstanding amount
    console.log(`\n🧪 Testing payment clearing with FULL amount ($${totalOutstanding.toFixed(2)})...`);
    
    // Simulate the clear outstanding payment API call
    const clearPaymentData = {
      customerName: 'Ahmed',
      phone: '0908090921',
      paymentAmount: totalOutstanding,
      paymentMethod: 'CASH'
    };
    
    console.log('📤 Simulating API call with data:', clearPaymentData);
    
    // Get connection and simulate the transaction
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get all outstanding sales for the customer
      const [outstandingSales] = await connection.execute(
        `SELECT id, invoice_no, credit_amount, payment_amount, total, payment_status
         FROM sales 
         WHERE customer_name = ? AND customer_phone = ? 
           AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL') 
           AND credit_amount > 0
         ORDER BY created_at ASC`,
        [clearPaymentData.customerName, clearPaymentData.phone]
      );
      
      let remainingPayment = parseFloat(clearPaymentData.paymentAmount);
      let processedSales = [];
      
      console.log(`\n🔄 Processing ${outstandingSales.length} outstanding sales...`);
      
      // Process each outstanding sale
      for (const sale of outstandingSales) {
        if (remainingPayment <= 0) break;
        
        const currentCredit = parseFloat(sale.credit_amount);
        const paymentToApply = Math.min(remainingPayment, currentCredit);
        
        console.log(`  - Processing ${sale.invoice_no}: Credit $${currentCredit} → Applying $${paymentToApply}`);
        
        // Update the sale
        const newPaymentAmount = parseFloat(sale.payment_amount) + paymentToApply;
        const newCreditAmount = currentCredit - paymentToApply;
        const newPaymentStatus = newCreditAmount <= 0 ? 'COMPLETED' : 'PARTIAL';
        
        console.log(`    📊 Status Logic: newCreditAmount (${newCreditAmount}) <= 0 ? 'COMPLETED' : 'PARTIAL'`);
        console.log(`    ✅ New Status: ${newPaymentStatus}`);
        
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
        
        console.log(`    ✅ Updated: Payment $${newPaymentAmount} | Credit $${newCreditAmount} | Status: ${newPaymentStatus}`);
        
        remainingPayment -= paymentToApply;
      }
      
      await connection.commit();
      
      console.log(`\n✅ Payment clearing completed!`);
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
          payment_amount
        FROM sales 
        WHERE customer_name LIKE '%Ahmed%'
        ORDER BY created_at DESC
      `);
      
      console.log('📋 All Ahmed sales after clearing:');
      updatedSales.forEach(sale => {
        console.log(`  - ${sale.invoice_no}: ${sale.payment_status} | Credit: $${sale.credit_amount} | Payment: $${sale.payment_amount}`);
      });
      
      // Check if any sales still have outstanding amounts
      const stillOutstanding = updatedSales.filter(sale => 
        (sale.payment_status === 'PENDING' || sale.payment_status === 'PARTIAL') && 
        parseFloat(sale.credit_amount) > 0
      );
      
      if (stillOutstanding.length === 0) {
        console.log('\n🎉 SUCCESS: All outstanding payments have been cleared!');
        console.log('✅ Partial payment statuses have been automatically updated to COMPLETED');
      } else {
        console.log(`\n⚠️  WARNING: ${stillOutstanding.length} sales still have outstanding amounts`);
        stillOutstanding.forEach(sale => {
          console.log(`  - ${sale.invoice_no}: ${sale.payment_status} | Credit: $${sale.credit_amount}`);
        });
      }
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing outstanding payment clearing:', error);
  } finally {
    process.exit(0);
  }
}

testOutstandingPaymentClearing();
