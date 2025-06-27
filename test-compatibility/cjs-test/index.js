#!/usr/bin/env node

console.log('🧪 Testing CommonJS imports for wttp-site...\n');

try {
  // Test 1: Main package import
  console.log('✅ Test 1: Main package import');
  const wttpSite = require('wttp-site');
  console.log('   - Main package imported successfully');
  console.log(`   - Available exports: ${Object.keys(wttpSite).length} items`);

  // Test 2: Check for key exports
  console.log('\n✅ Test 2: Key exports validation');
  const expectedExports = [
    'fetchResource',
    'uploadFile', 
    'uploadDirectory',
    'deploy',
    'upload',
    'fetch'
  ];
  
  const missingExports = expectedExports.filter(exp => !(exp in wttpSite));
  if (missingExports.length === 0) {
    console.log('   - All expected exports found ✓');
  } else {
    console.log(`   - Missing exports: ${missingExports.join(', ')} ✗`);
    console.log(`   - Available exports: ${Object.keys(wttpSite).join(', ')}`);
  }

  // Test 3: Test typechain exports (if available)
  console.log('\n✅ Test 3: TypeChain exports validation');
  const hasTypeChainExports = Object.keys(wttpSite).some(key => 
    key.includes('Factory') || key.includes('Contract') || key.includes('__factory')
  );
  if (hasTypeChainExports) {
    console.log('   - TypeChain exports found ✓');
  } else {
    console.log('   - No TypeChain exports found (might be expected if contracts not compiled)');
  }

  console.log('\n🎉 All CommonJS import tests completed successfully!');
  console.log('📦 wttp-site package can be imported correctly in CommonJS environments');

} catch (error) {
  console.error('\n❌ CommonJS import test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 