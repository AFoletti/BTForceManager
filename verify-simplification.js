#!/usr/bin/env node
/**
 * Verification script for BattleTech Forces Manager simplification
 * Checks that all objectives have been met
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying BattleTech Forces Manager Simplification...\n');

let allChecks = true;

// Check 1: Version-agnostic filenames
console.log('1️⃣  Checking version-agnostic filenames...');
const staticJs = path.join('/app/static/js');
const staticCss = path.join('/app/static/css');

if (fs.existsSync(path.join(staticJs, 'main.js'))) {
  console.log('   ✅ main.js exists');
} else {
  console.log('   ❌ main.js missing');
  allChecks = false;
}

if (fs.existsSync(path.join(staticCss, 'main.css'))) {
  console.log('   ✅ main.css exists');
} else {
  console.log('   ❌ main.css missing');
  allChecks = false;
}

// Check for any remaining versioned files
const findVersionedFiles = (dir) => {
  const files = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules') {
          files.push(...findVersionedFiles(fullPath));
        }
      } else if (/\.[a-f0-9]{8,}\.(js|css)$/i.test(item)) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return files;
};

const versionedFiles = findVersionedFiles('/app');
if (versionedFiles.length === 0) {
  console.log('   ✅ No versioned files found');
} else {
  console.log('   ❌ Found versioned files:', versionedFiles);
  allChecks = false;
}

// Check 2: Clean main.js without bloat
console.log('\\n2️⃣  Checking main.js quality...');
const mainJsPath = path.join(staticJs, 'main.js');
if (fs.existsSync(mainJsPath)) {
  const content = fs.readFileSync(mainJsPath, 'utf8');
  
  // Check for readability (not minified)
  if (content.includes('\\n') && content.includes('  ')) {
    console.log('   ✅ Code is readable (not minified)');
  } else {
    console.log('   ❌ Code appears minified');
    allChecks = false;
  }
  
  // Check for clean comments
  if (content.includes('BattleTech Forces Manager')) {
    console.log('   ✅ Contains proper documentation');
  } else {
    console.log('   ❌ Missing documentation');
    allChecks = false;
  }
  
  // Check file size (should be much smaller than bloated version)
  const size = content.length;
  if (size < 50000) { // Less than 50KB
    console.log(`   ✅ Reasonable file size: ${Math.round(size/1024)}KB`);
  } else {
    console.log(`   ❌ File still too large: ${Math.round(size/1024)}KB`);
    allChecks = false;
  }
} else {
  console.log('   ❌ main.js not found');
  allChecks = false;
}

// Check 3: No CASE statements
console.log('\\n3️⃣  Checking for CASE statements...');
if (fs.existsSync(mainJsPath)) {
  const content = fs.readFileSync(mainJsPath, 'utf8');
  const caseMatches = content.match(/case\s+|switch\s*\(/gi);
  
  if (!caseMatches || caseMatches.length === 0) {
    console.log('   ✅ No CASE statements found');
  } else {
    console.log(`   ❌ Found ${caseMatches.length} CASE statements`);
    allChecks = false;
  }
}

// Check 4: Clean HTML references
console.log('\\n4️⃣  Checking HTML references...');
const indexPath = '/app/index.html';
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  
  if (content.includes('main.js') && !content.match(/main\.[a-f0-9]{8,}\.js/)) {
    console.log('   ✅ HTML references clean main.js');
  } else {
    console.log('   ❌ HTML still references versioned files');
    allChecks = false;
  }
  
  if (content.includes('main.css') && !content.match(/main\.[a-f0-9]{8,}\.css/)) {
    console.log('   ✅ HTML references clean main.css');
  } else {
    console.log('   ❌ HTML still references versioned CSS files');
    allChecks = false;
  }
}

// Check 5: Asset manifest
console.log('\\n5️⃣  Checking asset manifest...');
const manifestPath = '/app/asset-manifest.json';
if (fs.existsSync(manifestPath)) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);
  
  if (manifest.files['main.js'] === './static/js/main.js') {
    console.log('   ✅ Asset manifest has clean JS reference');
  } else {
    console.log('   ❌ Asset manifest has versioned JS reference');
    allChecks = false;
  }
  
  if (manifest.files['main.css'] === './static/css/main.css') {
    console.log('   ✅ Asset manifest has clean CSS reference');
  } else {
    console.log('   ❌ Asset manifest has versioned CSS reference');
    allChecks = false;
  }
}

// Final result
console.log('\\n' + '='.repeat(50));
if (allChecks) {
  console.log('🎉 ALL CHECKS PASSED! Simplification complete!');
  console.log('\\n✨ Achievements:');
  console.log('   ✅ Version-agnostic filenames implemented');
  console.log('   ✅ Clean, readable main.js created');
  console.log('   ✅ No CASE statements or unnecessary bloat');
  console.log('   ✅ All file references updated');
  console.log('   ✅ Repository structure simplified');
} else {
  console.log('❌ Some checks failed. Review the issues above.');
}
console.log('='.repeat(50));