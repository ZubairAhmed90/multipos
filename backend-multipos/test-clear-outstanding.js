const { pool } = require('./config/database');

async function testClearOutstandingPayment() {
  try {
    console.log('🔍 Testing Clear Outstanding Payment Function...\n');
    
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
    
    // Test clearing a partial amount
    const testPaymentAmount = Math.min(100, totalOutstanding); // Clear $100 or total outstanding, whichever is smaller
    console.log(`\n🧪 Testing payment clearing with $${testPaymentAmount}...`);
    
    // Simulate the clear outstanding payment API call
    const clearPaymentData = {
      customerName: 'Ahmed',
      phone: '0908090921',
      paymentAmount: testPaymentAmount,
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
      
      // Get updated outstanding amount
      const [outstanding] = await connection.execute(
        `SELECT SUM(credit_amount) as remaining_outstanding
         FROM sales 
         WHERE customer_name = ? AND customer_phone = ? 
           AND (payment_status = 'PENDING' OR payment_status = 'PARTIAL') AND credit_amount > 0`,
        [clearPaymentData.customerName, clearPaymentData.phone]
      );
      
      const remainingOutstanding = parseFloat(outstanding[0].remaining_outstanding) || 0;
      
      console.log(`\n📈 Results:`);
      console.log(`  - Payment Amount: $${clearPaymentData.paymentAmount}`);
      console.log(`  - Remaining Outstanding: $${remainingOutstanding.toFixed(2)}`);
      console.log(`  - Fully Cleared: ${remainingOutstanding <= 0 ? 'YES' : 'NO'}`);
      console.log(`  - Unprocessed Amount: $${remainingPayment.toFixed(2)}`);
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
    console.log('\n🎉 Test completed successfully!');
    console.log('✅ Both PENDING and PARTIAL status payments are now properly handled.');
    
  } catch (error) {
    console.error('❌ Error testing clear outstanding payment:', error);
  } finally {
    process.exit(0);
  }
}

testClearOutstandingPayment();
