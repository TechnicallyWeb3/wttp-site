import { task, types } from "hardhat/config";
import fs from "fs";
import path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * ipfs:upload — Upload site resources to IPFS via Pinata
 *
 * Usage:
 *   npx hardhat ipfs:upload --manifest ./wttp.manifest.json --jwt $PINATA_JWT
 *   npx hardhat ipfs:upload --source ./public --jwt $PINATA_JWT
 *
 * Credentials fall back to PINATA_JWT env var when --jwt is omitted.
 */
task("ipfs:upload", "Upload site resources marked for IPFS storage to IPFS via Pinata")
  .addOptionalParam(
    "manifest",
    "Path to an existing wttp.manifest.json file",
    undefined,
    types.string
  )
  .addOptionalParam(
    "source",
    "Source directory path (used to resolve file paths; defaults to manifest directory)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "jwt",
    "Pinata JWT token (overrides PINATA_JWT env var)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "gateway",
    "Pinata public gateway domain, e.g. mygateway.mypinata.cloud (overrides PINATA_GATEWAY env var)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "externalrules",
    "JSON file path containing external storage rules (used when generating a manifest from --source)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "gaslimit",
    "Maximum gas price in gwei (only used when auto-generating manifest from --source)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "filelimit",
    "Maximum file size in MB (only used when auto-generating manifest from --source)",
    undefined,
    types.float
  )
  .addOptionalParam(
    "ignorepattern",
    "Custom ignore pattern file path or 'none' (only used when auto-generating manifest from --source)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "output",
    "Output path for the generated manifest file (defaults to <source>/wttp.manifest.json)",
    undefined,
    types.string
  )
  .addFlag("uploadmanifest", "Also pin the manifest JSON itself to IPFS after updating")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {
      manifest: manifestPath,
      source,
      jwt,
      gateway,
      externalrules,
      gaslimit,
      filelimit,
      ignorepattern,
      output,
      uploadmanifest,
    } = taskArgs;

    const { uploadToIPFS } = await import("../scripts/uploadToIPFS");
    const { loadManifest, saveManifest, generateManifestStandalone } = await import("../ethers/generateManifest");

    console.log(`🪐 IPFS Upload Task (via Pinata)`);
    console.log(`🌐 Network: ${hre.network.name}\n`);

    let resolvedManifestPath: string;

    if (manifestPath) {
      // --- Use existing manifest ---
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found: ${manifestPath}`);
      }
      resolvedManifestPath = manifestPath;
      console.log(`📋 Using existing manifest: ${resolvedManifestPath}`);
    } else if (source) {
      // --- Generate manifest from source directory ---
      if (!fs.existsSync(source)) {
        throw new Error(`Source directory not found: ${source}`);
      }

      console.log(`📁 Generating manifest from source: ${source}`);

      // Build external storage rules — default to marking all files for IPFS
      let externalStorageRules: any[] = [{ provider: "ipfs" }];

      if (externalrules) {
        if (!fs.existsSync(externalrules)) {
          throw new Error(`External rules file not found: ${externalrules}`);
        }
        externalStorageRules = JSON.parse(fs.readFileSync(externalrules, "utf-8"));
        console.log(`📜 Using external storage rules: ${externalrules}`);
      }

      const config: any = {
        externalStorageRules,
        ...(gaslimit !== undefined && { gasLimit: gaslimit }),
        ...(filelimit !== undefined && { fileLimit: filelimit }),
        ...(ignorepattern !== undefined && { ignorePattern: ignorepattern }),
      };

      const generatedManifest = await generateManifestStandalone(source, "/", config);

      const outputPath = output || path.join(source, "wttp.manifest.json");
      resolvedManifestPath = saveManifest(generatedManifest, outputPath);
      console.log(`✅ Manifest generated: ${resolvedManifestPath}`);
    } else {
      throw new Error(
        "Either --manifest or --source must be provided.\n" +
          "  --manifest  Path to existing wttp.manifest.json\n" +
          "  --source    Path to site source directory (manifest will be generated)"
      );
    }

    // --- Run upload ---
    const result = await uploadToIPFS(resolvedManifestPath, {
      jwt,
      gateway,
      sourcePath: source,
      uploadManifest: uploadmanifest,
    });

    // --- Summary ---
    console.log(`\n📊 IPFS Upload Summary:`);
    console.log(`   Files uploaded : ${result.filesUploaded}`);
    console.log(`   Files skipped  : ${result.filesSkipped}`);

    if (result.fileLocations.size > 0) {
      console.log(`\n📌 Pinned locations:`);
      for (const [filePath, location] of result.fileLocations) {
        console.log(`   ${filePath} → ${location}`);
      }
    }

    if (result.manifestLocation) {
      console.log(`\n📋 Manifest pinned: ${result.manifestLocation}`);
    }

    console.log(`\n✅ IPFS upload complete. Run site:upload to write redirects on-chain.`);
  });

/**
 * ipfs:check — Verify Pinata credentials and print account information
 *
 * Usage:
 *   npx hardhat ipfs:check
 *   npx hardhat ipfs:check --jwt $PINATA_JWT
 */
task("ipfs:check", "Verify Pinata API credentials and print account information")
  .addOptionalParam(
    "jwt",
    "Pinata JWT token (overrides PINATA_JWT env var)",
    undefined,
    types.string
  )
  .addOptionalParam(
    "gateway",
    "Pinata public gateway domain (overrides PINATA_GATEWAY env var)",
    undefined,
    types.string
  )
  .setAction(async (taskArgs) => {
    const { jwt, gateway } = taskArgs;

    const resolvedJwt = jwt || process.env.PINATA_JWT;
    if (!resolvedJwt) {
      throw new Error(
        "Pinata JWT not found.\n" +
          "Set PINATA_JWT in your .env file or pass --jwt <token>.\n" +
          "Get a key at: https://app.pinata.cloud/developers/api-keys"
      );
    }

    const { PinataSDK } = await import("pinata");

    const resolvedGateway = gateway || process.env.PINATA_GATEWAY;
    const pinata = new PinataSDK({
      pinataJwt: resolvedJwt,
      ...(resolvedGateway ? { pinataGateway: resolvedGateway } : {}),
    });

    console.log(`🔑 Checking Pinata credentials...`);

    try {
      const result = await pinata.testAuthentication() as any;
      console.log(`✅ Authentication successful!`);
      if (result?.message) {
        console.log(`   Message: ${result.message}`);
      }
    } catch (error: any) {
      throw new Error(
        `❌ Pinata authentication failed: ${error?.message || error}\n` +
          "Please check your JWT token and try again."
      );
    }
  });

export default {};
