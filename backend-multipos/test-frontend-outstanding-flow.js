const axios = require('axios');

async function testFrontendOutstandingFlow() {
  try {
    console.log('🔍 Testing Frontend Outstanding Payment Flow...\n');
    
    // Simulate the frontend API call
    const baseURL = 'http://localhost:5000'; // Adjust if your backend runs on different port
    
    console.log('1️⃣ Testing /sales/outstanding API...');
    
    try {
      const outstandingResponse = await axios.get(`${baseURL}/sales/outstanding`, {
        params: {
          customerName: 'Ahmed',
          phone: '0908090921'
        }
      });
      
      console.log('✅ Outstanding payments API response:', outstandingResponse.data);
      
      if (outstandingResponse.data.success && outstandingResponse.data.data.length > 0) {
        const customer = outstandingResponse.data.data[0];
        console.log(`📊 Found outstanding payments for ${customer.customerName}: $${customer.totalOutstanding}`);
        
        console.log('\n2️⃣ Testing /sales/clear-outstanding API...');
        
        const clearResponse = await axios.post(`${baseURL}/sales/clear-outstanding`, {
          customerName: customer.customerName,
          phone: customer.phone,
          paymentAmount: customer.totalOutstanding,
          paymentMethod: 'CASH'
        });
        
        console.log('✅ Clear outstanding API response:', clearResponse.data);
        
        if (clearResponse.data.success) {
          console.log('🎉 SUCCESS: Outstanding payments cleared!');
          console.log('📊 Processed sales:', clearResponse.data.data.processedSales);
          console.log('💰 Remaining outstanding:', clearResponse.data.data.remainingOutstanding);
          
          // Verify by checking outstanding again
          console.log('\n3️⃣ Verifying by checking outstanding payments again...');
          
          const verifyResponse = await axios.get(`${baseURL}/sales/outstanding`, {
            params: {
              customerName: 'Ahmed',
              phone: '0908090921'
            }
          });
          
          console.log('✅ Verification response:', verifyResponse.data);
          
          if (verifyResponse.data.success && verifyResponse.data.data.length === 0) {
            console.log('🎉 VERIFICATION SUCCESS: No outstanding payments found!');
          } else {
            console.log('⚠️ VERIFICATION WARNING: Outstanding payments still exist');
          }
          
        } else {
          console.log('❌ Clear outstanding API failed:', clearResponse.data.message);
        }
        
      } else {
        console.log('ℹ️ No outstanding payments found for Ahmed');
      }
      
    } catch (error) {
      console.error('❌ API Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error);
  }
}

testFrontendOutstandingFlow();
