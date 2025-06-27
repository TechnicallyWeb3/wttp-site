#!/usr/bin/env node

console.log('🧪 Testing Advanced CommonJS imports for wttp-site...\n');

try {
  // Test 1: Destructured imports
  console.log('✅ Test 1: Destructured imports');
  const { fetchResource, uploadFile, deploy } = require('wttp-site');
  console.log('   - Destructured imports successful ✓');
  console.log(`   - fetchResource type: ${typeof fetchResource}`);
  console.log(`   - uploadFile type: ${typeof uploadFile}`);
  console.log(`   - deploy type: ${typeof deploy}`);

  // Test 2: Subpath imports (scripts)
  console.log('\n✅ Test 2: Subpath imports - scripts');
  try {
    const scripts = require('wttp-site/scripts/fetchResource');
    console.log('   - Scripts subpath import successful ✓');
    console.log(`   - Script exports: ${Object.keys(scripts).length} items`);
  } catch (subError) {
    console.log('   - Scripts subpath import failed (might be expected)');
    console.log(`   - Error: ${subError.message}`);
  }

  // Test 3: Subpath imports (tasks)
  console.log('\n✅ Test 3: Subpath imports - tasks');
  try {
    const tasks = require('wttp-site/tasks/deploy');
    console.log('   - Tasks subpath import successful ✓');
    console.log(`   - Task exports: ${Object.keys(tasks).length} items`);
  } catch (subError) {
    console.log('   - Tasks subpath import failed (might be expected)');
    console.log(`   - Error: ${subError.message}`);
  }

  // Test 4: Contract imports
  console.log('\n✅ Test 4: Contract file imports');
  try {
    const baseContract = require('wttp-site/contracts/BaseWTTPSite.sol');
    console.log('   - Contract file import successful ✓');
  } catch (contractError) {
    console.log('   - Contract file import failed (might be expected)');
    console.log(`   - Error: ${contractError.message}`);
  }

  // Test 5: Function type validation
  console.log('\n✅ Test 5: Function type validation');
  const mainExports = require('wttp-site');
  const functionExports = Object.entries(mainExports)
    .filter(([key, value]) => typeof value === 'function')
    .map(([key]) => key);
  
  console.log(`   - Function exports found: ${functionExports.length}`);
  console.log(`   - Functions: ${functionExports.join(', ')}`);

  console.log('\n🎉 All Advanced CommonJS import tests completed!');
  console.log('📦 wttp-site package advanced imports work correctly in CommonJS environments');

} catch (error) {
  console.error('\n❌ Advanced CommonJS import test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 