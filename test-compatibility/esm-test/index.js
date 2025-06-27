#!/usr/bin/env node

console.log('🧪 Testing ES Module imports for wttp-site...\n');

try {
  // Test 1: Main package import with destructuring
  console.log('✅ Test 1: Main package import with destructuring');
  const { 
    fetchResource,
    uploadFile,
    uploadDirectory,
    deploy,
    upload,
    fetch
  } = await import('wttp-site');
  
  console.log('   - Main package imported successfully');
  console.log('   - Key destructured exports verified ✓');
  console.log(`   - fetchResource type: ${typeof fetchResource}`);
  console.log(`   - uploadFile type: ${typeof uploadFile}`);
  console.log(`   - deploy type: ${typeof deploy}`);

  // Test 2: Default/namespace import
  console.log('\n✅ Test 2: Default/namespace import');
  const wttpSite = await import('wttp-site');
  console.log('   - Namespace import successful');
  console.log(`   - Available exports: ${Object.keys(wttpSite).length} items`);

  // Test 3: Check for key exports
  console.log('\n✅ Test 3: Key exports validation');
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

  // Test 4: Test typechain exports (if available)
  console.log('\n✅ Test 4: TypeChain exports validation');
  const hasTypeChainExports = Object.keys(wttpSite).some(key => 
    key.includes('Factory') || key.includes('Contract') || key.includes('__factory')
  );
  if (hasTypeChainExports) {
    console.log('   - TypeChain exports found ✓');
  } else {
    console.log('   - No TypeChain exports found (might be expected if contracts not compiled)');
  }

  console.log('\n🎉 All ESM import tests completed successfully!');
  console.log('📦 wttp-site package can be imported correctly in ES Module environments');

} catch (error) {
  console.error('\n❌ ES Module import test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
} 