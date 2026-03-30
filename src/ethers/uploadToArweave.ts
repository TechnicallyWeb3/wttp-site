import path from "path";
import { Manifest, loadManifest, saveManifest } from "./generateManifest";

// Re-export everything from the canonical scripts implementation so callers
// can import from either "ethers/uploadToArweave" or "scripts/uploadToArweave".
export type { ArweaveUploadOptions, ArweaveUploadResult } from "../scripts/uploadToArweave";
export { ArweaveProvider, uploadToArweave } from "../scripts/uploadToArweave";

import type { ArweaveUploadOptions, ArweaveUploadResult } from "../scripts/uploadToArweave";
import { uploadToArweave } from "../scripts/uploadToArweave";

/**
 * Standalone Arweave upload function usable outside of a Hardhat context.
 *
 * Accepts either:
 *   - A path to an existing `wttp.manifest.json` file, or
 *   - A `ManifestConfig`-like object, in which case a manifest is generated first.
 *
 * @param manifestPathOrConfig  Path to manifest file OR a ManifestConfig object
 * @param sourcePath            Root directory of the site (required when generating a manifest)
 * @param options               Arweave wallet and upload options
 * @returns                     Arweave upload result with transaction IDs
 *
 * @example
 * // Upload from an existing manifest
 * const result = await uploadToArweaveStandalone("./wttp.manifest.json", undefined, {
 *   walletPath: "./arweave-key.json",
 * });
 *
 * @example
 * // Generate manifest on-the-fly and upload
 * const result = await uploadToArweaveStandalone(
 *   { externalStorageRules: [{ provider: "arweave", minSizeBytes: 100_000 }] },
 *   "./public",
 *   { walletPath: "./arweave-key.json", uploadManifest: true }
 * );
 */
export async function uploadToArweaveStandalone(
  manifestPathOrConfig: string | any,
  sourcePath?: string,
  options: ArweaveUploadOptions = {}
): Promise<ArweaveUploadResult> {
  const { generateManifestStandalone, saveManifest: saveM } = await import("./generateManifest");

  let manifest: Manifest;
  let manifestPath: string;

  if (typeof manifestPathOrConfig === "string") {
    manifestPath = manifestPathOrConfig;
    manifest = loadManifest(manifestPath);

    if (!options.sourcePath) {
      options.sourcePath = path.dirname(manifestPath);
    }
  } else {
    if (!sourcePath) {
      throw new Error("sourcePath is required when providing ManifestConfig");
    }

    const config = manifestPathOrConfig;
    const outputPath = path.join(sourcePath, "wttp.manifest.json");

    manifest = await generateManifestStandalone(sourcePath, "/", config);
    manifestPath = saveM(manifest, outputPath);
    options.sourcePath = sourcePath;
  }

  return uploadToArweave(manifestPath, options);
}
