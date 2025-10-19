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
    cp -r frontend/build/static ./static
    
    # Ensure .nojekyll exists
    touch .nojekyll
    
    echo ""
    echo "✅ Deployment files ready in root directory!"
    echo ""
    echo "📁 Files:"
    echo "   - index.html"
    echo "   - static/"
    echo "   - .nojekyll"
    echo ""
    echo "🌐 To deploy to GitHub Pages:"
    echo "   1. git add ."
    echo "   2. git commit -m 'Deploy to GitHub Pages'"
    echo "   3. git push origin main"
    echo "   4. Enable GitHub Pages in repo Settings → Pages"
    echo "   5. Select branch 'main' and folder '/ (root)'"
    echo ""
    echo "📝 Your app will be live at:"
    echo "   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"
else
    echo "❌ Build failed. Check errors above."
    exit 1
fi
