import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ManifestConfig } from "../ethers/generateManifest";

task("arweave:upload", "Upload site resources to Arweave using official Arweave library")
  .addOptionalParam(
    "manifestPath",
    "Path to an existing manifest file",
    undefined,
    types.string
  )
  .addOptionalParam(
    "source",
    "Source directory path (required if generating manifest from config)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "wallet",
    "Path to Arweave wallet JSON file (JWK format)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "externalrules",
    "JSON file path containing external storage rules (for manifest generation)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "gaslimit",
    "Maximum gas price in gwei (for manifest generation)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "filelimit",
    "Maximum file size in MB (for manifest generation)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "ignorepattern",
    "Custom ignore pattern file path or 'none' (for manifest generation)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "output",
    "Output path for manifest file (when generating)",
    undefined,
    types.string
  )
  .addFlag(
    "uploadManifest",
    "Upload the manifest itself to Arweave after updating"
  )
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {
      manifestPath,
      source,
      wallet,
      externalrules,
      gaslimit,
      filelimit,
      ignorepattern,
      output,
      uploadManifest,
    } = taskArgs;

    const { uploadToArweave } = await import("../scripts/uploadToArweave");
    const { loadManifest, saveManifest, generateManifestStandalone } = await import("../ethers/generateManifest");

    console.log(`🌐 Arweave Upload Task`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    // Validate wallet
    if (!wallet) {
      throw new Error("--wallet parameter is required. Provide path to Arweave wallet JSON file.");
    }

    if (!fs.existsSync(wallet)) {
      throw new Error(`Arweave wallet file not found: ${wallet}`);
    }

    let finalManifestPath: string;
    let sourcePath: string;

    // Determine if we're using existing manifest or generating new one
    if (manifestPath) {
      // Use existing manifest
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found: ${manifestPath}`);
      }

      finalManifestPath = manifestPath;
      
      // Try to determine source path from manifest location
      const manifestDir = path.dirname(manifestPath);
      const manifest = loadManifest(manifestPath);
      
      // Use provided source or try to infer from manifest
      sourcePath = source || manifestDir;
      
      console.log(`📋 Using existing manifest: ${manifestPath}`);
      console.log(`📁 Source directory: ${sourcePath}`);
    } else if (source) {
      // Generate new manifest
      if (!fs.existsSync(source)) {
        throw new Error(`Source directory does not exist: ${source}`);
      }

      sourcePath = source;

      // Build manifest config
      const config: ManifestConfig = {};

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
      }

      // Load external storage rules if provided
      if (externalrules) {
        if (!fs.existsSync(externalrules)) {
          throw new Error(`External rules file not found: ${externalrules}`);
        }

        try {
          const rulesJson = fs.readFileSync(externalrules, "utf-8");
          const rules = JSON.parse(rulesJson);
          config.externalStorageRules = rules;
          console.log(`📦 Loaded ${rules.length} external storage rules`);
        } catch (error) {
          throw new Error(`Failed to parse external rules JSON: ${error}`);
        }
      }

      // Determine output path
      const outputPath = output || path.join(source, "wttp.manifest.json");

      console.log(`📋 Generating manifest for: ${source}`);
      console.log(`📁 Output: ${outputPath}`);

      // Generate manifest
      const manifest = await generateManifestStandalone(
        source,
        "/",
        Object.keys(config).length > 0 ? config : undefined
      );

      finalManifestPath = path.resolve(outputPath);
      const manifestDir = path.dirname(finalManifestPath);
      
      // Save manifest
      saveManifest(manifest, finalManifestPath);

      console.log(`✅ Manifest generated: ${finalManifestPath}`);
    } else {
      throw new Error(
        "Either --manifestPath or --source must be provided.\n" +
        "  --manifestPath: Use existing manifest file\n" +
        "  --source: Generate new manifest from directory"
      );
    }

    // Upload to Arweave
    console.log(`\n🚀 Starting Arweave upload...`);
    
    const result = await uploadToArweave(finalManifestPath, {
      walletPath: wallet,
      sourcePath: sourcePath,
      uploadManifest: uploadManifest,
    });

    console.log(`\n✅ Arweave upload task complete!`);
    console.log(`   Files uploaded: ${result.filesUploaded}`);
    console.log(`   Files skipped: ${result.filesSkipped}`);
    
    if (result.manifestTxId) {
      console.log(`   Manifest TXID: ${result.manifestTxId}`);
    }

    console.log(`\n📋 Updated manifest saved to: ${finalManifestPath}`);
    
    if (result.filesUploaded > 0) {
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Review the updated manifest`);
      console.log(`   2. Upload redirects to your WTTP site using site:upload`);
    }
  });

export default {};

