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
  
  // Handle both old and new response structures
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

// Get inventory items for testing
async function getInventoryItems(token) {
  console.log(`${colors.blue}Fetching inventory items...${colors.reset}`);
  try {
    const response = await makeRequest('GET', '/inventory', token);
    if (response.status === 200 && response.data.data && response.data.data.length > 0) {
      console.log(`${colors.green}✓ Found ${response.data.data.length} inventory items${colors.reset}\n`);
      return response.data.data;
    }
    return [];
  } catch (error) {
    console.error(`${colors.red}Error fetching inventory:${colors.reset}`, error.message);
    return [];
  }
}

// Test outstanding query for specific customers
async function testOutstandingForCustomers(token) {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Testing Outstanding Queries${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  const customers = [
    { name: 'Adnan', phone: '0800297461' },
    { name: 'hassan', phone: '0000000000' },
    { name: 'ali', phone: '03013312338' },
    { name: 'shoaib', phone: '0000000000' }
  ];
  
  for (const customer of customers) {
    try {
      // Test by phone if available
      if (customer.phone && customer.phone !== '0000000000') {
        console.log(`${colors.cyan}Testing: ${customer.name} (${customer.phone})${colors.reset}`);
        const response = await makeRequest('GET', `/sales/outstanding?phone=${customer.phone}`, token);
        
        if (response.status === 200 && response.data.success) {
          if (response.data.data && response.data.data.length > 0) {
            response.data.data.forEach(c => {
              const type = c.isCredit ? 'CREDIT' : 'OWES';
              const sign = c.totalOutstanding < 0 ? '-' : '+';
              console.log(`  ${colors.green}✓${colors.reset} ${c.customerName}: ${sign}${Math.abs(c.totalOutstanding).toFixed(2)} (${type})`);
            });
          } else {
            console.log(`  ${colors.yellow}No outstanding${colors.reset}`);
          }
        } else {
          console.log(`  ${colors.red}✗ Error: ${response.data.message}${colors.reset}`);
        }
      }
      
      // Test by name
      console.log(`${colors.cyan}Testing: ${customer.name} (by name)${colors.reset}`);
      const nameResponse = await makeRequest('GET', `/sales/outstanding?customerName=${encodeURIComponent(customer.name)}`, token);
      
      if (nameResponse.status === 200 && nameResponse.data.success) {
        if (nameResponse.data.data && nameResponse.data.data.length > 0) {
          nameResponse.data.data.forEach(c => {
            const type = c.isCredit ? 'CREDIT' : 'OWES';
            const sign = c.totalOutstanding < 0 ? '-' : '+';
            console.log(`  ${colors.green}✓${colors.reset} ${c.customerName}: ${sign}${Math.abs(c.totalOutstanding).toFixed(2)} (${type})`);
          });
        } else {
          console.log(`  ${colors.yellow}No outstanding${colors.reset}`);
        }
      } else {
        console.log(`  ${colors.red}✗ Error: ${nameResponse.data.message}${colors.reset}`);
      }
      
      console.log('');
    } catch (error) {
      console.error(`${colors.red}Error testing ${customer.name}:${colors.reset}`, error.message);
    }
  }
}

// Test customer ledger
async function testCustomerLedger(token, customerName) {
  console.log(`${colors.blue}Testing Ledger for: ${customerName}${colors.reset}`);
  try {
    const response = await makeRequest('GET', `/customer-ledger/${customerName}`, token);
    
    console.log(`${colors.yellow}Response Status: ${response.status}${colors.reset}`);
    console.log(`${colors.yellow}Response Data Keys: ${Object.keys(response.data || {}).join(', ')}${colors.reset}`);
    
    if (response.status === 200) {
      // Handle different response structures
      const summary = response.data.summary || response.data.data?.summary || response.data;
      const transactions = response.data.transactions || response.data.data?.transactions || [];
      
      if (summary) {
        console.log(`${colors.cyan}Summary:${colors.reset}`);
        console.log(`  Transactions: ${summary.totalTransactions || summary.total_transactions || 'N/A'}`);
        console.log(`  Total Amount: ${summary.totalAmount || summary.total_amount || 'N/A'}`);
        console.log(`  Total Paid: ${summary.totalPaid || summary.total_paid || 'N/A'}`);
        const outstanding = summary.outstandingBalance || summary.outstanding_balance || summary.balance || 0;
        console.log(`  Outstanding: ${outstanding} ${outstanding < 0 ? '(CREDIT)' : '(OWES)'}`);
      }
      
      if (transactions.length > 0) {
        console.log(`\n${colors.cyan}Recent Transactions (${transactions.length} total):${colors.reset}`);
        transactions.slice(0, 3).forEach((tx, idx) => {
          console.log(`\n  ${idx + 1}. ${tx.invoice_no || 'N/A'}`);
          console.log(`     Date: ${tx.transaction_date || tx.created_at || 'N/A'}`);
          console.log(`     Amount: ${tx.amount || tx.total || tx.subtotal || 'N/A'}`);
          console.log(`     Paid: ${tx.payment || tx.paid_amount || 'N/A'}`);
          const balance = tx.balance || tx.running_balance || 0;
          console.log(`     Balance: ${balance} ${balance < 0 ? '(CREDIT)' : '(OWES)'}`);
          console.log(`     Status: ${tx.status || tx.payment_status || 'N/A'}`);
        });
      } else {
        console.log(`${colors.yellow}No transactions found${colors.reset}`);
      }
      
      console.log('');
    } else {
      console.log(`${colors.red}✗ Error: ${response.data.message || response.data.error || 'Unknown error'}${colors.reset}\n`);
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    console.error(error.stack);
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        Sales Controller Real Scenarios Test             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  const token = await login();
  
  try {
    // Test outstanding queries
    await testOutstandingForCustomers(token);
    
    // Test customer ledgers
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}Testing Customer Ledgers${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);
    
    const customers = ['Adnan', 'hassan', 'ali', 'shoaib'];
    for (const customer of customers) {
      await testCustomerLedger(token, customer);
    }
    
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.green}✓ All Tests Complete${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);
    
  } catch (error) {
    console.error(`${colors.red}Test Error:${colors.reset}`, error);
  }
}

runTests().catch(console.error);

