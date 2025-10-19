const axios = require('axios');

async function testFrontendAPICall() {
  try {
    console.log('🔍 Testing Frontend API Call...\n');
    
    // Test the exact API call that the frontend makes
    const baseURL = 'http://localhost:5000/api'; // Adjust if your backend runs on different port
    const api = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📤 Making API call to /sales/outstanding...');
    
    // Test with Ahmed's phone number
    const response = await api.get('/sales/outstanding?phone=0908090921');
    
    console.log('📥 API Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data.length > 0) {
      console.log('\n✅ API call successful - Frontend should be able to get this data');
      console.log('🔧 If POS still shows "No outstanding payments", check:');
      console.log('   1. Frontend is making the API call');
      console.log('   2. Browser console for errors');
      console.log('   3. Network tab to see if API call is being made');
      console.log('   4. CORS issues');
    } else {
      console.log('\n❌ API call returned no data - this explains the issue');
    }
    
  } catch (error) {
    console.error('❌ Error making API call:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 DIAGNOSIS: Backend server is not running or not accessible');
      console.log('💡 SOLUTION: Start the backend server with: npm start');
    } else if (error.response) {
      console.log('\n🔧 DIAGNOSIS: API returned error:', error.response.status);
      console.log('💡 SOLUTION: Check backend server logs for errors');
    } else {
      console.log('\n🔧 DIAGNOSIS: Network or configuration issue');
      console.log('💡 SOLUTION: Check API base URL and network connectivity');
    }
  }
}

testFrontendAPICall();
