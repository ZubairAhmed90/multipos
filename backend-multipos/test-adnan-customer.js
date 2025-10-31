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
    console.log(`${colors.green}✓ Login successful${colors.reset}\n`);
    return response.data.token;
  } else {
    console.error(`${colors.red}✗ Login failed:${colors.reset}`, response.data);
    process.exit(1);
  }
}

async function testOutstandingForAdnan(token) {
  console.log(`${colors.blue}=== Testing Outstanding Payments for Adnan ===${colors.reset}`);
  
  // Test by phone
  const phoneResponse = await makeRequest('GET', '/sales/outstanding?phone=0800297461', token);
  console.log(`${colors.yellow}Outstanding by phone (0800297461):${colors.reset}`);
  console.log(`Status: ${phoneResponse.status}`);
  console.log(`Data:`, JSON.stringify(phoneResponse.data, null, 2));
  console.log('');
  
  // Test by name
  const nameResponse = await makeRequest('GET', '/sales/outstanding?customerName=Adnan', token);
  console.log(`${colors.yellow}Outstanding by name (Adnan):${colors.reset}`);
  console.log(`Status: ${nameResponse.status}`);
  console.log(`Data:`, JSON.stringify(nameResponse.data, null, 2));
  console.log('');
  
  return phoneResponse.data;
}

async function testCustomerLedgerForAdnan(token) {
  console.log(`${colors.blue}=== Testing Customer Ledger for Adnan ===${colors.reset}`);
  
  const response = await makeRequest('GET', '/customer-ledger/Adnan', token);
  console.log(`${colors.yellow}Ledger response:${colors.reset}`);
  console.log(`Status: ${response.status}`);
  console.log(`Summary:`, JSON.stringify(response.data.summary || response.data, null, 2));
  
  if (response.data.transactions) {
    console.log(`\n${colors.yellow}First 3 transactions:${colors.reset}`);
    response.data.transactions.slice(0, 3).forEach((txn, idx) => {
      console.log(`\nTransaction ${idx + 1}:`, {
        invoice: txn.invoice_no,
        amount: txn.amount,
        oldBalance: txn.old_balance,
        paid: txn.payment || txn.paid_amount,
        balance: txn.balance || txn.running_balance,
        status: txn.status || txn.payment_status_display
      });
    });
  }
  
  console.log('');
  return response.data;
}

async function runTests() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Testing Adnan Customer${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  const token = await login();
  
  try {
    const outstandingResult = await testOutstandingForAdnan(token);
    const ledgerResult = await testCustomerLedgerForAdnan(token);
    
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}  Comparison${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}`);
    
    if (outstandingResult && outstandingResult.data && outstandingResult.data.length > 0) {
      const adnan = outstandingResult.data.find(c => c.customerName === 'Adnan' || c.phone === '0800297461');
      if (adnan) {
        console.log(`${colors.yellow}Outstanding Query shows:${colors.reset} ${adnan.totalOutstanding}`);
      }
    }
    
    if (ledgerResult && ledgerResult.summary) {
      console.log(`${colors.yellow}Customer Ledger shows:${colors.reset} ${ledgerResult.summary.outstandingBalance}`);
    }
    
    console.log(`${colors.blue}========================================${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
  }
}

runTests().catch(console.error);

