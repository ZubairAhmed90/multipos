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
    console.log(`${colors.green}✓ Login successful${colors.reset}`);
    console.log(`${colors.cyan}User: ${response.data.user?.name || response.data.data?.user?.name} (${response.data.user?.role || response.data.data?.user?.role})${colors.reset}\n`);
    return token;
  } else {
    console.error(`${colors.red}✗ Login failed:${colors.reset}`, response.data);
    process.exit(1);
  }
}

// Test Scenario: Ali Hassa's transactions
async function testAliHassaScenario(token) {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║ Testing Ali Hassa Scenario${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  try {
    // Step 1: Check current outstanding
    console.log(`${colors.cyan}Step 1: Check Ali Hassa's current outstanding${colors.reset}`);
    const outstandingResponse = await makeRequest('GET', '/sales/outstanding?phone=09000089272', token);
    
    if (outstandingResponse.status === 200 && outstandingResponse.data.success) {
      if (outstandingResponse.data.data && outstandingResponse.data.data.length > 0) {
        console.log(`${colors.yellow}Current Outstanding:${colors.reset}`);
        outstandingResponse.data.data.forEach(c => {
          const type = c.isCredit ? 'CREDIT' : 'OWES';
          const sign = c.totalOutstanding < 0 ? '-' : '+';
          console.log(`  ${c.customerName}: ${sign}${Math.abs(c.totalOutstanding).toFixed(2)} (${type})`);
        });
      } else {
        console.log(`${colors.yellow}No outstanding balance${colors.reset}`);
      }
    }
    console.log('');
    
    // Step 2: Check ledger
    console.log(`${colors.cyan}Step 2: Check Ali Hassa's ledger${colors.reset}`);
    const ledgerResponse = await makeRequest('GET', '/customer-ledger/ali hassa', token);
    
    if (ledgerResponse.status === 200 && ledgerResponse.data.success) {
      const summary = ledgerResponse.data.data?.summary || ledgerResponse.data.data;
      
      if (summary) {
        console.log(`${colors.yellow}Ledger Summary:${colors.reset}`);
        console.log(`  Transactions: ${summary.totalTransactions || summary.total_transactions || 'N/A'}`);
        console.log(`  Total Amount: ${summary.totalAmount || summary.total_amount || 'N/A'}`);
        console.log(`  Total Paid: ${summary.totalPaid || summary.total_paid || 'N/A'}`);
        const outstanding = summary.outstandingBalance || summary.outstanding_balance || 0;
        console.log(`  Outstanding: ${outstanding} ${outstanding < 0 ? '(CREDIT)' : '(OWES)'}`);
        
        const expectedBalance = -2220;
        if (outstanding === expectedBalance) {
          console.log(`${colors.green}✓ Balance is correct: ${outstanding}${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Balance mismatch. Expected: ${expectedBalance}, Got: ${outstanding}${colors.reset}`);
        }
      }
      
      // Show recent transactions
      const transactions = ledgerResponse.data.data?.transactions || [];
      if (transactions.length > 0) {
        console.log(`\n${colors.cyan}Recent Transactions:${colors.reset}`);
        transactions.slice(0, 5).forEach((tx, idx) => {
          console.log(`\n  ${idx + 1}. ${tx.invoice_no || 'N/A'}`);
          console.log(`     Amount: ${tx.amount || tx.total || tx.subtotal || 'N/A'}`);
          console.log(`     Paid: ${tx.payment || tx.paid_amount || 'N/A'}`);
          const balance = tx.balance || tx.running_balance || 0;
          console.log(`     Balance: ${balance} ${balance < 0 ? '(CREDIT)' : '(OWES)'}`);
          console.log(`     Status: ${tx.status || tx.payment_status || 'N/A'}`);
        });
      }
    }
    
    console.log('');
    
    // Step 3: Expected Results
    console.log(`${colors.cyan}Expected Results:${colors.reset}`);
    console.log(`  Transaction 1: Buy 2500 item, pay 5000 → Balance: -2500 (CREDIT)`);
    console.log(`  Transaction 2: Buy 280 item → Balance: -2220 (CREDIT)`);
    console.log(`  Final Outstanding: -2220 (CREDIT)`);
    console.log('');
    
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Testing Ali Hassa Transaction Scenario              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  const token = await login();
  
  try {
    await testAliHassaScenario(token);
    
    console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}✓ Test Complete${colors.reset}`);
    console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Test Error:${colors.reset}`, error);
  }
}

runTests().catch(console.error);

