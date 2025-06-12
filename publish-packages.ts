/**
 * Publish ESP Packages Script
 * 
 * Publishes the package under two names:
 * 1. ethereum-storage (public package)
 * 2. @tw3/esp (organization scoped package)
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

interface PublishOptions {
  dryRun?: boolean;
  tag?: string;
  access?: 'public' | 'restricted';
}

function publishPackage(
  packageName: string, 
  packageJsonPath: string, 
  options: PublishOptions = {}
): void {
  console.log(`\n🚀 Publishing ${packageName}...`);
  
  // Read the package config for this publication
  const packageConfig = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Build the publish command
  let publishCmd = 'npm publish';
  
  if (options.dryRun) {
    publishCmd += ' --dry-run';
  }
  
  if (options.tag) {
    publishCmd += ` --tag ${options.tag}`;
  }
  
  if (options.access) {
    publishCmd += ` --access ${options.access}`;
  }
  
  // If this is not the main package.json, we need to temporarily swap it
  const mainPackageJson = 'package.json';
  let originalContent: string | null = null;
  
  if (packageJsonPath !== mainPackageJson) {
    // Backup original package.json content
    originalContent = fs.readFileSync(mainPackageJson, 'utf8');
    
    // Temporarily replace with the target package config
    fs.writeFileSync(mainPackageJson, JSON.stringify(packageConfig, null, 2) + '\n');
  }
  
  try {
    console.log(`Executing: ${publishCmd}`);
    
    // Execute publish command
    execSync(publishCmd, { stdio: 'inherit' });
    
    console.log(`✅ Successfully published ${packageName}`);
    
  } catch (error) {
    console.error(`❌ Failed to publish ${packageName}:`, error);
    throw error;
  } finally {
    // Restore original package.json if we modified it
    if (originalContent && packageJsonPath !== mainPackageJson) {
      fs.writeFileSync(mainPackageJson, originalContent);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1];
  
  console.log('🏗️  Building packages...');
  
  // Ensure build is up to date
  execSync('npm run build', { stdio: 'inherit' });
  
  const options: PublishOptions = {
    dryRun,
    tag,
    access: 'public'
  };
  
  // IMPORTANT: Always backup the original package.json at the start
  const originalPackageJson = fs.readFileSync('package.json', 'utf8');
  
  try {
    // Publish public package (uses current package.json)
    publishPackage('wttp-site', 'package.json', options);
    
    // Publish organization scoped package (temporarily swaps package.json)
    publishPackage('@wttp/site', 'package.wttp.json', options);
    
    console.log('\n🎉 All packages published successfully!');
    
    if (!dryRun) {
      console.log('\n📋 Installation commands:');
      console.log('npm install wttp-site');
      console.log('npm install @wttp/site');
    }
    
  } catch (error) {
    console.error('\n💥 Publishing failed:', error);
    // Ensure we restore package.json even on error
    fs.writeFileSync('package.json', originalPackageJson);
    process.exit(1);
  } finally {
    // Final safety restore - ensure package.json is always restored
    fs.writeFileSync('package.json', originalPackageJson);
  }
}

// Handle command line execution
if (require.main === module) {
  main();
}

export { publishPackage, PublishOptions }; 