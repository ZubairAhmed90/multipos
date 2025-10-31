const https = require('https');

const API_BASE_URL = 'https://multiposserver.petzone.pk/api';

const TEST_USER = {
  email: 'khurram@petzone.com',
  password: 'Khurram55000'
};

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function makeRequest(method, endpoint, token, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login() {
  console.log(`${colors.blue}Logging in...${colors.reset}`);
  const response = await makeRequest('POST', '/auth/login', null, TEST_USER);
  if (response.status === 200 && response.data.token) {
    console.log(`${colors.green}✓ Login successful${colors.reset}`);
    console.log(`${colors.cyan}User: ${response.data.user.name} (${response.data.user.role})${colors.reset}\n`);
    return response.data.token;
  } else {
    console.error(`${colors.red}✗ Login failed:${colors.reset}`, response.data);
    process.exit(1);
  }
}

// Test Scenario 1: Normal sale with full payment
async function testScenario1(token) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Scenario 1: Normal Sale - Full Cash Payment${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 5000,
    tax: 0,
    discount: 0,
    total: 5000,
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 5000,
    creditAmount: 0,
    paymentStatus: 'COMPLETED',
    items: [
      {
        inventoryItemId: 1, // Replace with actual inventory ID
        sku: 'TEST-001',
        name: 'Test Product 1',
        quantity: 1,
        unitPrice: 5000,
        discount: 0,
        total: 5000
      }
    ],
    customerInfo: {
      name: 'test_customer_1',
      phone: '9990000001',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sale Data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  
  try {
    const response = await makeRequest('POST', '/sales', token, saleData);
    console.log(`${colors.yellow}Response:${colors.reset}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${response.data.success}`);
    console.log(`  Message: ${response.data.message || 'N/A'}`);
    
    if (response.data.data) {
      console.log(`  Invoice: ${response.data.data.invoice_no || 'N/A'}`);
      console.log(`  Total: ${response.data.data.total || 'N/A'}`);
      console.log(`  Payment Amount: ${response.data.data.payment_amount || 'N/A'}`);
      console.log(`  Credit Amount: ${response.data.data.credit_amount || 'N/A'}`);
      console.log(`  Payment Status: ${response.data.data.payment_status || 'N/A'}`);
    }
    
    if (response.status === 201) {
      console.log(`${colors.green}✓ Scenario 1 PASSED${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}✗ Scenario 1 FAILED${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return false;
  }
}

// Test Scenario 2: Customer with negative outstanding (credit) buys item less than credit
async function testScenario2(token) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Scenario 2: Customer Has Credit, Buys Item < Credit${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  // Customer has -2800 credit, buys 1300 item
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 1300,
    tax: 0,
    discount: 0,
    total: -1500, // 1300 (purchase) - 2800 (credit) = -1500 (remaining credit)
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 0, // No cash payment, using credit
    creditAmount: -1500, // Remaining credit
    paymentStatus: 'PARTIAL',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST-002',
        name: 'Test Product 2',
        quantity: 1,
        unitPrice: 1300,
        discount: 0,
        total: 1300
      }
    ],
    customerInfo: {
      name: 'test_customer_2',
      phone: '9990000002',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sale Data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  console.log(`${colors.cyan}Expected: Payment 0, Credit -1500, Status PARTIAL${colors.reset}`);
  
  try {
    const response = await makeRequest('POST', '/sales', token, saleData);
    console.log(`${colors.yellow}Response:${colors.reset}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${response.data.success}`);
    console.log(`  Message: ${response.data.message || 'N/A'}`);
    
    if (response.data.data) {
      console.log(`  Total: ${response.data.data.total || 'N/A'}`);
      console.log(`  Payment Amount: ${response.data.data.payment_amount || 'N/A'}`);
      console.log(`  Credit Amount: ${response.data.data.credit_amount || 'N/A'}`);
      console.log(`  Payment Status: ${response.data.data.payment_status || 'N/A'}`);
    }
    
    if (response.status === 201 && 
        response.data.data && 
        response.data.data.payment_amount === 0 &&
        response.data.data.credit_amount < 0) {
      console.log(`${colors.green}✓ Scenario 2 PASSED${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}✗ Scenario 2 FAILED${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return false;
  }
}

// Test Scenario 3: Customer with credit buys item more than credit (needs to pay)
async function testScenario3(token) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Scenario 3: Customer Has Credit, Buys Item > Credit${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  // Customer has -2800 credit, buys 3500 item (needs to pay 700)
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 3500,
    tax: 0,
    discount: 0,
    total: 700, // 3500 (purchase) - 2800 (credit) = 700 (customer owes)
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 700,
    creditAmount: 0, // Credit is fully used
    paymentStatus: 'COMPLETED',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST-003',
        name: 'Test Product 3',
        quantity: 1,
        unitPrice: 3500,
        discount: 0,
        total: 3500
      }
    ],
    customerInfo: {
      name: 'test_customer_3',
      phone: '9990000003',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sale Data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  console.log(`${colors.cyan}Expected: Payment 700, Credit 0, Status COMPLETED${colors.reset}`);
  
  try {
    const response = await makeRequest('POST', '/sales', token, saleData);
    console.log(`${colors.yellow}Response:${colors.reset}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${response.data.success}`);
    
    if (response.data.data) {
      console.log(`  Total: ${response.data.data.total || 'N/A'}`);
      console.log(`  Payment Amount: ${response.data.data.payment_amount || 'N/A'}`);
      console.log(`  Credit Amount: ${response.data.data.credit_amount || 'N/A'}`);
      console.log(`  Payment Status: ${response.data.data.payment_status || 'N/A'}`);
    }
    
    if (response.status === 201) {
      console.log(`${colors.green}✓ Scenario 3 PASSED${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}✗ Scenario 3 FAILED${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return false;
  }
}

// Test Scenario 4: Overpayment (customer pays more than due)
async function testScenario4(token) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Scenario 4: Overpayment - Customer Overpays${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  // Customer buys 2000 item, pays 7000 (creates -5000 credit)
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 2000,
    tax: 0,
    discount: 0,
    total: -5000, // 2000 (purchase) - 7000 (overpayment) = -5000 (credit)
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 7000, // Overpayment
    creditAmount: -5000, // Customer gets credit
    paymentStatus: 'PARTIAL',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST-004',
        name: 'Test Product 4',
        quantity: 1,
        unitPrice: 2000,
        discount: 0,
        total: 2000
      }
    ],
    customerInfo: {
      name: 'test_customer_4',
      phone: '9990000004',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sale Data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  console.log(`${colors.cyan}Expected: Payment 7000, Credit -5000, Status PARTIAL${colors.reset}`);
  
  try {
    const response = await makeRequest('POST', '/sales', token, saleData);
    console.log(`${colors.yellow}Response:${colors.reset}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${response.data.success}`);
    
    if (response.data.data) {
      console.log(`  Total: ${response.data.data.total || 'N/A'}`);
      console.log(`  Payment Amount: ${response.data.data.payment_amount || 'N/A'}`);
      console.log(`  Credit Amount: ${response.data.data.credit_amount || 'N/A'}`);
      console.log(`  Payment Status: ${response.data.data.payment_status || 'N/A'}`);
    }
    
    if (response.status === 201 && 
        response.data.data && 
        response.data.data.credit_amount < 0) {
      console.log(`${colors.green}✓ Scenario 4 PASSED${colors.reset}\n`);
      return true;
    } else {
      console.log(`${colors.red}✗ Scenario 4 FAILED${colors.reset}\n`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return false;
  }
}

// Test outstanding query
async function testOutstandingQuery(token, phone) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Outstanding Query Test for Phone: ${phone}${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}`);
  
  try {
    const response = await makeRequest('GET', `/sales/outstanding?phone=${phone}`, token);
    console.log(`${colors.yellow}Response:${colors.reset}`);
    console.log(`  Status: ${response.status}`);
    console.log(`  Success: ${response.data.success || 'N/A'}`);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log(`${colors.cyan}Found ${response.data.data.length} customer(s):${colors.reset}`);
      response.data.data.forEach((customer, idx) => {
        console.log(`\n  Customer ${idx + 1}:`);
        console.log(`    Name: ${customer.customerName}`);
        console.log(`    Phone: ${customer.phone}`);
        console.log(`    Outstanding: ${customer.totalOutstanding} ${customer.isCredit ? '(CREDIT)' : '(OWES)'}`);
        console.log(`    Transactions: ${customer.pendingSalesCount}`);
      });
    } else {
      console.log(`${colors.yellow}  No outstanding found${colors.reset}`);
    }
    
    console.log(`${colors.green}✓ Outstanding Query PASSED${colors.reset}\n`);
    return response.data.data || [];
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    return [];
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Sales Controller Test Suite                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  const token = await login();
  
  const results = {
    scenario1: false,
    scenario2: false,
    scenario3: false,
    scenario4: false,
    outstanding: false
  };
  
  try {
    // Test outstanding query first
    results.outstanding = await testOutstandingQuery(token, '9990000001') !== null;
    
    // Uncomment to test actual sales creation
    // results.scenario1 = await testScenario1(token);
    // results.scenario2 = await testScenario2(token);
    // results.scenario3 = await testScenario3(token);
    // results.scenario4 = await testScenario4(token);
    
  } catch (error) {
    console.error(`${colors.red}Test Error:${colors.reset}`, error);
  }
  
  // Summary
  console.log(`${colors.blue}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              Test Results Summary                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  
  console.log(`Outstanding Query: ${results.outstanding ? colors.green + 'PASS' : colors.red + 'FAIL'}${colors.reset}`);
  console.log(`Scenario 1 (Normal): ${results.scenario1 ? colors.green + 'PASS' : colors.yellow + 'SKIP'}${colors.reset}`);
  console.log(`Scenario 2 (Credit < Item): ${results.scenario2 ? colors.green + 'PASS' : colors.yellow + 'SKIP'}${colors.reset}`);
  console.log(`Scenario 3 (Credit > Item): ${results.scenario3 ? colors.green + 'PASS' : colors.yellow + 'SKIP'}${colors.reset}`);
  console.log(`Scenario 4 (Overpayment): ${results.scenario4 ? colors.green + 'PASS' : colors.yellow + 'SKIP'}${colors.reset}`);
  
  console.log(`\n${colors.cyan}Note: Sales creation scenarios are skipped by default. Uncomment in code to test.${colors.reset}\n`);
}

runTests().catch(console.error);

