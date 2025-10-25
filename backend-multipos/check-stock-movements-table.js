const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'petzonep',
  password: 'Petzone@123',
  database: 'petzonep_software',
  port: 3306
};

async function checkStockMovementsTable() {
  let connection;
  
  try {
    console.log('🔍 Checking stock_movements table structure...\n');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Check if stock_movements table exists
    console.log('\n📊 Checking if stock_movements table exists:');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'petzonep_software' 
      AND TABLE_NAME = 'stock_movements'
    `);
    
    if (tables.length === 0) {
      console.log('❌ stock_movements table does not exist!');
      return;
    }
    
    console.log('✅ stock_movements table exists');
    
    // Check table structure
    console.log('\n📊 Checking stock_movements table structure:');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'petzonep_software' 
      AND TABLE_NAME = 'stock_movements'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('Columns in stock_movements:');
    columns.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if required columns exist
    const requiredColumns = ['inventory_item_id', 'movement_type', 'quantity'];
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    console.log('\n📊 Checking required columns:');
    requiredColumns.forEach(col => {
      if (existingColumns.includes(col)) {
        console.log(`  ✅ ${col} exists`);
      } else {
        console.log(`  ❌ ${col} missing`);
      }
    });
    
    // Check sample data
    console.log('\n📊 Checking sample data:');
    const [sampleData] = await connection.execute(`
      SELECT * FROM stock_movements LIMIT 3
    `);
    
    console.log(`Found ${sampleData.length} sample records:`);
    sampleData.forEach((record, index) => {
      console.log(`  Record ${index + 1}:`, record);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

checkStockMovementsTable();
