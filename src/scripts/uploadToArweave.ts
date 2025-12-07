import fs from "fs";
import path from "path";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";
import { saveManifest, loadManifest } from "./generateManifest";

export interface ArweaveUploadOptions {
  /** Path to Arweave wallet JSON file (JWK format) */
  walletPath?: string;
  /** Arweave wallet object (alternative to walletPath) */
  wallet?: any;
  /** Source directory path (needed to resolve file paths) */
  sourcePath?: string;
  /** Whether to upload the manifest itself to Arweave after updating */
  uploadManifest?: boolean;
}

export interface ArweaveUploadResult {
  /** Number of files uploaded */
  filesUploaded: number;
  /** Number of files skipped (already have TXIDs) */
  filesSkipped: number;
  /** Map of file paths to Arweave transaction IDs */
  txIds: Map<string, string>;
  /** Transaction ID of the manifest if uploaded */
  manifestTxId?: string;
}

/**
 * Upload files marked for Arweave storage to Arweave using official Arweave library
 * Updates the manifest with actual Arweave transaction IDs
 * 
 * @param manifestPath Path to the manifest file (will be updated in place)
 * @param options Upload options including wallet and source path
 * @returns Upload result with TXIDs
 */
export async function uploadToArweave(
  manifestPath: string,
  options: ArweaveUploadOptions = {}
): Promise<ArweaveUploadResult> {
  const { walletPath, wallet, sourcePath, uploadManifest = false } = options;

  // Load manifest
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = loadManifest(manifestPath);
  
  // Determine source path
  const baseSourcePath = sourcePath || path.dirname(manifestPath);
  
  // Initialize Arweave
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });
  
  // Load wallet
  let walletKey: JWKInterface;
  if (wallet) {
    walletKey = wallet;
  } else if (walletPath) {
    if (!fs.existsSync(walletPath)) {
      throw new Error(`Arweave wallet file not found: ${walletPath}`);
    }
    walletKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  } else {
    throw new Error("Either walletPath or wallet must be provided");
  }

  console.log(`📦 Starting Arweave upload for manifest: ${manifestPath}`);
  console.log(`📁 Source directory: ${baseSourcePath}`);

  // Find files marked for Arweave storage
  const arweaveFiles = manifest.siteData.files.filter(
    (file) => file.externalStorage === "arweave"
  );

  if (arweaveFiles.length === 0) {
    console.log(`ℹ️  No files marked for Arweave storage in manifest`);
    return {
      filesUploaded: 0,
      filesSkipped: 0,
      txIds: new Map(),
    };
  }

  console.log(`📄 Found ${arweaveFiles.length} files to upload to Arweave`);

  const txIds = new Map<string, string>();
  let filesUploaded = 0;
  let filesSkipped = 0;

  // Upload each file
  for (let i = 0; i < arweaveFiles.length; i++) {
    const file = arweaveFiles[i];
    
    // Check if already has a TXID (from previous upload)
    const currentLocation = file.redirect?.location || "";
    const existingTxId = currentLocation.replace(/^ar:\/\//, "").replace(/^arweave:\/\//, "");
    
    if (existingTxId && existingTxId !== "[pending]" && existingTxId.length === 43) {
      // Valid Arweave TXID format (43 characters base64url)
      console.log(`⏭️  Skipping ${file.path} - already has TXID: ${existingTxId}`);
      txIds.set(file.path, existingTxId);
      filesSkipped++;
      continue;
    }

    // Resolve file path
    const fileRelativePath = file.path.replace(/^\.\//, "");
    const fileAbsolutePath = path.join(baseSourcePath, fileRelativePath);

    if (!fs.existsSync(fileAbsolutePath)) {
      console.warn(`⚠️  File not found: ${fileAbsolutePath} - skipping`);
      continue;
    }

    console.log(`\n📤 Uploading ${i + 1}/${arweaveFiles.length}: ${file.path}`);
    console.log(`   Type: ${file.type}, Size: ${file.size} bytes`);

    try {
      // Read file data
      const fileData = fs.readFileSync(fileAbsolutePath);
      
      // Create transaction
      const transaction = await arweave.createTransaction({
        data: fileData,
      });

      // Add tags
      transaction.addTag("Content-Type", file.type);
      transaction.addTag("File-Path", file.path);
      if (file.charset) {
        transaction.addTag("Charset", file.charset);
      }

      // Sign transaction
      await arweave.transactions.sign(transaction, walletKey);

      // Post transaction
      const uploader = await arweave.transactions.getUploader(transaction);
      
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`   📤 Upload progress: ${uploader.pctComplete}%`);
      }

      const txId = transaction.id;
      console.log(`   ✅ Uploaded! TXID: ${txId}`);

      // Update manifest
      if (!file.redirect) {
        file.redirect = {
          code: 301,
          location: `ar://${txId}`,
        };
      } else {
        file.redirect.location = `ar://${txId}`;
      }
      file.status = "uploaded";

      txIds.set(file.path, txId);
      filesUploaded++;

      // Save manifest after each upload (in case of interruption)
      saveManifest(manifest, manifestPath);
    } catch (error) {
      console.error(`   ❌ Failed to upload ${file.path}:`, error);
      file.status = "error";
      throw error;
    }
  }

  // Save updated manifest
  saveManifest(manifest, manifestPath);

  console.log(`\n✅ Arweave upload complete!`);
  console.log(`   Files uploaded: ${filesUploaded}`);
  console.log(`   Files skipped: ${filesSkipped}`);

  let manifestTxId: string | undefined;

  // Optionally upload the manifest itself
  if (uploadManifest) {
    console.log(`\n📤 Uploading manifest to Arweave...`);
    try {
      const manifestData = JSON.stringify(manifest, null, 2);
      const manifestBuffer = Buffer.from(manifestData, "utf-8");
      
      // Create transaction for manifest
      const manifestTransaction = await arweave.createTransaction({
        data: manifestBuffer,
      });

      // Add tags
      manifestTransaction.addTag("Content-Type", "application/json");
      manifestTransaction.addTag("Manifest-Name", manifest.name);
      manifestTransaction.addTag("Protocol", "wttp");

      // Sign transaction
      await arweave.transactions.sign(manifestTransaction, walletKey);

      // Post transaction
      const manifestUploader = await arweave.transactions.getUploader(manifestTransaction);
      
      while (!manifestUploader.isComplete) {
        await manifestUploader.uploadChunk();
        console.log(`   📤 Upload progress: ${manifestUploader.pctComplete}%`);
      }

      manifestTxId = manifestTransaction.id;
      console.log(`   ✅ Manifest uploaded! TXID: ${manifestTxId}`);
    } catch (error) {
      console.error(`   ❌ Failed to upload manifest:`, error);
    }
  }

  return {
    filesUploaded,
    filesSkipped,
    txIds,
    manifestTxId,
  };
}