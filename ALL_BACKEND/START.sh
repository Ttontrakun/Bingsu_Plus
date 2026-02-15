#!/bin/bash
echo "🚀 Starting ALL_BACKEND..."
echo ""
echo "Step 1: Installing dependencies..."
npm install || {
  echo "⚠️  npm install failed. Trying to use existing node_modules..."
  if [ -d "../Backend/askaa_backend/node_modules" ]; then
    ln -sf ../Backend/askaa_backend/node_modules node_modules
    echo "✅ Using symlink to existing node_modules"
  else
    echo "❌ No node_modules found. Please run 'npm install' manually."
    exit 1
  fi
}

echo ""
echo "Step 2: Generating Prisma client..."
npx prisma generate --schema=infrastructure/prisma/schema.prisma || echo "⚠️  Prisma generate failed"

echo ""
echo "Step 3: Starting server..."
node main.js
