import fs from "fs";
import path from "path";
import { PinataSDK } from "pinata";
import { saveManifest, loadManifest } from "./generateManifest";
import type {
  IExternalStorageProvider,
  ExternalStorageUploadOptions,
  ExternalStorageUploadResult,
} from "./storageProvider";
import { isLocationPending } from "./storageProvider";

/**
 * Pinata-specific upload options.
 * Note: `manifestPath` is passed as the first argument to `uploadToIPFS()` directly,
 * not as part of this options object.
 *
 * Authentication priority: jwt > env vars (PINATA_JWT).
 * Environment variables read automatically when no explicit credentials are passed:
 *   PINATA_JWT              — preferred
 *   PINATA_GATEWAY          — optional public gateway domain (e.g. "mygateway.mypinata.cloud")
 */
export interface IPFSUploadOptions {
  /** Pinata JWT (recommended). Falls back to PINATA_JWT env var. */
  jwt?: string;
  /** Legacy Pinata API key — not supported by current SDK; use JWT instead. */
  apiKey?: string;
  /** Legacy Pinata secret API key — not supported by current SDK; use JWT instead. */
  secretApiKey?: string;
  /** Optional Pinata gateway domain (e.g. "mygateway.mypinata.cloud"). Falls back to PINATA_GATEWAY env var. */
  gateway?: string;
  /** Root directory used to resolve relative file paths from the manifest */
  sourcePath?: string;
  /** When true, also pin the manifest JSON itself to IPFS after updating */
  uploadManifest?: boolean;
}

export interface IPFSUploadResult extends ExternalStorageUploadResult {
  /** Provider always "ipfs" */
  provider: "ipfs";
}

/**
 * Resolve Pinata credentials from explicit options or environment variables.
 * Throws if no usable credentials are found.
 */
function resolvePinataCredentials(options: IPFSUploadOptions): {
  jwt: string;
  gateway: string | undefined;
} {
  const jwt =
    options.jwt ||
    process.env.PINATA_JWT;

  if (!jwt) {
    // Try legacy key-based auth — Pinata SDK still accepts JWT built from key+secret,
    // but the SDK itself only accepts JWT.  Inform the user to use JWT.
    const hasLegacy =
      (options.apiKey || process.env.PINATA_API_KEY) &&
      (options.secretApiKey || process.env.PINATA_SECRET_API_KEY);

    if (hasLegacy) {
      throw new Error(
        "Pinata legacy API key/secret authentication is not supported by the current SDK.\n" +
          "Please generate a JWT token from the Pinata dashboard and set PINATA_JWT in your .env file.\n" +
          "See: https://app.pinata.cloud/developers/api-keys"
      );
    }

    throw new Error(
      "Pinata credentials not found.\n" +
        "Set PINATA_JWT in your .env file or pass --jwt to the task.\n" +
        "See: https://app.pinata.cloud/developers/api-keys"
    );
  }

  const gateway = options.gateway || process.env.PINATA_GATEWAY;
  return { jwt, gateway };
}

/**
 * Upload files marked for IPFS storage to IPFS via Pinata.
 * Updates the manifest with actual IPFS CIDs (ipfs://<cid>).
 *
 * @param manifestPath Path to the manifest file (updated in-place)
 * @param options      Upload options including Pinata credentials
 * @returns            Upload result with CIDs
 */
