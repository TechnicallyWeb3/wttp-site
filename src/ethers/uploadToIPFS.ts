import path from "path";
import { Manifest, loadManifest, saveManifest } from "./generateManifest";
import {
  uploadToIPFS,
  IPFSUploadOptions,
  IPFSUploadResult,
} from "../scripts/uploadToIPFS";

export type { IPFSUploadOptions, IPFSUploadResult } from "../scripts/uploadToIPFS";
export { uploadToIPFS, IPFSProvider } from "../scripts/uploadToIPFS";

/**
 * Standalone IPFS upload function usable outside of a Hardhat context.
 *
 * Accepts either:
 *   - A path to an existing `wttp.manifest.json` file, or
 *   - A `ManifestConfig`-like object, in which case a manifest is generated first.
 *
 * @param manifestPathOrConfig  Path to manifest file OR a ManifestConfig object
 * @param sourcePath            Root directory of the site (required when generating a manifest)
 * @param options               Pinata credentials and upload options
 * @returns                     IPFS upload result with CIDs
 *
 * @example
 * // Upload from an existing manifest
 * const result = await uploadToIPFSStandalone("./wttp.manifest.json", undefined, {
 *   jwt: process.env.PINATA_JWT,
 * });
 *
 * @example
 * // Generate manifest on-the-fly and upload
 * const result = await uploadToIPFSStandalone(
 *   { externalStorageRules: [{ provider: "ipfs", minSizeBytes: 100_000 }] },
 *   "./public",
 *   { jwt: process.env.PINATA_JWT, uploadManifest: true }
 * );
 */
export async function uploadToIPFSStandalone(
  manifestPathOrConfig: string | any,
  sourcePath?: string,
  options: IPFSUploadOptions = {}
): Promise<IPFSUploadResult> {
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
      throw new Error("sourcePath is required when providing a ManifestConfig object");
    }

    const config = manifestPathOrConfig;
    const outputPath = path.join(sourcePath, "wttp.manifest.json");

    manifest = await generateManifestStandalone(sourcePath, "/", config);
    manifestPath = saveM(manifest, outputPath);
    options.sourcePath = sourcePath;
  }

  return uploadToIPFS(manifestPath, options);
}
