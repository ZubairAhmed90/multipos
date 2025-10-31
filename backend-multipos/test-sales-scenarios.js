const https = require('https');

// Backend API URL
const API_BASE_URL = 'https://multiposserver.petzone.pk/api';

// Test credentials (replace with actual credentials)
const TEST_USER = {
  email: 'khurram@petzone.com',
  password: 'Khurram55000'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Make HTTPS request
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

// Login to get token
async function login() {
  console.log(`${colors.blue}Testing login...${colors.reset}`);
  const response = await makeRequest('POST', '/auth/login', null, TEST_USER);
  if (response.status === 200 && response.data.token) {
    console.log(`${colors.green}✓ Login successful${colors.reset}`);
    console.log(`${colors.yellow}User Info:${colors.reset}`, JSON.stringify(response.data.user, null, 2));
    console.log('');
    return response.data.token;
  } else {
    console.error(`${colors.red}✗ Login failed:${colors.reset}`, response.data);
    process.exit(1);
  }
}

// Scenario 1: Customer with positive outstanding (owes money)
async function testScenario1(token) {
  console.log(`${colors.blue}=== Scenario 1: Customer owes 2000, buys 10000 ===${colors.reset}`);
  
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 10000,
    tax: 0,
    discount: 0,
    total: 12000, // 10000 (purchase) + 2000 (outstanding)
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 12000, // Customer pays full amount
    creditAmount: 0,
    paymentStatus: 'COMPLETED',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST001',
        name: 'Test Product 1',
        quantity: 1,
        unitPrice: 10000,
        discount: 0,
        total: 10000
      }
    ],
    customerInfo: {
      name: 'test_customer_1',
      phone: '9990000011',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sending sale data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  
  const response = await makeRequest('POST', '/sales', token, saleData);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 201) {
    console.log(`${colors.green}✓ Scenario 1 PASSED${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}✗ Scenario 1 FAILED${colors.reset}\n`);
    return false;
  }
}

// Scenario 2: Customer with negative outstanding (has credit), buys item less than credit
async function testScenario2(token) {
  console.log(`${colors.blue}=== Scenario 2: Customer has -2800 credit, buys 1300 ===${colors.reset}`);
  
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 1300,
    tax: 0,
    discount: 0,
    total: -1500, // 1300 (purchase) - 2800 (credit) = -1500
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 0, // Customer uses credit, no cash payment
    creditAmount: -1500, // Remaining credit
    paymentStatus: 'PARTIAL',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST002',
        name: 'Test Product 2',
        quantity: 1,
        unitPrice: 1300,
        discount: 0,
        total: 1300
      }
    ],
    customerInfo: {
      name: 'test_customer_2',
      phone: '9990000022',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sending sale data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  
  const response = await makeRequest('POST', '/sales', token, saleData);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 201) {
    console.log(`${colors.green}✓ Scenario 2 PASSED${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}✗ Scenario 2 FAILED${colors.reset}\n`);
    return false;
  }
}

// Scenario 3: Customer with negative outstanding (has credit), buys item more than credit (needs to pay)
async function testScenario3(token) {
  console.log(`${colors.blue}=== Scenario 3: Customer has -2800 credit, buys 3500 (needs to pay 700) ===${colors.reset}`);
  
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 3500,
    tax: 0,
    discount: 0,
    total: 700, // 3500 (purchase) - 2800 (credit) = 700
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 700, // Customer pays 700
    creditAmount: 0,
    paymentStatus: 'COMPLETED',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST003',
        name: 'Test Product 3',
        quantity: 1,
        unitPrice: 3500,
        discount: 0,
        total: 3500
      }
    ],
    customerInfo: {
      name: 'test_customer_3',
      phone: '9990000033',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sending sale data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  
  const response = await makeRequest('POST', '/sales', token, saleData);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 201) {
    console.log(`${colors.green}✓ Scenario 3 PASSED${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}✗ Scenario 3 FAILED${colors.reset}\n`);
    return false;
  }
}

