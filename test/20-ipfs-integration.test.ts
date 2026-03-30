/**
 * IPFS / Pinata Integration Tests
 *
 * These tests make real API calls to Pinata and will pin small files to IPFS.
 *
 * Required environment variable:
 *   PINATA_JWT — JWT token from the Pinata dashboard
 *
 * Optional environment variable:
 *   PINATA_GATEWAY — custom Pinata gateway domain (e.g. "mygateway.mypinata.cloud")
 *
 * Run in isolation:
 *   npx hardhat test test/20-ipfs-integration.test.ts
 *   OR
 *   npm run test:storage
 *
 * The before() hook will throw (not skip) if PINATA_JWT is not set,
 * so you know the integration is not being tested.
 */

import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import { uploadToIPFS } from "../src/scripts/uploadToIPFS";
import { generateManifest, saveManifest, loadManifest } from "../src/scripts/generateManifest";
import { isLocationPending } from "../src/scripts/storageProvider";

const pinataJwt = process.env.PINATA_JWT;
const pinataGateway = process.env.PINATA_GATEWAY;

// Loose CID format check — accepts CIDv0 (Qm...) and CIDv1 (baf...)
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|baf[a-z2-7]{50,})$/;

describe("20 - IPFS / Pinata Integration Tests", function () {
  this.timeout(60_000);

  let tmpDir: string;
  let manifestPath: string;

  before(function () {
    if (!pinataJwt) {
      throw new Error(
        "PINATA_JWT env var is required for IPFS integration tests.\n" +
          "Set it in your .env file or export it before running:\n" +
          "  export PINATA_JWT=your_pinata_jwt_token\n" +
          "  npm run test:storage\n" +
          "Get a token at: https://app.pinata.cloud/developers/api-keys"
      );
    }

    // Create a temp source directory with two tiny test files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wttp-ipfs-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "hello.txt"),
      "Hello from WTTP IPFS integration test!"
    );
    fs.writeFileSync(
      path.join(tmpDir, "data.json"),
      JSON.stringify({ protocol: "wttp", storage: "ipfs", test: true })
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
        externalStorageRules: [{ provider: "ipfs" }],
      });
      saveManifest(manifest, manifestPath);
    });

    it("generates a manifest with 2 files", function () {
      expect(manifest.siteData.files).to.have.lengthOf(2);
    });

    it("all files are marked for IPFS storage", function () {
      for (const file of manifest.siteData.files) {
        expect(file.externalStorage).to.equal("ipfs");
      }
    });

    it("all files have 'ipfs://[pending]' redirect before upload", function () {
      for (const file of manifest.siteData.files) {
        expect(file.redirect?.location).to.equal("ipfs://[pending]");
        expect(isLocationPending(file.redirect?.location)).to.be.true;
      }
    });

    it("manifest is persisted to disk", function () {
      expect(fs.existsSync(manifestPath)).to.be.true;
    });
  });

  // ─── Upload ───────────────────────────────────────────────────────────────

  describe("Upload to IPFS via Pinata", function () {
    let result: any;

    before(async function () {
      result = await uploadToIPFS(manifestPath, {
        jwt: pinataJwt!,
        gateway: pinataGateway,
        sourcePath: tmpDir,
      });
    });

    it("result.provider is 'ipfs'", function () {
      expect(result.provider).to.equal("ipfs");
    });

    it("reports 2 files uploaded", function () {
      expect(result.filesUploaded).to.equal(2);
    });

    it("reports 0 files skipped on first run", function () {
      expect(result.filesSkipped).to.equal(0);
    });

    it("fileLocations map has an entry for each file", function () {
      expect(result.fileLocations.size).to.equal(2);
    });

    it("each fileLocation starts with 'ipfs://'", function () {
      for (const [, location] of result.fileLocations) {
        expect(location).to.match(/^ipfs:\/\//);
      }
    });

    it("each CID is a non-empty string in a recognised CID format", function () {
      for (const [, location] of result.fileLocations) {
        const cid = location.replace("ipfs://", "");
        expect(cid).to.be.a("string").and.have.length.above(0);
        expect(CID_RE.test(cid), `CID '${cid}' does not look like a valid CID`).to.be.true;
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

    it("each file redirect.location starts with 'ipfs://'", function () {
      for (const file of reloaded.siteData.files) {
        expect(file.redirect?.location).to.match(/^ipfs:\/\//);
      }
    });

    it("each file's CID is in a recognised format", function () {
      for (const file of reloaded.siteData.files) {
        const cid = file.redirect?.location?.replace("ipfs://", "");
        expect(cid).to.be.a("string").and.have.length.above(0);
        expect(CID_RE.test(cid), `CID '${cid}' does not look like a valid CID`).to.be.true;
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
      secondResult = await uploadToIPFS(manifestPath, {
        jwt: pinataJwt!,
        gateway: pinataGateway,
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
        expect(location).to.match(/^ipfs:\/\//);
      }
    });
  });
});
