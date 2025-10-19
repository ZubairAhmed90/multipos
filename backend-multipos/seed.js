const { pool } = require('./config/database');
const bcrypt = require('bcrypt');

async function createAdminUser() {
  try {
    console.log('🌱 Creating admin user...\n');
    
    // Step 1: Clear existing admin user
    console.log('🗑️  Clearing existing admin user...');
    await pool.execute('DELETE FROM users WHERE email = ?', ['shahjahan@multipos.com']);
    console.log('✅ Existing admin user cleared\n');
    
    // Step 2: Hash password
    const password = 'Shahjahan@123';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('🔐 Password hashed successfully\n');
    
    // Step 3: Create admin user
    console.log('👤 Creating admin user...');
    const [result] = await pool.execute(`
      INSERT INTO users (
        username,
        email,
        password,
        role,
        branch_id,
        warehouse_id,
        shift,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      'shahjahan',
      'shahjahan@multipos.com',
      hashedPassword,
      'ADMIN',
      null,
      null,
      'MORNING',
      'ACTIVE'
    ]);
    
    console.log(`✅ Admin user created successfully!`);
    console.log(`🆔 User ID: ${result.insertId}`);
    
    // Step 4: Verify user creation
    const [user] = await pool.execute(`
      SELECT 
        id,
        username,
        email,
        role,
        status,
        created_at
      FROM users 
      WHERE email = ?
    `, ['shahjahan@multipos.com']);
    
    console.log('\n📋 Admin User Details:');
    console.log('='.repeat(50));
    console.log(`ID: ${user[0].id}`);
    console.log(`Username: ${user[0].username}`);
    console.log(`Email: ${user[0].email}`);
    console.log(`Role: ${user[0].role}`);
    console.log(`Status: ${user[0].status}`);
    console.log(`Created: ${user[0].created_at}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log('-'.repeat(30));
    console.log(`📧 Email: shahjahan@multipos.com`);
    console.log(`🔑 Password: Shahjahan@123`);
    console.log(`👤 Role: ADMIN`);
    
    console.log('\n🎉 Admin user created successfully!');
    console.log('🚀 You can now login with the credentials above');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createAdminUser();