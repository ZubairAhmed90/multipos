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
  const token = response.data.token || response.data.accessToken || response.data.data?.accessToken;
  if (response.status === 200 && token) {
    console.log(`${colors.green}✓ Login successful${colors.reset}\n`);
    return token;
  } else {
    console.error(`${colors.red}✗ Login failed:${colors.reset}`, response.data);
    process.exit(1);
  }
}

async function checkAdnanSales(token) {
  console.log(`${colors.blue}Checking Adnan's Sales in Database${colors.reset}`);
  console.log(`${colors.yellow}Note: This requires direct DB access or a custom endpoint${colors.reset}\n`);
  
  // Check outstanding
  console.log(`${colors.cyan}Outstanding Query:${colors.reset}`);
  const outstanding = await makeRequest('GET', '/sales/outstanding?phone=0800297461', token);
  if (outstanding.status === 200 && outstanding.data.success) {
    outstanding.data.data.forEach(c => {
      console.log(`  ${c.customerName}: ${c.totalOutstanding} (${c.isCredit ? 'CREDIT' : 'OWES'})`);
    });
  }
  console.log('');
  
  // Check ledger
  console.log(`${colors.cyan}Customer Ledger:${colors.reset}`);
  const ledger = await makeRequest('GET', '/customer-ledger/adnan', token);
  if (ledger.status === 200 && ledger.data.success) {
    const transactions = ledger.data.data?.transactions || [];
    console.log(`  Total Transactions: ${transactions.length}`);
    
    let totalFromSales = 0;
    let totalPaid = 0;
    
    transactions.forEach((tx, idx) => {
      console.log(`\n  Transaction ${idx + 1}: ${tx.invoice_no}`);
      console.log(`    Date: ${tx.transaction_date || tx.created_at}`);
      console.log(`    Amount: ${tx.amount || tx.total || tx.subtotal}`);
      console.log(`    Paid: ${tx.payment || tx.paid_amount}`);
      console.log(`    Running Balance: ${tx.balance || tx.running_balance}`);
      console.log(`    Status: ${tx.status || tx.payment_status}`);
      
      totalFromSales += parseFloat(tx.amount || tx.total || tx.subtotal || 0);
      totalPaid += parseFloat(tx.payment || tx.paid_amount || 0);
    });
    
    console.log(`\n  Sum of (total - payment): ${totalFromSales - totalPaid}`);
    
    const summary = ledger.data.data?.summary || ledger.data.data;
    if (summary) {
      console.log(`\n  Ledger Summary Outstanding: ${summary.outstandingBalance || summary.outstanding_balance}`);
    }
  }
}

async function runTests() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║     Detailed Adnan Transaction Analysis                   ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  const token = await login();
  
  try {
    await checkAdnanSales(token);
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
  }
}

runTests().catch(console.error);

