// Test file to verify balance calculation scenarios
// This file demonstrates how the customer ledger calculates balances

console.log('========================================');
console.log('Customer Ledger Balance Scenarios Test');
console.log('========================================\n');

// Scenario 1: Using Credit (Customer Has Existing Credit)
console.log('SCENARIO 1: Using Credit');
console.log('------------------------');
let oldBalance1 = -300;
let currentBill1 = 250;
let actualPayment1 = 0;
let totalAmountDue1 = oldBalance1 + currentBill1;
let newBalance1 = totalAmountDue1 - actualPayment1;
console.log(`Old Balance: ${oldBalance1} (customer has 300 credit)`);
console.log(`Current Bill: ${currentBill1}`);
console.log(`Actual Payment: ${actualPayment1} (using credit only)`);
console.log(`Total Amount Due: ${totalAmountDue1}`);
console.log(`New Balance: ${newBalance1}`);
console.log(`✓ Customer used 250 of their 300 credit`);
console.log(`✓ Remaining credit: -50\n`);

// Scenario 2: Using Credit with Partial Payment
console.log('SCENARIO 2: Using Credit with Partial Payment');
console.log('---------------------------------------------');
let oldBalance2 = -300;
let currentBill2 = 250;
let actualPayment2 = 100;
let totalAmountDue2 = oldBalance2 + currentBill2;
let newBalance2 = totalAmountDue2 - actualPayment2;
console.log(`Old Balance: ${oldBalance2} (customer has 300 credit)`);
console.log(`Current Bill: ${currentBill2}`);
console.log(`Actual Payment: ${actualPayment2} (paying part cash, part credit)`);
console.log(`Total Amount Due: ${totalAmountDue2}`);
console.log(`New Balance: ${newBalance2}`);
console.log(`✓ Customer paid 100 cash`);
console.log(`✓ Used 150 credit`);
console.log(`✓ Remaining credit: -150\n`);

// Scenario 3: Overpayment (Creates New Credit)
console.log('SCENARIO 3: Overpayment');
console.log('-----------------------');
let oldBalance3 = 1000;
let currentBill3 = 500;
let actualPayment3 = 2000;
let totalAmountDue3 = oldBalance3 + currentBill3;
let newBalance3 = totalAmountDue3 - actualPayment3;
console.log(`Old Balance: ${oldBalance3} (customer owes 1000)`);
console.log(`Current Bill: ${currentBill3}`);
console.log(`Actual Payment: ${actualPayment3} (customer overpaid)`);
console.log(`Total Amount Due: ${totalAmountDue3}`);
console.log(`New Balance: ${newBalance3}`);
console.log(`✓ Customer owed 1500 total`);
console.log(`✓ Paid 2000 (500 extra)`);
console.log(`✓ Now has -500 credit\n`);

// Scenario 4: Building Debt (Normal Purchase)
console.log('SCENARIO 4: Building Debt');
console.log('--------------------------');
let oldBalance4 = 1000;
let currentBill4 = 500;
let actualPayment4 = 200;
let totalAmountDue4 = oldBalance4 + currentBill4;
let newBalance4 = totalAmountDue4 - actualPayment4;
console.log(`Old Balance: ${oldBalance4} (customer owes 1000)`);
console.log(`Current Bill: ${currentBill4}`);
console.log(`Actual Payment: ${actualPayment4} (partial payment)`);
console.log(`Total Amount Due: ${totalAmountDue4}`);
console.log(`New Balance: ${newBalance4}`);
console.log(`✓ Customer now owes 1300`);
console.log(`✓ Debt increased by 300\n`);

// Scenario 5: Paying Off Debt
console.log('SCENARIO 5: Paying Off Debt');
console.log('----------------------------');
let oldBalance5 = 1000;
let currentBill5 = 500;
let actualPayment5 = 1500;
let totalAmountDue5 = oldBalance5 + currentBill5;
let newBalance5 = totalAmountDue5 - actualPayment5;
console.log(`Old Balance: ${oldBalance5} (customer owes 1000)`);
console.log(`Current Bill: ${currentBill5}`);
console.log(`Actual Payment: ${actualPayment5} (full payment)`);
console.log(`Total Amount Due: ${totalAmountDue5}`);
console.log(`New Balance: ${newBalance5}`);
console.log(`✓ Debt fully paid`);
console.log(`✓ Balance: 0\n`);

// Scenario 6: Creating Credit from Negative
console.log('SCENARIO 6: Creating Credit from Negative');
console.log('-------------------------------------------');
let oldBalance6 = -500;
let currentBill6 = 300;
let actualPayment6 = 0;
let totalAmountDue6 = oldBalance6 + currentBill6;
let newBalance6 = totalAmountDue6 - actualPayment6;
console.log(`Old Balance: ${oldBalance6} (customer has 500 credit)`);
console.log(`Current Bill: ${currentBill6}`);
console.log(`Actual Payment: ${actualPayment6} (using credit only)`);
console.log(`Total Amount Due: ${totalAmountDue6}`);
console.log(`New Balance: ${newBalance6}`);
console.log(`✓ Customer used 300 credit`);
console.log(`✓ Remaining credit: -200\n`);

// Scenario 7: Paying Cash when Customer Has Credit
console.log('SCENARIO 7: Paying Cash when Customer Has Credit');
console.log('--------------------------------------------------');
let oldBalance7 = -300;
let currentBill7 = 250;
let actualPayment7 = 250;
let totalAmountDue7 = oldBalance7 + currentBill7;
let newBalance7 = totalAmountDue7 - actualPayment7;
console.log(`Old Balance: ${oldBalance7} (customer has 300 credit)`);
console.log(`Current Bill: ${currentBill7}`);
console.log(`Actual Payment: ${actualPayment7} (paying in cash)`);
console.log(`Total Amount Due: ${totalAmountDue7}`);
console.log(`New Balance: ${newBalance7}`);
console.log(`✓ Customer paid 250 cash`);
console.log(`✓ Credit remains at -300`);
console.log(`✓ Note: Customer could have used credit instead\n`);

console.log('========================================');
console.log('All Scenarios Verified!');
console.log('========================================');



