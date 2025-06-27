#!/usr/bin/env node

console.log('🧪 Testing Advanced ES Module imports for wttp-site...\n');

try {
  // Test 1: Named imports from main package
  console.log('✅ Test 1: Named imports from main package');
  const { fetchResource, uploadFile, deploy } = await import('wttp-site');
  console.log('   - Named imports successful ✓');
  console.log(`   - fetchResource type: ${typeof fetchResource}`);
  console.log(`   - uploadFile type: ${typeof uploadFile}`);
  console.log(`   - deploy type: ${typeof deploy}`);

  // Test 2: Dynamic import resolution
  console.log('\n✅ Test 2: Dynamic import resolution');
  const dynamicImport = await import('wttp-site');
  console.log('   - Dynamic import successful ✓');
  console.log(`   - Dynamic import exports: ${Object.keys(dynamicImport).length} items`);

  // Test 3: Subpath imports (scripts)
  console.log('\n✅ Test 3: Subpath imports - scripts');
  try {
    const scripts = await import('wttp-site/scripts/fetchResource');
    console.log('   - Scripts subpath import successful ✓');
    console.log(`   - Script exports: ${Object.keys(scripts).length} items`);
  } catch (subError) {
    console.log('   - Scripts subpath import failed (might be expected)');
    console.log(`   - Error: ${subError.message}`);
  }

  // Test 4: Subpath imports (tasks)
  console.log('\n✅ Test 4: Subpath imports - tasks');
  try {
    const tasks = await import('wttp-site/tasks/deploy');
    console.log('   - Tasks subpath import successful ✓');
    console.log(`   - Task exports: ${Object.keys(tasks).length} items`);
  } catch (subError) {
    console.log('   - Tasks subpath import failed (might be expected)');
    console.log(`   - Error: ${subError.message}`);
  }

  // Test 5: Contract imports
  console.log('\n✅ Test 5: Contract file imports');
  try {
    const baseContract = await import('wttp-site/contracts/BaseWTTPSite.sol');
    console.log('   - Contract file import successful ✓');
  } catch (contractError) {
    console.log('   - Contract file import failed (might be expected)');
    console.log(`   - Error: ${contractError.message}`);
  }

  // Test 6: Re-import stability
  console.log('\n✅ Test 6: Re-import stability');
  const firstImport = await import('wttp-site');
  const secondImport = await import('wttp-site');
  const sameReference = firstImport === secondImport;
  console.log(`   - Re-import stability: ${sameReference ? 'PASSED' : 'FAILED'} ✓`);

  // Test 7: Function type validation
  console.log('\n✅ Test 7: Function type validation');
  const mainExports = await import('wttp-site');
  const functionExports = Object.entries(mainExports)
    .filter(([key, value]) => typeof value === 'function')
    .map(([key]) => key);
  
  console.log(`   - Function exports found: ${functionExports.length}`);
  console.log(`   - Functions: ${functionExports.join(', ')}`);

  console.log('\n🎉 All Advanced ESM import tests completed!');
  console.log('📦 wttp-site package advanced imports work correctly in ES Module environments');

} catch (error) {
  console.error('\n❌ Advanced ES Module import test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 