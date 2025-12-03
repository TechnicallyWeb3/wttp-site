import { task, types } from "hardhat/config";
import fs from "fs";
import crypto from "crypto";

// Hardcoded contract fallback for estimation to test change to a contract you have permission to write to
const DEFAULT_ESTIMATION_SITE = "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E";

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

// Helper function to generate a random URL-safe string for destination path
function generateRandomDestinationPath(): string {
  // Generate 16 random bytes and convert to base64url (URL-safe base64)
  const randomBytes = crypto.randomBytes(16);
  // Use base64url encoding which is URL-safe (no + or / characters, uses - and _ instead)
  const randomString = randomBytes.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
  
  return `/${randomString}`;
}

task("site:estimate", "Estimate gas costs for uploading a file or directory to a WTTP site")
  .addParam("source", "The source file or directory path")
  .addOptionalParam("site", "The address of the WTTP site (uses default empty contract if not provided)")
  .addOptionalParam("destination", "The destination path on the WTTP site (auto-generated from source if not provided)")
  .addOptionalParam("gasprice", "Custom gas price in gwei (otherwise uses current price multiplied by rate)", undefined, types.int)
  .addOptionalParam("rate", "Multiplier rate for current gas price (default: 2, accepts decimals like 1.5)", 2, types.float)
  .addOptionalParam("min", "Minimum gas price in gwei (default: 150)", 150, types.float)
  .addOptionalParam("nodefaults", "Disable default ignore patterns", false, types.boolean)
  .setAction(async (taskArgs, hre) => {
    const { site, source, destination, gasprice, rate, min, nodefaults } = taskArgs;
    
    // Use default site if not provided
    const siteAddress = site || DEFAULT_ESTIMATION_SITE;
    if (!site) {
      console.log(`📋 Using default estimation site: ${siteAddress} (empty contract for testing)`);
    } else {
      console.log(`📋 Using site: ${siteAddress}`);
    }
    
    // Generate random destination path if not provided to avoid conflicts
    const destPath = destination || generateRandomDestinationPath();
    if (!destination) {
      console.log(`📋 Using random destination path: ${destPath} (to avoid conflicts)`);
    }
    
    // Connect to the WTTP site
    const wtppSite = await hre.ethers.getContractAt("Web3Site", siteAddress);
    
    // Validate that this is a valid WTTP site by testing DPS/DPR calls
    try {
      const dprAddress = await wtppSite.DPR();
      console.log(`📋 DPR address: ${dprAddress}`);
      const dpsAddress = await wtppSite.DPS();
      console.log(`📋 DPS address: ${dpsAddress}`);
    } catch (error) {
      throw new Error("Not a WTTPSite");
    }
    
    // Check if source is a file or directory
    if (isDirectory(source)) {
      console.log(`Source ${source} is a directory, estimating directory upload...`);
      // Import the directory estimation function
      const { estimateDirectory } = require("../scripts/uploadDirectory");
      
      // Configure ignore options
      const ignoreOptions = {
        includeDefaults: !nodefaults
      };
      
      // Estimate the directory
      const result = await estimateDirectory(wtppSite, source, destPath, gasprice, ignoreOptions, parseFloat(rate), parseFloat(min));
      
      // Get currency symbol
      const { getChainSymbol } = require("../scripts/uploadFile");
      const currencySymbol = await getChainSymbol();
      
      console.log(`\n✅ Estimation complete!`);
      console.log(`   Total cost: ${hre.ethers.formatEther(result.totalCost)} ${currencySymbol}`);
      console.log(`   Total gas: ${result.totalGas.toString()}`);
      console.log(`   Total royalty: ${hre.ethers.formatEther(result.totalRoyaltyCost)} ${currencySymbol}`);
    } else {
      console.log(`Source ${source} is a file, estimating file upload...`);
      // Import the file estimation function
      const { estimateFile } = require("../scripts/uploadFile");
      
      // Estimate the file
      const result = await estimateFile(wtppSite, source, destPath, gasprice, parseFloat(rate), parseFloat(min));
      
      // Get currency symbol
      const { getChainSymbol } = require("../scripts/uploadFile");
      const currencySymbol = await getChainSymbol();
      
      console.log(`\n✅ Estimation complete!`);
      console.log(`   Total cost: ${hre.ethers.formatEther(result.totalCost)} ${currencySymbol}`);
      console.log(`   Total gas: ${result.totalGas.toString()}`);
      console.log(`   Total royalty: ${hre.ethers.formatEther(result.royaltyCost)} ${currencySymbol}`);
    }
  });

export default {};

