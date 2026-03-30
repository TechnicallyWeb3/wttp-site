/**
 * Arweave Integration Tests
 *
 * These tests make real transactions on the Arweave network and require a funded wallet.
 *
 * Required environment variable:
 *   ARWEAVE_WALLET_PATH — absolute path to an Arweave JWK wallet JSON file
 *
 * Run in isolation:
 *   npx hardhat test test/19-arweave-integration.test.ts
 *   OR
 *   npm run test:storage
 *
 * The before() hook will throw (not skip) if ARWEAVE_WALLET_PATH is not set,
 * so you know the integration is not being tested.
 */

import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import { uploadToArweave } from "../src/scripts/uploadToArweave";
import { generateManifest, saveManifest, loadManifest } from "../src/scripts/generateManifest";
import { isLocationPending } from "../src/scripts/storageProvider";

const walletPath = process.env.ARWEAVE_WALLET_PATH;

describe("19 - Arweave Integration Tests", function () {
  // Arweave transactions can take time — allow up to 2 minutes
  this.timeout(120_000);

  let tmpDir: string;
  let manifestPath: string;

  before(function () {
    if (!walletPath) {
      throw new Error(
        "ARWEAVE_WALLET_PATH env var is required for Arweave integration tests.\n" +
          "Set it in your .env file or export it before running:\n" +
          "  export ARWEAVE_WALLET_PATH=/path/to/arweave-key.json\n" +
          "  npm run test:storage"
      );
    }

    if (!fs.existsSync(walletPath)) {
      throw new Error(
        `Arweave wallet file not found at: ${walletPath}\n` +
          "Ensure ARWEAVE_WALLET_PATH points to a valid Arweave JWK JSON file."
      );
    }

    // Create a temp source directory with two tiny test files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wttp-arweave-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "hello.txt"),
      "Hello from WTTP Arweave integration test!"
    );
    fs.writeFileSync(
      path.join(tmpDir, "data.json"),
      JSON.stringify({ protocol: "wttp", storage: "arweave", test: true })
    );
    manifestPath = path.join(tmpDir, "wttp.manifest.json");
  });

  after(function () {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── Manifest generation ─────────────────────────────────────────────────

  describe("Manifest generation", function () {
    let manifest: any;

    before(async function () {
      manifest = await generateManifest(null, tmpDir, "/", {
        externalStorageRules: [{ provider: "arweave" }],
      });
      saveManifest(manifest, manifestPath);
    });

    it("generates a manifest with 2 files", function () {
      expect(manifest.siteData.files).to.have.lengthOf(2);
    });

    it("all files are marked for Arweave storage", function () {
      for (const file of manifest.siteData.files) {
        expect(file.externalStorage).to.equal("arweave");
      }
    });

    it("all files have 'ar://[pending]' redirect before upload", function () {
      for (const file of manifest.siteData.files) {
        expect(file.redirect?.location).to.equal("ar://[pending]");
        expect(isLocationPending(file.redirect?.location)).to.be.true;
      }
    });

    it("manifest is persisted to disk", function () {
      expect(fs.existsSync(manifestPath)).to.be.true;
    });
  });

  // ─── Upload ───────────────────────────────────────────────────────────────

  describe("Upload to Arweave", function () {
    let result: any;

    before(async function () {
      result = await uploadToArweave(manifestPath, {
        walletPath: walletPath!,
        sourcePath: tmpDir,
      });
    });

    it("result.provider is 'arweave'", function () {
      expect(result.provider).to.equal("arweave");
    });

    it("reports 2 files uploaded", function () {
      expect(result.filesUploaded).to.equal(2);
    });

    it("reports 0 files skipped on first run", function () {
      expect(result.filesSkipped).to.equal(0);
    });

    it("txIds map has an entry for each file", function () {
      expect(result.txIds.size).to.equal(2);
    });

    it("each TXID is 43 characters (base64url Arweave format)", function () {
      for (const [, txId] of result.txIds) {
        expect(txId).to.be.a("string").with.lengthOf(43);
      }
    });

    it("fileLocations map has entries starting with 'ar://'", function () {
      expect(result.fileLocations.size).to.equal(2);
      for (const [, location] of result.fileLocations) {
        expect(location).to.match(/^ar:\/\//);
      }
    });
  });

  // ─── Manifest persistence after upload ───────────────────────────────────

  describe("Manifest persistence after upload", function () {
    let reloaded: any;

    before(function () {
      reloaded = loadManifest(manifestPath);
    });

    it("reloaded manifest still has 2 files", function () {
      expect(reloaded.siteData.files).to.have.lengthOf(2);
    });

    it("each file status is 'uploaded'", function () {
      for (const file of reloaded.siteData.files) {
        expect(file.status).to.equal("uploaded");
      }
    });

    it("each file redirect.location starts with 'ar://'", function () {
      for (const file of reloaded.siteData.files) {
        expect(file.redirect?.location).to.match(/^ar:\/\//);
      }
    });

    it("each file redirect.location contains a 43-char TXID", function () {
      for (const file of reloaded.siteData.files) {
        const txid = file.redirect?.location?.replace("ar://", "");
        expect(txid).to.be.a("string").with.lengthOf(43);
      }
    });

    it("no file redirect location is still pending", function () {
      for (const file of reloaded.siteData.files) {
        expect(isLocationPending(file.redirect?.location)).to.be.false;
      }
    });
  });

  // ─── Idempotency ─────────────────────────────────────────────────────────

  describe("Idempotency (second upload run)", function () {
    let secondResult: any;

    before(async function () {
      secondResult = await uploadToArweave(manifestPath, {
        walletPath: walletPath!,
        sourcePath: tmpDir,
      });
    });

    it("reports 0 files uploaded on second run", function () {
      expect(secondResult.filesUploaded).to.equal(0);
    });

    it("reports 2 files skipped on second run", function () {
      expect(secondResult.filesSkipped).to.equal(2);
    });

    it("fileLocations still populated from skipped entries", function () {
      expect(secondResult.fileLocations.size).to.equal(2);
      for (const [, location] of secondResult.fileLocations) {
        expect(location).to.match(/^ar:\/\//);
      }
    });
  });
});
