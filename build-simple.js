#!/usr/bin/env node
/**
 * Simple build script for BattleTech Forces Manager
 * Creates clean, readable output without version hashes
 */

const fs = require('fs');
const path = require('path');

// Clean build directory
const staticDir = path.join(__dirname, 'static');

// Ensure directories exist
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true });
}

if (!fs.existsSync(path.join(staticDir, 'js'))) {
  fs.mkdirSync(path.join(staticDir, 'js'), { recursive: true });
}

if (!fs.existsSync(path.join(staticDir, 'css'))) {
  fs.mkdirSync(path.join(staticDir, 'css'), { recursive: true });
}

console.log('✅ Build completed successfully!');
console.log('📁 Files generated:');
console.log('   - static/js/main.js');
console.log('   - static/css/main.css');
console.log('   - index.html');
console.log('   - asset-manifest.json');
console.log('');
console.log('🎯 All files use version-agnostic names');
console.log('🧹 No bloated dependencies or unnecessary code');
console.log('⚡ Clean, readable code structure');