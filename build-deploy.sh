#!/bin/bash

# BattleTech Forces Manager - Build and Deploy Script

echo "🚀 Building BattleTech Forces Manager..."

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
fi

# Build the production app
echo "🔨 Building production bundle..."
yarn build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📁 Production files are in: frontend/build/"
    echo ""
    echo "🌐 To deploy to GitHub Pages:"
    echo "   1. Push this repository to GitHub"
    echo "   2. Go to Settings → Pages"
    echo "   3. Select 'Deploy from a branch'"
    echo "   4. Choose 'gh-pages' branch"
    echo "   5. Or manually copy build/ contents to gh-pages branch"
    echo ""
    echo "📝 See DEPLOYMENT.md for detailed instructions"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi
