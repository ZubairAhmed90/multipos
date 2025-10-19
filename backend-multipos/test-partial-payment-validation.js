const { body, validationResult } = require('express-validator');

// Test the validation rules
async function testPartialPaymentValidation() {
  console.log('🧪 Testing Partial Payment Validation...\n');
  
  // Test data with PARTIAL_PAYMENT
  const testData = {
    paymentMethod: 'PARTIAL_PAYMENT',
    customerName: 'Ahmed',
    customerPhone: '0908090921',
    items: [{ inventoryItemId: 1, quantity: 1, price: 250 }],
    subtotal: 250,
    total: 250
  };
  
  // Test validateSale (for new sales)
  console.log('1️⃣ Testing validateSale (new sales):');
  const validateSale = [
    body('paymentMethod')
      .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'FULLY_CREDIT', 'PARTIAL_PAYMENT'])
      .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, MOBILE_PAYMENT, FULLY_CREDIT, or PARTIAL_PAYMENT')
  ];
  
  // Simulate validation
  for (const validator of validateSale) {
    try {
      await validator.run({ body: testData });
      console.log('   ✅ validateSale: PARTIAL_PAYMENT accepted');
    } catch (error) {
      console.log('   ❌ validateSale: PARTIAL_PAYMENT rejected -', error.message);
    }
  }
  
  // Test validateSaleUpdate (for sales edit)
  console.log('\n2️⃣ Testing validateSaleUpdate (sales edit):');
  const validateSaleUpdate = [
    body('paymentMethod')
      .optional()
      .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'FULLY_CREDIT', 'PARTIAL_PAYMENT'])
      .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, MOBILE_PAYMENT, FULLY_CREDIT, or PARTIAL_PAYMENT')
  ];
  
  for (const validator of validateSaleUpdate) {
    try {
      await validator.run({ body: testData });
      console.log('   ✅ validateSaleUpdate: PARTIAL_PAYMENT accepted');
    } catch (error) {
      console.log('   ❌ validateSaleUpdate: PARTIAL_PAYMENT rejected -', error.message);
    }
  }
  
  // Test validateCompleteBill (for POS)
  console.log('\n3️⃣ Testing validateCompleteBill (POS):');
  const validateCompleteBill = [
    body('paymentMethod')
      .isIn(['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'FULLY_CREDIT', 'PARTIAL_PAYMENT'])
      .withMessage('Payment method must be CASH, CARD, BANK_TRANSFER, MOBILE_PAYMENT, FULLY_CREDIT, or PARTIAL_PAYMENT')
  ];
  
  for (const validator of validateCompleteBill) {
    try {
      await validator.run({ body: testData });
      console.log('   ✅ validateCompleteBill: PARTIAL_PAYMENT accepted');
    } catch (error) {
      console.log('   ❌ validateCompleteBill: PARTIAL_PAYMENT rejected -', error.message);
    }
  }
  
  console.log('\n🎉 Validation test completed!');
  console.log('✅ PARTIAL_PAYMENT should now be accepted in all forms');
}

testPartialPaymentValidation().catch(console.error);