// Scenario 4: Customer overpays (creates credit)
async function testScenario4(token) {
  console.log(`${colors.blue}=== Scenario 4: Customer overpays (creates credit) ===${colors.reset}`);
  
  const saleData = {
    scopeType: 'BRANCH',
    scopeId: '1',
    subtotal: 2000,
    tax: 0,
    discount: 0,
    total: -5000, // 2000 (purchase) - 7000 (overpayment) = -5000
    paymentMethod: 'CASH',
    paymentType: 'FULL_PAYMENT',
    paymentAmount: 2000, // Customer paid 2000
    creditAmount: -5000, // Customer gets -5000 credit
    paymentStatus: 'PARTIAL',
    items: [
      {
        inventoryItemId: 1,
        sku: 'TEST004',
        name: 'Test Product 4',
        quantity: 1,
        unitPrice: 2000,
        discount: 0,
        total: 2000
      }
    ],
    customerInfo: {
      name: 'test_customer_4',
      phone: '9990000044',
      email: '',
      address: ''
    }
  };

  console.log(`${colors.yellow}Sending sale data:${colors.reset}`, JSON.stringify(saleData, null, 2));
  
  const response = await makeRequest('POST', '/sales', token, saleData);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 201) {
    console.log(`${colors.green}✓ Scenario 4 PASSED${colors.reset}\n`);
    return true;
  } else {
    console.log(`${colors.red}✗ Scenario 4 FAILED${colors.reset}\n`);
    return false;
  }
}

// Test outstanding payments query
async function testOutstandingQuery(token, customerPhone) {
  console.log(`${colors.blue}=== Testing Outstanding Query for Phone: ${customerPhone} ===${colors.reset}`);
  
  const response = await makeRequest('GET', `/sales/outstanding?phone=${customerPhone}`, token);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 200 && response.data.success) {
    console.log(`${colors.green}✓ Outstanding query successful${colors.reset}`);
    if (response.data.data && response.data.data.length > 0) {
      response.data.data.forEach((customer, index) => {
        console.log(`  ${colors.blue}Customer ${index + 1}:${colors.reset}`);
        console.log(`    Name: ${customer.customerName}`);
        console.log(`    Phone: ${customer.phone}`);
        console.log(`    Outstanding: ${customer.totalOutstanding} ${customer.isCredit ? '(CREDIT)' : '(OWES)'}`);
        console.log(`    Count: ${customer.pendingSalesCount} transactions`);
      });
    } else {
      console.log(`  ${colors.yellow}No outstanding found for this customer${colors.reset}`);
    }
    console.log('');
    return response.data.data;
  } else {
    console.log(`${colors.red}✗ Outstanding query failed${colors.reset}\n`);
    return [];
  }
}

// Test outstanding by customer name
async function testOutstandingByName(token, customerName) {
  console.log(`${colors.blue}=== Testing Outstanding Query for Name: ${customerName} ===${colors.reset}`);
  
  const response = await makeRequest('GET', `/sales/outstanding?customerName=${encodeURIComponent(customerName)}`, token);
  console.log(`${colors.yellow}Response status:${colors.reset}`, response.status);
  console.log(`${colors.yellow}Response data:${colors.reset}`, JSON.stringify(response.data, null, 2));
  
  if (response.status === 200 && response.data.success) {
    console.log(`${colors.green}✓ Outstanding query successful${colors.reset}\n`);
    return response.data.data;
  } else {
    console.log(`${colors.red}✗ Outstanding query failed${colors.reset}\n`);
    return [];
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Sales Controller Test Suite${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // Step 1: Login
  const token = await login();
  
  console.log(`${colors.yellow}Testing outstanding payments queries with real customers...${colors.reset}\n`);
  
  try {
    // Test existing customers based on previous conversation
    const customers = [
      { name: 'ali', phone: '03013312338' }, // Had outstanding
      { name: 'shoaib', phone: '000' },      // Had -13000 credit
      { name: 'hassan', phone: '000' },      // Had negative outstanding
      { name: 'sanaullah', phone: '000' },  // Had -10000 credit
    ];
    
    for (const customer of customers) {
      if (customer.phone && customer.phone !== '000') {
        await testOutstandingQuery(token, customer.phone);
      }
      if (customer.name) {
        await testOutstandingByName(token, customer.name);
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}Error running tests:${colors.reset}`, error);
    console.error(error.stack);
  }
  
  // Summary
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Test Complete${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
}

// Run tests
runTests().catch(console.error);

