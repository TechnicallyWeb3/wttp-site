import { task, types } from "hardhat/config";
import fs from "fs";

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

task("site:upload", "Upload a file or directory to a WTTP site")
  .addOptionalParam("site", "The address of the WTTP site (required unless manifest has chainData.contractAddress)", undefined, types.string)
  .addOptionalParam("source", "The source file or directory path (not required if using --manifest)", undefined, types.string)
  .addOptionalParam("manifest", "Path to manifest file (trusts manifest completely)", undefined, types.string)
  .addOptionalParam("destination", "The destination path on the WTTP site", "/")
  .addOptionalParam("nodefaults", "Disable default ignore patterns", false, types.boolean)
  .addOptionalParam("gaslimit", "Maximum gas price in gwei to wait for before sending transactions (default: 300)", 300, types.float)
  .addOptionalParam("filelimit", "Maximum file size in MB (default: 400)", 400, types.float)
  .setAction(async (taskArgs, hre) => {
    const { site, source, manifest, destination, nodefaults, gaslimit, filelimit } = taskArgs;
    
    // Check if using manifest-based upload
    if (manifest) {
      if (!fs.existsSync(manifest)) {
        throw new Error(`Manifest file not found: ${manifest}`);
      }
      
      console.log(`📋 Using manifest-based upload: ${manifest}`);
      const { loadManifest } = require("../scripts/generateManifest");
      const manifestData = loadManifest(manifest);
      
      // Determine site address: use from manifest if available, otherwise require CLI param
      let siteAddress: string;
      if (manifestData.chainData?.contractAddress) {
        // Manifest has site address
        if (site) {
          // Both provided - must match
          const manifestAddress = manifestData.chainData.contractAddress.toLowerCase();
          const cliAddress = site.toLowerCase();
          if (manifestAddress !== cliAddress) {
            throw new Error(
              `Site address conflict!\n` +
              `  CLI parameter: ${site}\n` +
              `  Manifest file: ${manifestData.chainData.contractAddress}\n\n` +
              `To fix this:\n` +
              `  1. Remove --site parameter and use manifest address, OR\n` +
              `  2. Use --site ${manifestData.chainData.contractAddress} to match manifest, OR\n` +
              `  3. Generate a new manifest file for address ${site}`
            );
          }
          siteAddress = site;
        } else {
          // Use manifest address
          siteAddress = manifestData.chainData.contractAddress;
          console.log(`📍 Using site address from manifest: ${siteAddress}`);
        }
      } else {
        // Manifest doesn't have address - require CLI param
        if (!site) {
          throw new Error(
            `Site address is required!\n` +
            `  Manifest file doesn't contain a site address (chainData.contractAddress)\n` +
            `  Please provide --site parameter`
          );
        }
        siteAddress = site;
      }
      
      // Validate network matches manifest
      const currentChainId = Number((await hre.ethers.provider.getNetwork()).chainId);
      if (manifestData.chainData?.chainId && manifestData.chainData.chainId !== currentChainId) {
        throw new Error(
          `Network mismatch!\n` +
          `  Current network: ${currentChainId} (${hre.network.name})\n` +
          `  Manifest network: ${manifestData.chainData.chainId}\n\n` +
          `To fix this:\n` +
          `  1. Switch to the correct network: --network <network-name>, OR\n` +
          `  2. Generate a new manifest file for network ${hre.network.name} (chainId: ${currentChainId})`
        );
      }
      
      // Check for conflicting parameters and warn/error
      const warnings: string[] = [];
      const errors: string[] = [];
      
      // Check destination conflict
      if (destination !== "/") {
        const manifestDestination = manifestData.wttpConfig?.destination || "/";
        if (manifestDestination !== destination) {
          errors.push(
            `Destination conflict: CLI (${destination}) != Manifest (${manifestDestination})\n` +
            `  Remove --destination parameter or regenerate manifest with --destination ${destination}`
          );
        } else {
          warnings.push(`--destination parameter matches manifest (${destination})`);
        }
      }
      
      // Check gas limit conflict (if not set to default)
      if (gaslimit !== 300) {
        const manifestGasLimit = manifestData.wttpConfig?.gasLimit;
        if (manifestGasLimit !== undefined && manifestGasLimit !== gaslimit) {
          errors.push(
            `Gas limit conflict: CLI (${gaslimit} gwei) != Manifest (${manifestGasLimit} gwei)\n` +
            `  Remove --gaslimit parameter or regenerate manifest with --gaslimit ${gaslimit}`
          );
        } else if (manifestGasLimit === gaslimit) {
          warnings.push(`--gaslimit parameter matches manifest (${gaslimit} gwei)`);
        } else {
          warnings.push(`--gaslimit ignored (using manifest: ${manifestGasLimit || "none"} gwei)`);
        }
      }
      
      // Check file limit conflict
      if (filelimit !== 400) {
        const manifestFileLimit = manifestData.wttpConfig?.fileLimit;
        if (manifestFileLimit !== undefined && manifestFileLimit !== filelimit) {
          errors.push(
            `File limit conflict: CLI (${filelimit} MB) != Manifest (${manifestFileLimit} MB)\n` +
            `  Remove --filelimit parameter or regenerate manifest with --filelimit ${filelimit}`
          );
        } else if (manifestFileLimit === filelimit) {
          warnings.push(`--filelimit parameter matches manifest (${filelimit} MB)`);
        } else {
          warnings.push(`--filelimit ignored (using manifest: ${manifestFileLimit || "none"} MB)`);
        }
      }
      
      // Warn about ignored parameters
      if (nodefaults) {
        warnings.push(`--nodefaults ignored (manifest already contains filtered file list)`);
      }
      
      // Show errors first (fatal)
      if (errors.length > 0) {
        console.error(`\n❌ Configuration conflicts detected:\n`);
        errors.forEach((error, i) => {
          console.error(`  ${i + 1}. ${error}`);
        });
        throw new Error("Please resolve configuration conflicts before uploading");
      }
      
      // Show warnings (non-fatal)
      if (warnings.length > 0) {
        console.warn(`\n⚠️  Warnings:\n`);
        warnings.forEach((warning, i) => {
          console.warn(`  ${i + 1}. ${warning}`);
        });
      }
      
      // Connect to the WTTP site
      const wtppSite = await hre.ethers.getContractAt("Web3Site", siteAddress);
      const { uploadFromManifest } = require("../scripts/uploadFromManifest");
      
      // Upload from manifest (trusts manifest completely)
      await uploadFromManifest(wtppSite, manifest, source);
    } else {
      // Traditional upload mode - site is required
      if (!site) {
        throw new Error("Site address is required. Provide --site parameter or use --manifest with a manifest file containing chainData.contractAddress");
      }
      
      // Connect to the WTTP site
      const wtppSite = await hre.ethers.getContractAt("Web3Site", site);
      // Traditional upload mode
      if (!source) {
        throw new Error("Either --source or --manifest must be provided");
      }
      
      // Convert filelimit from MB to bytes
      const fileLimitBytes = filelimit ? Math.floor(parseFloat(filelimit) * 1024 * 1024) : undefined;
      const gasLimitGwei = gaslimit ? parseFloat(gaslimit) : undefined;
      
      // Check if source is a file or directory
      if (isDirectory(source)) {
        console.log(`Source ${source} is a directory, using directory upload...`);
        // Import the directory upload function
        const { uploadDirectory } = require("../scripts/uploadDirectory");
        
        // Configure ignore options
        const ignoreOptions = {
          includeDefaults: !nodefaults
        };
        
        // Upload the directory
        await uploadDirectory(wtppSite, source, destination, ignoreOptions, fileLimitBytes, gasLimitGwei);
      } else {
        console.log(`Source ${source} is a file, using file upload...`);
        // Import the file upload function
        const { uploadFile } = require("../scripts/uploadFile");
        // Upload the file
        await uploadFile(wtppSite, source, destination, fileLimitBytes, gasLimitGwei);
      }
    }
  });

export default {};