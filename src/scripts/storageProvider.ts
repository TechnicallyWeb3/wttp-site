/**
 * External Storage Provider abstraction
 *
 * All external storage integrations (Arweave, IPFS/Pinata, Filecoin, etc.) implement
 * IExternalStorageProvider so they can be swapped or extended without changing the
 * upload pipeline.  The on-chain step (uploadFromManifest) is provider-agnostic — it
 * only reads `file.redirect.location` after any provider has populated it.
 *
 * Provider name values must match the `provider` field used in ExternalStorageRule and
 * the `externalStorage` field on FileData inside the manifest.
 */

/**
 * Options common to every external storage upload call.
 * Provider-specific options (API keys, wallets, etc.) are defined in each
 * provider's own Options interface, which extends this one.
 */
export interface ExternalStorageUploadOptions {
  /** Absolute or relative path to the wttp.manifest.json file (updated in-place) */
  manifestPath: string;
  /** Root directory used to resolve relative file paths from the manifest */
  sourcePath?: string;
  /** When true, also upload the manifest JSON itself to the provider */
  uploadManifest?: boolean;
}

/**
 * Normalised result returned by every provider after an upload run.
 */
export interface ExternalStorageUploadResult {
  /** Number of files newly uploaded during this run */
  filesUploaded: number;
  /** Number of files skipped (already had a resolved location) */
  filesSkipped: number;
  /**
   * Map of manifest-relative file path → resolved storage URL
   * e.g. "./assets/logo.png" → "ipfs://Qm..." or "ar://<txid>"
   */
  fileLocations: Map<string, string>;
  /** Storage URL of the manifest file itself, if it was uploaded */
  manifestLocation?: string;
}

/**
 * Common interface for all external storage providers.
 *
 * Implementing classes should:
 *   1. Filter manifest files by `file.externalStorage === this.providerName`
 *   2. Skip files whose `file.redirect.location` is already resolved (not "[pending]")
 *   3. Upload remaining files and set `file.redirect.location` to the provider URL
 *   4. Persist the manifest after each successful file upload
 *   5. Return an ExternalStorageUploadResult summarising the run
 *
 * @example
 * ```ts
 * class PinataIPFSProvider implements IExternalStorageProvider {
 *   readonly providerName = "ipfs";
 *   async upload(options) { ... }
 * }
 * ```
 */
export interface IExternalStorageProvider {
  /**
   * Must match the `provider` value used in ExternalStorageRule and the
   * `externalStorage` string on FileData — e.g. "arweave", "ipfs", "filecoin".
   */
  readonly providerName: string;

  /**
   * Upload all pending files in the manifest that are assigned to this provider.
   * Updates the manifest in-place and saves it after each file.
   */
  upload(options: ExternalStorageUploadOptions): Promise<ExternalStorageUploadResult>;
}

/** Supported external storage provider names (mirrors ExternalStorageRule.provider) */
export type ExternalStorageProviderName = "arweave" | "ipfs" | "filecoin";

/**
 * Check whether a manifest file's redirect location is still pending
 * (i.e. has not yet been resolved by the provider).
 */
export function isLocationPending(location: string | undefined): boolean {
  if (!location) return true;
  return location.endsWith("[pending]");
}
