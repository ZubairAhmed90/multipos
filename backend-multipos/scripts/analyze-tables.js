const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'multipos_db'
};

async function analyzeTables() {
  let connection;
  
  try {
    console.log('🔍 Analyzing database tables...');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Get all tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${dbConfig.database}' 
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log(`\n📋 Found ${tables.length} tables in database:`);
    console.log('=' .repeat(50));
    
    const dbTables = tables.map(table => table.TABLE_NAME);
    dbTables.forEach((table, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${table}`);
    });
    
    // Define expected tables based on models
    const expectedTables = [
      'users',
      'companies', 
      'branches',
      'warehouses',
      'inventory_items',
      'sales',
      'sale_items',
      'customers',
      'retailers',
      'shifts',
      'transfers',
      'billing',
      'hardware_devices',
      'hardware_sessions',
      'held_bills',
      'sales_returns',
      'credit_debit_transactions',
      'ledger',
      'branch_ledger',
      'admin_settings'
    ];
    
    console.log('\n🎯 Expected tables (based on models):');
    console.log('=' .repeat(50));
    expectedTables.forEach((table, index) => {
      const exists = dbTables.includes(table);
      const status = exists ? '✅' : '❌';
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${status} ${table}`);
    });
    
    // Find extra tables
    const extraTables = dbTables.filter(table => !expectedTables.includes(table));
    
    console.log('\n🔍 Extra/Unused tables:');
    console.log('=' .repeat(50));
    if (extraTables.length === 0) {
      console.log('✅ No extra tables found - all tables are in use!');
    } else {
      extraTables.forEach((table, index) => {
        console.log(`${(index + 1).toString().padStart(2, ' ')}. ❓ ${table}`);
      });
    }
    
    // Find missing tables
    const missingTables = expectedTables.filter(table => !dbTables.includes(table));
    
    console.log('\n⚠️  Missing tables:');
    console.log('=' .repeat(50));
    if (missingTables.length === 0) {
      console.log('✅ All expected tables exist!');
    } else {
      missingTables.forEach((table, index) => {
        console.log(`${(index + 1).toString().padStart(2, ' ')}. ❌ ${table}`);
      });
    }
    
    // Analyze table usage by checking for foreign key relationships
    console.log('\n🔗 Table relationships analysis:');
    console.log('=' .repeat(50));
    
    for (const table of dbTables) {
      try {
        const [foreignKeys] = await connection.execute(`
          SELECT 
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = '${dbConfig.database}' 
          AND TABLE_NAME = '${table}' 
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        
        if (foreignKeys.length > 0) {
          console.log(`\n📊 ${table}:`);
          foreignKeys.forEach(fk => {
            console.log(`   └─ ${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
          });
        }
      } catch (error) {
        console.log(`⚠️  Could not analyze ${table}: ${error.message}`);
      }
    }
    
    // Check table row counts
    console.log('\n📊 Table row counts:');
    console.log('=' .repeat(50));
    
    for (const table of dbTables) {
      try {
        const [count] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
        const rowCount = count[0].count;
        const status = rowCount > 0 ? '📄' : '📭';
        console.log(`${status} ${table}: ${rowCount} rows`);
      } catch (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      }
    }
    
    console.log('\n🎉 Table analysis completed!');
    
  } catch (error) {
    console.error('❌ Table analysis failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the analysis
analyzeTables().catch(console.error);
