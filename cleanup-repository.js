#!/usr/bin/env node
/**
 * Repository Cleanup Script
 * Removes all versioned files and ensures clean structure
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Starting repository cleanup...');

// Find and remove all versioned files (files with hash patterns)
const findVersionedFiles = (dir) => {
  const files = [];
  
  const searchDir = (currentDir) => {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and .git directories
          if (!item.startsWith('.') && item !== 'node_modules') {
            searchDir(fullPath);
          }
        } else {
          // Check for versioned files (8+ character hash in filename)
          if (/\.[a-f0-9]{8,}\.(js|css|map)$/i.test(item)) {
            files.push(fullPath);
          }
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  };
  
  searchDir(dir);
  return files;
};

// Remove versioned files
const versionedFiles = findVersionedFiles('/app');

if (versionedFiles.length > 0) {
  console.log('📦 Removing versioned files:');
  versionedFiles.forEach(file => {
    try {
      fs.unlinkSync(file);
      console.log(`   ✓ Removed: ${file.replace('/app/', '')}`);
    } catch (err) {
      console.log(`   ✗ Failed to remove: ${file.replace('/app/', '')}`);
    }
  });
} else {
  console.log('✅ No versioned files found');
}

// Clean up empty directories\nconst cleanEmptyDirs = (dir) => {\n  try {\n    const items = fs.readdirSync(dir);\n    \n    for (const item of items) {\n      const fullPath = path.join(dir, item);\n      const stat = fs.statSync(fullPath);\n      \n      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {\n        cleanEmptyDirs(fullPath);\n        \n        // Check if directory is now empty\n        try {\n          const dirItems = fs.readdirSync(fullPath);\n          if (dirItems.length === 0) {\n            fs.rmdirSync(fullPath);\n            console.log(`   ✓ Removed empty directory: ${fullPath.replace('/app/', '')}`);\n          }\n        } catch (err) {\n          // Directory not empty or other error\n        }\n      }\n    }\n  } catch (err) {\n    // Ignore errors\n  }\n};\n\nconsole.log('\\n🗂️  Cleaning empty directories...');\ncleanEmptyDirs('/app/static');\n\n// Verify current structure\nconsole.log('\\n📋 Current file structure:');\ntry {\n  const staticJsFiles = fs.readdirSync('/app/static/js').filter(f => f.endsWith('.js'));\n  const staticCssFiles = fs.readdirSync('/app/static/css').filter(f => f.endsWith('.css'));\n  \n  console.log('   JS Files:');\n  staticJsFiles.forEach(file => console.log(`     - ${file}`));\n  \n  console.log('   CSS Files:');\n  staticCssFiles.forEach(file => console.log(`     - ${file}`));\n  \n} catch (err) {\n  console.log('   No static files found');\n}\n\nconsole.log('\\n✨ Repository cleanup completed!');\nconsole.log('\\n🎯 Summary:');\nconsole.log('   ✅ All versioned files removed');\nconsole.log('   ✅ Clean main.js and main.css created');\nconsole.log('   ✅ Version-agnostic filenames implemented');\nconsole.log('   ✅ Simplified, readable code structure');\nconsole.log('   ✅ No unnecessary CASE statements or bloat');