export async function uploadToIPFS(
  manifestPath: string,
  options: IPFSUploadOptions = {}
): Promise<IPFSUploadResult> {
  const { sourcePath, uploadManifest = false } = options;

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = loadManifest(manifestPath);
  const baseSourcePath = sourcePath || path.dirname(manifestPath);

  const { jwt, gateway } = resolvePinataCredentials(options);

  const pinata = new PinataSDK({
    pinataJwt: jwt,
    ...(gateway ? { pinataGateway: gateway } : {}),
  });

  console.log(`📦 Starting IPFS upload for manifest: ${manifestPath}`);
  console.log(`📁 Source directory: ${baseSourcePath}`);

  // Find files marked for IPFS storage
  const ipfsFiles = manifest.siteData.files.filter(
    (file) => file.externalStorage === "ipfs"
  );

  if (ipfsFiles.length === 0) {
    console.log(`ℹ️  No files marked for IPFS storage in manifest`);
    return {
      provider: "ipfs",
      filesUploaded: 0,
      filesSkipped: 0,
      fileLocations: new Map(),
    };
  }

  console.log(`📄 Found ${ipfsFiles.length} files to upload to IPFS`);

  const fileLocations = new Map<string, string>();
  let filesUploaded = 0;
  let filesSkipped = 0;

  for (let i = 0; i < ipfsFiles.length; i++) {
    const file = ipfsFiles[i];
    const currentLocation = file.redirect?.location ?? "";

    // Skip if already has a resolved CID
    if (!isLocationPending(currentLocation) && currentLocation.startsWith("ipfs://")) {
      console.log(`⏭️  Skipping ${file.path} — already pinned: ${currentLocation}`);
      fileLocations.set(file.path, currentLocation);
      filesSkipped++;
      continue;
    }

    // Resolve absolute path on disk
    const fileRelativePath = file.path.replace(/^\.\//, "");
    const fileAbsolutePath = path.join(baseSourcePath, fileRelativePath);

    if (!fs.existsSync(fileAbsolutePath)) {
      console.warn(`⚠️  File not found: ${fileAbsolutePath} — skipping`);
      continue;
    }

    console.log(`\n📤 Uploading ${i + 1}/${ipfsFiles.length}: ${file.path}`);
    console.log(`   Type: ${file.type}, Size: ${file.size} bytes`);

    try {
      const fileBuffer = fs.readFileSync(fileAbsolutePath);
      const fileName = path.basename(fileRelativePath);

      // Node.js 20+ has File as a global; construct from Buffer
      const fileObject = new File([fileBuffer], fileName, { type: file.type });
      const result = await pinata.upload.public.file(fileObject);

      const cid = result.cid;
      const ipfsUrl = `ipfs://${cid}`;

      console.log(`   ✅ Pinned! CID: ${cid}`);

      if (!file.redirect) {
        file.redirect = { code: 301, location: ipfsUrl };
      } else {
        file.redirect.location = ipfsUrl;
      }
      file.status = "uploaded";

      fileLocations.set(file.path, ipfsUrl);
      filesUploaded++;

      // Persist manifest after each file so partial runs are resumable
      saveManifest(manifest, manifestPath);
    } catch (error) {
      console.error(`   ❌ Failed to upload ${file.path}:`, error);
      file.status = "error";
      saveManifest(manifest, manifestPath);
      throw error;
    }
  }

  // Save final manifest state
  saveManifest(manifest, manifestPath);

  console.log(`\n✅ IPFS upload complete!`);
  console.log(`   Files uploaded: ${filesUploaded}`);
  console.log(`   Files skipped: ${filesSkipped}`);

  let manifestLocation: string | undefined;

  // Optionally pin the manifest JSON itself
  if (uploadManifest) {
    console.log(`\n📤 Uploading manifest to IPFS...`);
    try {
      const manifestJson = JSON.stringify(manifest, null, 2);
      const result = await pinata.upload.public.json(manifest as unknown as Record<string, unknown>, {
        metadata: { name: `${manifest.name}.wttp.manifest.json` },
      });
      manifestLocation = `ipfs://${result.cid}`;
      console.log(`   ✅ Manifest pinned! CID: ${result.cid}`);
    } catch (error) {
      console.error(`   ❌ Failed to upload manifest:`, error);
    }
  }

  return {
    provider: "ipfs",
    filesUploaded,
    filesSkipped,
    fileLocations,
    manifestLocation,
  };
}

/**
 * IPFSProvider implements IExternalStorageProvider for use in provider-agnostic
 * pipelines.  Credentials are supplied at construction time.
 *
 * @example
 * ```ts
 * const provider = new IPFSProvider({ jwt: process.env.PINATA_JWT });
 * const result = await provider.upload({ manifestPath: "./wttp.manifest.json" });
 * ```
 */
/** Credential-only subset of IPFSUploadOptions (no per-call path options) */
export type IPFSCredentials = Pick<IPFSUploadOptions, "jwt" | "apiKey" | "secretApiKey" | "gateway">;

export class IPFSProvider implements IExternalStorageProvider {
  readonly providerName = "ipfs";
  private readonly credentials: IPFSCredentials;

  constructor(credentials: IPFSCredentials = {}) {
    this.credentials = credentials;
  }

  async upload(options: ExternalStorageUploadOptions): Promise<ExternalStorageUploadResult> {
    return uploadToIPFS(options.manifestPath, {
      ...this.credentials,
      sourcePath: options.sourcePath,
      uploadManifest: options.uploadManifest,
    });
  }
}
