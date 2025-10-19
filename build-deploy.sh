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
    
    # Copy built files to root
    echo "📁 Copying files to root directory..."
    cd ..
    cp frontend/build/index.html ./index.html
    rm -rf ./static
    cp -r frontend/build/static ./static
    
    # Copy data folder
    mkdir -p ./data
    cp frontend/public/data/forces.json ./data/forces.json
    
    # Ensure .nojekyll exists
    touch .nojekyll
    
    echo ""
    echo "✅ Deployment files ready in root directory!"
    echo ""
    echo "📁 Files:"
    echo "   - index.html"
    echo "   - static/ (CSS & JS)"
    echo "   - data/forces.json (Your force data)"
    echo "   - .nojekyll"
    echo ""
    echo "📝 To update your forces data:"
    echo "   1. Edit data/forces.json directly"
    echo "   2. Or use the app's Export button and replace data/forces.json"
    echo "   3. Commit: git add data/forces.json && git commit -m 'Update forces'"
    echo "   4. Push: git push"
    echo ""
    echo "🌐 To deploy to GitHub Pages:"
    echo "   1. git add ."
    echo "   2. git commit -m 'Deploy BattleTech Forces Manager'"
    echo "   3. git push origin main"
    echo "   4. Enable GitHub Pages: Settings → Pages → main branch, / (root)"
    echo ""
    echo "📝 Your app will be live at:"
    echo "   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi
