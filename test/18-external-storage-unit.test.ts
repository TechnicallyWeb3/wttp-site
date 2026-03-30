import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";

import { isLocationPending } from "../src/scripts/storageProvider";
import type { IExternalStorageProvider } from "../src/scripts/storageProvider";
import { IPFSProvider, uploadToIPFS } from "../src/scripts/uploadToIPFS";
import { ArweaveProvider, uploadToArweave } from "../src/scripts/uploadToArweave";
import { generateManifest, saveManifest, loadManifest } from "../src/scripts/generateManifest";

describe("18 - External Storage Unit Tests", function () {

  // ─── isLocationPending() ──────────────────────────────────────────────────

  describe("isLocationPending()", function () {
    it("returns true for undefined", function () {
      expect(isLocationPending(undefined)).to.be.true;
    });

    it("returns true for an empty string", function () {
      expect(isLocationPending("")).to.be.true;
    });

    it("returns true for 'ar://[pending]'", function () {
      expect(isLocationPending("ar://[pending]")).to.be.true;
    });

    it("returns true for 'ipfs://[pending]'", function () {
      expect(isLocationPending("ipfs://[pending]")).to.be.true;
    });

    it("returns false for a resolved Arweave URL", function () {
      // 43-character base64url Arweave TXID
      const txid = "A".repeat(43);
      expect(isLocationPending(`ar://${txid}`)).to.be.false;
    });

    it("returns false for a resolved IPFS CID (CIDv0)", function () {
      expect(isLocationPending("ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG")).to.be.false;
    });

    it("returns false for a resolved IPFS CID (CIDv1 bafy...)", function () {
      expect(isLocationPending("ipfs://bafkreidvbhs33ighmljlvr7zbv2ywwzcmp5adtf4kqvlly67cy56bdtmve")).to.be.false;
    });
  });

  // ─── Provider class conformance ───────────────────────────────────────────

  describe("Provider class conformance", function () {
    it("IPFSProvider.providerName is 'ipfs'", function () {
      const provider = new IPFSProvider();
      expect(provider.providerName).to.equal("ipfs");
    });

    it("ArweaveProvider.providerName is 'arweave'", function () {
      const provider = new ArweaveProvider({ walletPath: "/fake/wallet.json" });
      expect(provider.providerName).to.equal("arweave");
    });

    it("IPFSProvider exposes an upload() method", function () {
      const provider: IExternalStorageProvider = new IPFSProvider();
      expect(typeof provider.upload).to.equal("function");
    });

    it("ArweaveProvider exposes an upload() method", function () {
      const provider: IExternalStorageProvider = new ArweaveProvider({ walletPath: "/fake/wallet.json" });
      expect(typeof provider.upload).to.equal("function");
    });

    it("IPFSProvider satisfies IExternalStorageProvider duck-type", function () {
      const provider = new IPFSProvider({ jwt: "test-jwt" });
      expect(provider).to.have.property("providerName");
      expect(provider).to.have.property("upload");
      expect(provider.providerName).to.be.a("string");
    });

    it("ArweaveProvider satisfies IExternalStorageProvider duck-type", function () {
      const provider = new ArweaveProvider({ walletPath: "/fake" });
      expect(provider).to.have.property("providerName");
      expect(provider).to.have.property("upload");
      expect(provider.providerName).to.be.a("string");
    });
  });

  // ─── Manifest generation with external storage rules ─────────────────────

  describe("Manifest generation with external storage rules", function () {
    let tmpDir: string;
    let manifestPath: string;

    before(function () {
      // Create a temp directory with two small test files
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wttp-test-unit-"));
      fs.writeFileSync(path.join(tmpDir, "index.html"), "<html><body>Hello WTTP</body></html>");
      fs.writeFileSync(path.join(tmpDir, "data.json"), JSON.stringify({ test: true, value: 42 }));
      manifestPath = path.join(tmpDir, "wttp.manifest.json");
    });

    after(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("IPFS rules", function () {
      let manifest: any;

      before(async function () {
        manifest = await generateManifest(null, tmpDir, "/", {
          externalStorageRules: [{ provider: "ipfs" }],
        });
      });

      it("marks all files with externalStorage === 'ipfs'", function () {
        for (const file of manifest.siteData.files) {
          expect(file.externalStorage).to.equal("ipfs");
        }
      });

      it("sets redirect.location to 'ipfs://[pending]'", function () {
        for (const file of manifest.siteData.files) {
          expect(file.redirect).to.exist;
          expect(file.redirect.location).to.equal("ipfs://[pending]");
        }
      });

      it("sets redirect.code to 301", function () {
        for (const file of manifest.siteData.files) {
          expect(file.redirect.code).to.equal(301);
        }
      });

      it("all redirect locations are pending", function () {
        for (const file of manifest.siteData.files) {
          expect(isLocationPending(file.redirect?.location)).to.be.true;
        }
      });

      it("round-trips through saveManifest/loadManifest without losing data", function () {
        const savedPath = saveManifest(manifest, manifestPath);
        const loaded = loadManifest(savedPath);

        expect(loaded.siteData.files.length).to.equal(manifest.siteData.files.length);
        for (const file of loaded.siteData.files) {
          expect(file.externalStorage).to.equal("ipfs");
          expect(file.redirect?.location).to.equal("ipfs://[pending]");
        }
      });
    });

    describe("Arweave rules", function () {
      let manifest: any;

      before(async function () {
        manifest = await generateManifest(null, tmpDir, "/", {
          externalStorageRules: [{ provider: "arweave" }],
        });
      });

      it("marks all files with externalStorage === 'arweave'", function () {
        for (const file of manifest.siteData.files) {
          expect(file.externalStorage).to.equal("arweave");
        }
      });

      it("sets redirect.location to 'ar://[pending]'", function () {
        for (const file of manifest.siteData.files) {
          expect(file.redirect).to.exist;
          expect(file.redirect.location).to.equal("ar://[pending]");
        }
      });

      it("sets redirect.code to 301", function () {
        for (const file of manifest.siteData.files) {
          expect(file.redirect.code).to.equal(301);
        }
      });

      it("all redirect locations are pending", function () {
        for (const file of manifest.siteData.files) {
          expect(isLocationPending(file.redirect?.location)).to.be.true;
        }
      });

      it("round-trips through saveManifest/loadManifest without losing data", function () {
        const savedPath = saveManifest(manifest, manifestPath);
        const loaded = loadManifest(savedPath);

        for (const file of loaded.siteData.files) {
          expect(file.externalStorage).to.equal("arweave");
          expect(file.redirect?.location).to.equal("ar://[pending]");
        }
      });
    });

    describe("Mixed rules (IPFS for .json, Arweave for .html)", function () {
      let manifest: any;

      before(async function () {
        manifest = await generateManifest(null, tmpDir, "/", {
          externalStorageRules: [
            { provider: "ipfs", extensions: [".json"] },
            { provider: "arweave", extensions: [".html"] },
          ],
        });
      });

      it("assigns .json files to IPFS", function () {
        const jsonFile = manifest.siteData.files.find((f: any) => f.path.endsWith(".json"));
        expect(jsonFile).to.exist;
        expect(jsonFile.externalStorage).to.equal("ipfs");
        expect(jsonFile.redirect.location).to.equal("ipfs://[pending]");
      });

      it("assigns .html files to Arweave", function () {
        const htmlFile = manifest.siteData.files.find((f: any) => f.path.endsWith(".html"));
        expect(htmlFile).to.exist;
        expect(htmlFile.externalStorage).to.equal("arweave");
        expect(htmlFile.redirect.location).to.equal("ar://[pending]");
      });
    });
  });

  // ─── Credential error paths ───────────────────────────────────────────────

  describe("Credential error paths (no network calls)", function () {
    let tmpDir: string;
    let manifestPath: string;

    before(function () {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wttp-test-cred-"));
      fs.writeFileSync(path.join(tmpDir, "test.txt"), "hello world");
      manifestPath = path.join(tmpDir, "wttp.manifest.json");
      // Write a minimal valid manifest so the functions can start
      const manifest = {
        name: "test",
        path: tmpDir,
        siteData: {
          directories: [],
          files: [
            {
              path: "./test.txt",
              type: "text/plain",
              size: 11,
              status: "pending",
              externalStorage: "ipfs",
              redirect: { code: 301, location: "ipfs://[pending]" },
              chunks: [],
            },
          ],
        },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    });

    after(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("uploadToIPFS throws a clear error when no JWT is available", async function () {
      // Temporarily clear env var to ensure no credentials leak in
      const savedJwt = process.env.PINATA_JWT;
      delete process.env.PINATA_JWT;

      try {
        await uploadToIPFS(manifestPath, {});
        expect.fail("Expected uploadToIPFS to throw");
      } catch (err: any) {
        expect(err.message).to.include("PINATA_JWT");
      } finally {
        if (savedJwt !== undefined) process.env.PINATA_JWT = savedJwt;
      }
    });

    it("uploadToArweave throws a clear error when no wallet is provided", async function () {
      // Write an arweave manifest
      const arManifest = {
        name: "test",
        path: tmpDir,
        siteData: {
          directories: [],
          files: [
            {
              path: "./test.txt",
              type: "text/plain",
              size: 11,
              status: "pending",
              externalStorage: "arweave",
              redirect: { code: 301, location: "ar://[pending]" },
              chunks: [],
            },
          ],
        },
      };
      const arManifestPath = path.join(tmpDir, "arweave-manifest.json");
      fs.writeFileSync(arManifestPath, JSON.stringify(arManifest, null, 2));

      try {
        await uploadToArweave(arManifestPath, {});
        expect.fail("Expected uploadToArweave to throw");
      } catch (err: any) {
        expect(err.message).to.satisfy(
          (msg: string) => msg.includes("walletPath") || msg.includes("wallet"),
          `Expected error to mention wallet, got: ${err.message}`
        );
      }
    });
  });
});
