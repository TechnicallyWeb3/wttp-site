#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Comprehensive Import Compatibility Tests for wttp-site\n');

const tests = [
  {
    name: 'CommonJS Basic Tests',
    directory: 'cjs-test',
    command: 'npm',
    args: ['test'],
    description: 'Basic CommonJS require() imports for wttp-site'
  },
  {
    name: 'CommonJS Advanced Tests', 
    directory: 'cjs-test',
    command: 'npm',
    args: ['run', 'test:imports'],
    description: 'Advanced CommonJS functionality tests including subpath imports'
  },
  {
    name: 'ESM Basic Tests',
    directory: 'esm-test', 
    command: 'npm',
    args: ['test'],
    description: 'Basic ES Module import syntax for wttp-site'
  },
  {
    name: 'ESM Advanced Tests',
    directory: 'esm-test',
    command: 'npm', 
    args: ['run', 'test:imports'],
    description: 'Advanced ESM functionality tests including dynamic imports'
  }
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n📦 Running: ${test.name}`);
    console.log(`📁 Directory: ${test.directory}`);
    console.log(`📝 Description: ${test.description}`);
    console.log('─'.repeat(60));

    const testDir = path.join(__dirname, test.directory);
    
    const child = spawn(test.command, test.args, {
      cwd: testDir,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} - PASSED`);
        resolve({ test: test.name, status: 'PASSED', code });
      } else {
        console.log(`❌ ${test.name} - FAILED (exit code: ${code})`);
        reject(new Error(`${test.name} failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.log(`❌ ${test.name} - ERROR: ${err.message}`);
      reject(err);
    });
  });
}

async function installDependencies() {
  console.log('📦 Installing test dependencies...\n');
  
  const directories = ['cjs-test', 'esm-test'];
  
  for (const dir of directories) {
    const testDir = path.join(__dirname, dir);
    console.log(`Installing dependencies in ${dir}...`);
    
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], {
        cwd: testDir,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Dependencies installed in ${dir}`);
          resolve();
        } else {
          reject(new Error(`Failed to install dependencies in ${dir}`));
        }
      });

      child.on('error', reject);
    });
  }
  
  console.log('\n✅ All dependencies installed successfully!\n');
}

async function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...\n');
  
  // Check if the main package is built
  const fs = require('fs');
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.log('⚠️  WARNING: dist/ directory not found');
    console.log('   Please run "npm run build" in the main project before testing');
    console.log('   This ensures all CommonJS and ESM builds are available for testing\n');
    
    // Ask if we should continue anyway
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question('Continue anyway? (y/N): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Tests cancelled. Please build the package first.');
          process.exit(1);
        }
        resolve();
      });
    });
  } else {
    console.log('✅ dist/ directory found');
    
    // Check for both CJS and ESM builds
    const cjsPath = path.join(distPath, 'cjs');
    const esmPath = path.join(distPath, 'esm');
    const typesPath = path.join(distPath, 'types');
    
    if (fs.existsSync(cjsPath)) {
      console.log('✅ CommonJS build found');
    } else {
      console.log('⚠️  CommonJS build not found');
    }
    
    if (fs.existsSync(esmPath)) {
      console.log('✅ ESM build found');
    } else {
      console.log('⚠️  ESM build not found');
    }
    
    if (fs.existsSync(typesPath)) {
      console.log('✅ TypeScript declarations found');
    } else {
      console.log('⚠️  TypeScript declarations not found');
    }
    
    console.log('');
  }
}

async function main() {
  const startTime = Date.now();
  const results = [];
  
  try {
    await checkPrerequisites();
    await installDependencies();
    
    for (const test of tests) {
      try {
        const result = await runTest(test);
        results.push(result);
      } catch (error) {
        results.push({ 
          test: test.name, 
          status: 'FAILED', 
          error: error.message 
        });
        // Continue with other tests even if one fails
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 WTTP-SITE COMPATIBILITY TEST SUMMARY');
    console.log('='.repeat(70));
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    
    console.log(`⏱️  Total Duration: ${duration}s`);
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    
    // Detailed results
    console.log('\nDetailed Results:');
    results.forEach(result => {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`  ${status} ${result.test}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('📦 wttp-site package is fully compatible with both CommonJS and ES Module environments');
      console.log('🔧 All subpath exports and contract imports are working correctly');
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      console.log('💡 Check the test output above for specific error details');
      console.log('🔧 Common issues:');
      console.log('   - Missing build artifacts (run "npm run build")');
      console.log('   - Incorrect export paths in package.json');
      console.log('   - TypeScript compilation errors');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test runner failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle process interruption gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test runner interrupted by user');
  console.log('🧹 Cleaning up...');
  process.exit(130);
});

main(); 