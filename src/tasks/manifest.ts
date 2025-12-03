import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";

task("site:manifest", "Generate a manifest file for a WTTP site directory")
  .addParam("source", "The source directory path")
  .addOptionalParam("site", "The address of the WTTP site (optional - for cost estimates)")
  .addOptionalParam("testconfig", "Path to test config JSON file with site/network (optional)", undefined, types.string)
  .addOptionalParam("destination", "The destination path on the WTTP site (default: /)")
  .addOptionalParam("output", "Output path for manifest file (default: source/wttp.manifest.json)")
  .addOptionalParam("gaslimit", "Maximum gas price in gwei (stored in manifest config)", undefined, types.float)
  .addOptionalParam("filelimit", "Maximum file size in MB (stored in manifest config)", undefined, types.float)
  .addOptionalParam("nodefaults", "Disable default ignore patterns", false, types.boolean)
  .addOptionalParam("ignorepattern", "Custom ignore pattern file path or 'none'", undefined, types.string)
  .addOptionalParam("externalrules", "JSON file path containing external storage rules", undefined, types.string)
  .addOptionalParam("update", "Path to existing manifest to update", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const { 
      source, 
      site, 
      testconfig,
      destination, 
      output, 
      gaslimit, 
      filelimit, 
      nodefaults, 
      ignorepattern,
      externalrules,
      update
    } = taskArgs;

    // Import the manifest generation functions
    const { generateManifest, saveManifest, loadManifest, loadTestConfig } = require("../scripts/generateManifest");

    // Validate source path
    if (!fs.existsSync(source)) {
      throw new Error(`Source directory does not exist: ${source}`);
    }

    // Load test config if provided, or check for default file
    let testConfigData: any = null;
    const testConfigPath = testconfig || "./wttp-test-config.json";
    
    if (fs.existsSync(testConfigPath)) {
      testConfigData = loadTestConfig(testConfigPath, hre.network.name);
      if (testConfigData) {
        console.log(`📋 Loaded test config for network: ${hre.network.name}`);
      }
    } else if (testconfig) {
      // Only error if user explicitly specified a config that doesn't exist
      throw new Error(`Test config file not found: ${testconfig}`);
    }

    // Build config
    const config: any = {};

    if (gaslimit !== undefined) {
      config.gasLimit = parseFloat(gaslimit);
    }

    if (filelimit !== undefined) {
      config.fileLimit = parseFloat(filelimit);
    }

    if (ignorepattern) {
      if (ignorepattern === "none") {
        config.ignorePattern = "none";
      } else {
        config.ignorePattern = ignorepattern;
      }
    } else if (nodefaults) {
      config.ignorePattern = "none";
    }

    // Load external storage rules if provided
    if (externalrules) {
      if (!fs.existsSync(externalrules)) {
        throw new Error(`External rules file not found: ${externalrules}`);
      }
      
      try {
        const rulesJson = fs.readFileSync(externalrules, "utf-8");
        config.externalStorageRules = JSON.parse(rulesJson);
        console.log(`📦 Loaded ${config.externalStorageRules.length} external storage rules`);
      } catch (error) {
        throw new Error(`Failed to parse external rules JSON: ${error}`);
      }
    }

    // Load existing manifest if updating
    let existingManifest;
    if (update) {
      try {
        existingManifest = loadManifest(update);
        console.log(`📋 Loading existing manifest from: ${update}`);
      } catch (error) {
        console.warn(`⚠️ Could not load existing manifest: ${error}`);
      }
    }

    // Determine site address (priority: CLI arg > test config > existing manifest > none)
    let siteAddress: string | null = null;
    
    if (site) {
      siteAddress = site;
      console.log(`📋 Using site from CLI: ${siteAddress}`);
    } else if (testConfigData?.siteAddress) {
      siteAddress = testConfigData.siteAddress;
      console.log(`📋 Using site from test config: ${siteAddress}`);
    } else if (existingManifest?.chainData?.contractAddress && 
               existingManifest.chainData.contractAddress !== "0x0000000000000000000000000000000000000000") {
      siteAddress = existingManifest.chainData.contractAddress;
      console.log(`📋 Using site from existing manifest: ${siteAddress}`);
    }

    // Get or create WTTP site instance
    let wttpSite = null;
    if (siteAddress) {
      try {
        wttpSite = await hre.ethers.getContractAt("Web3Site", siteAddress);
        
        // Validate that this is a valid WTTP site
        await wttpSite.DPR();
        await wttpSite.DPS();
        
        console.log(`✅ Valid WTTP site contract - will include cost estimates`);
      } catch (error) {
        console.warn(`⚠️ Warning: Invalid WTTP site contract at ${siteAddress}`);
        console.warn(`   Continuing without cost estimates`);
        wttpSite = null;
      }
    } else {
      console.log(`📋 No site address provided - generating manifest without cost estimates`);
      console.log(`   Chunk addresses and file structure will still be calculated`);
      console.log(`   To include estimates, use --site or --testconfig`);
    }

    // Generate manifest
    const destPath = destination || "/";
    const manifest = await generateManifest(
      wttpSite,
      source,
      destPath,
      Object.keys(config).length > 0 ? config : undefined,
      existingManifest
    );

    // Determine output path
    let outputPath = output;
    if (!outputPath) {
      outputPath = path.join(source, "wttp.manifest.json");
    }

    // Save manifest
    saveManifest(manifest, outputPath);

    console.log("\n✅ Manifest generation complete!");
    
    if (manifest.chainData?.contractAddress) {
      console.log(`   Run this command to start uploading:`);
      console.log(`   npx hardhat site:upload --site ${manifest.chainData.contractAddress} --source ${source} --network ${hre.network.name}`);
    } else {
      console.log(`   Manifest created without site address.`);
      console.log(`   To add estimates, regenerate with --site or --testconfig`);
    }
  });

export default {};

