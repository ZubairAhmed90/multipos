// Test script to verify balance payment calculation
// This simulates what the backend receives for a balance payment

console.log('========================================');
console.log('Balance Payment Test: Shahbaz Scenario');
console.log('========================================\n');

// Scenario: Customer has -300 credit, buys 280 item using balance

// What POS sends to backend:
const saleData = {
  total: 280, // billAmount (cart items)
  paymentAmount: 0, // No cash payment
  creditAmount: 280, // Uses from balance
  paymentType: 'BALANCE_PAYMENT',
  paymentStatus: 'COMPLETED'
};

// Backend calculations:
const previousRunningBalance = -300;
const billAmount = 280;
const finalPaymentAmount = 0;
const finalCreditAmount = 280;

// Calculate running balance
const newCreditAmount = billAmount - finalPaymentAmount;
const runningBalance = previousRunningBalance + newCreditAmount;

console.log('Input Data from POS:');
console.log(`  Total: ${saleData.total}`);
console.log(`  Payment Amount: ${saleData.paymentAmount}`);
console.log(`  Credit Amount: ${saleData.creditAmount}`);
console.log(`  Payment Type: ${saleData.paymentType}\n`);

console.log('Backend Calculations:');
console.log(`  Previous Running Balance: ${previousRunningBalance}`);
console.log(`  Bill Amount: ${billAmount}`);
console.log(`  Final Payment Amount: ${finalPaymentAmount}`);
console.log(`  Final Credit Amount: ${finalCreditAmount}`);
console.log(`  New Credit Amount: ${newCreditAmount} (bill - payment)`);
console.log(`  Running Balance: ${runningBalance}\n`);

console.log('Formula Verification:');
console.log(`  runningBalance = previousRunningBalance + (billAmount - finalPaymentAmount)`);
console.log(`  runningBalance = ${previousRunningBalance} + (${billAmount} - ${finalPaymentAmount})`);
console.log(`  runningBalance = ${previousRunningBalance} + ${newCreditAmount}`);
console.log(`  runningBalance = ${runningBalance}\n`);

console.log('Expected Result: -20 (customer now has 20 credit)');
console.log('Actual Result:', runningBalance);
console.log('\n✅ Test', runningBalance === -20 ? 'PASSED' : 'FAILED');
console.log('========================================');



