#!/bin/bash

echo "🔄 Database Reset Script"
echo "======================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the backend-multipos directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: multipos/backend-multipos/"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if scripts directory exists
if [ ! -d "scripts" ]; then
    echo "📁 Creating scripts directory..."
    mkdir -p scripts
    echo ""
fi

echo "🚀 Running database reset..."
echo ""

# Run the reset script
node scripts/reset-database.js

echo ""
echo "✅ Database reset script completed!"
echo ""
echo "🔑 You can now login with:"
echo "   Email: shahjahan@multipos.com"
echo "   Password: Shahjahan@123"
echo "   Role: ADMIN"
