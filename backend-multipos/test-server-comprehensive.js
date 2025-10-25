const https = require('https');

// Test configuration
const BASE_URL = 'https://multiposserver.petzone.pk/api';
const TEST_USER = {
  email: 'admin@example.com', // Replace with your test user email
  password: 'password123'     // Replace with your test user password
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: jsonData,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test functions
async function testServerHealth() {
  console.log('🏥 Testing Server Health...');
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
      console.log('   ✅ Server is healthy');
      return true;
    } else {
      console.log('   ❌ Server health check failed');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Server health check error: ${error.message}`);
    return false;
  }
}

async function testInventoryAPI() {
  console.log('\n📦 Testing Inventory API...');
  try {
    const response = await makeRequest(`${BASE_URL}/inventory`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   ✅ Inventory API working');
      console.log(`   📊 Found ${response.data.data?.length || 0} inventory items`);
      
      // Check if computed fields are present
      if (response.data.data && response.data.data.length > 0) {
        const sampleItem = response.data.data[0];
        const hasComputedFields = sampleItem.totalPurchased !== undefined && 
                                 sampleItem.totalSold !== undefined;
        console.log(`   ${hasComputedFields ? '✅' : '❌'} Computed fields present: ${hasComputedFields}`);
      }
      
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Inventory API requires authentication');
      return 'auth_required';
    } else {
      console.log(`   ❌ Inventory API failed: ${response.data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Inventory API error: ${error.message}`);
    return false;
  }
}

async function testPurchaseOrdersAPI() {
  console.log('\n🛒 Testing Purchase Orders API...');
  try {
    const response = await makeRequest(`${BASE_URL}/purchase-orders`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   ✅ Purchase Orders API working');
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Purchase Orders API requires authentication');
      return 'auth_required';
    } else {
      console.log(`   ❌ Purchase Orders API failed: ${response.data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Purchase Orders API error: ${error.message}`);
    return false;
  }
}

async function testSuppliersAPI() {
  console.log('\n🏢 Testing Suppliers API...');
  try {
    const response = await makeRequest(`${BASE_URL}/purchase-orders/suppliers?scopeType=BRANCH&scopeId=1`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('   ✅ Suppliers API working');
      console.log(`   📊 Found ${response.data.data?.length || 0} suppliers`);
      return true;
    } else if (response.status === 401) {
      console.log('   ⚠️  Suppliers API requires authentication');
      return 'auth_required';
    } else {
      console.log(`   ❌ Suppliers API failed: ${response.data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Suppliers API error: ${error.message}`);
    return false;
  }
}

async function testInventoryUpdate() {
  console.log('\n✏️  Testing Inventory Update...');
  try {
    // First get an inventory item
    const getResponse = await makeRequest(`${BASE_URL}/inventory`);
    if (getResponse.status !== 200 || !getResponse.data.data || getResponse.data.data.length === 0) {
      console.log('   ⚠️  Cannot test update - no inventory items available');
      return 'no_data';
    }
    
    const testItem = getResponse.data.data[0];
    const updateData = {
      name: testItem.name + ' (Updated)',
      sku: testItem.sku,
      costPrice: testItem.costPrice,
      sellingPrice: testItem.sellingPrice,
      // Don't include computed fields
    };
    
    const updateResponse = await makeRequest(`${BASE_URL}/inventory/${testItem.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    console.log(`   Status: ${updateResponse.status}`);
    
    if (updateResponse.status === 200) {
      console.log('   ✅ Inventory update working');
      return true;
    } else if (updateResponse.status === 401) {
      console.log('   ⚠️  Inventory update requires authentication');
      return 'auth_required';
    } else {
      console.log(`   ❌ Inventory update failed: ${updateResponse.data.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Inventory update error: ${error.message}`);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 COMPREHENSIVE SERVER TEST');
  console.log('============================\n');
  
  const results = {
    serverHealth: false,
    inventoryAPI: false,
    purchaseOrdersAPI: false,
    suppliersAPI: false,
    inventoryUpdate: false
  };
  
  // Run all tests
  results.serverHealth = await testServerHealth();
  results.inventoryAPI = await testInventoryAPI();
  results.purchaseOrdersAPI = await testPurchaseOrdersAPI();
  results.suppliersAPI = await testSuppliersAPI();
  results.inventoryUpdate = await testInventoryUpdate();
  
  // Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('================');
  console.log(`Server Health: ${results.serverHealth ? '✅' : '❌'}`);
  console.log(`Inventory API: ${results.inventoryAPI === true ? '✅' : results.inventoryAPI === 'auth_required' ? '⚠️' : '❌'}`);
  console.log(`Purchase Orders API: ${results.purchaseOrdersAPI === true ? '✅' : results.purchaseOrdersAPI === 'auth_required' ? '⚠️' : '❌'}`);
  console.log(`Suppliers API: ${results.suppliersAPI === true ? '✅' : results.suppliersAPI === 'auth_required' ? '⚠️' : '❌'}`);
  console.log(`Inventory Update: ${results.inventoryUpdate === true ? '✅' : results.inventoryUpdate === 'auth_required' ? '⚠️' : '❌'}`);
  
  // Overall status
  const workingAPIs = Object.values(results).filter(result => result === true).length;
  const totalAPIs = Object.keys(results).length;
  
  console.log(`\n🎯 Overall Status: ${workingAPIs}/${totalAPIs} APIs working`);
  
  if (workingAPIs === totalAPIs) {
    console.log('🎉 All tests passed! System is fully functional.');
  } else if (workingAPIs > 0) {
    console.log('⚠️  Some APIs working. Check authentication or server configuration.');
  } else {
    console.log('❌ No APIs working. Check server status and configuration.');
  }
  
  console.log('\n📝 Notes:');
  console.log('- ✅ = Working correctly');
  console.log('- ⚠️  = Requires authentication (normal for protected endpoints)');
  console.log('- ❌ = Error or not working');
}

// Run the tests
runTests().catch(console.error);
