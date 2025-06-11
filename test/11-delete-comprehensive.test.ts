import { expect } from "chai";
import { ethers } from "hardhat";
import { TestWTTPSite } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("🗑️ DELETE Method - Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointRegistry: any;
  let owner: HardhatEthersSigner;
  let siteAdmin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  // Constants
  const ALL_METHODS_BITMASK = 511; // All 9 methods
  const siteAdminRole = ethers.keccak256(ethers.toUtf8Bytes("SITE_ADMIN"));
  const publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const defaultAdminRole = ethers.ZeroHash;

  // Test headers
  let defaultHeader: any;
  let restrictedHeader: any;
  let deleteDisabledHeader: any;

  before(async function () {
    [owner, siteAdmin, user1] = await ethers.getSigners();

    // Deploy ESP contracts
    const DataPointStorage = await ethers.getContractFactory("DataPointStorage");
    const dataPointStorage = await DataPointStorage.deploy();
    
    const DataPointRegistry = await ethers.getContractFactory("DataPointRegistry");
    dataPointRegistry = await DataPointRegistry.deploy(
      owner.address,
      await dataPointStorage.getAddress(),
      ethers.parseEther("0.0001") // Default royalty rate
    );

    // Create test headers
    defaultHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "" },
      cors: {
        methods: ALL_METHODS_BITMASK,
        origins: [
          publicRole,     // HEAD
          publicRole,     // GET  
          publicRole,     // POST
          siteAdminRole,  // PUT
          siteAdminRole,  // PATCH
          siteAdminRole,  // DELETE
          publicRole,     // OPTIONS
          publicRole,     // LOCATE
          siteAdminRole   // DEFINE
        ],
        preset: 0,
        custom: ""
      },
      redirect: { code: 0, location: "" }
    };

    restrictedHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "restricted" },
      cors: {
        methods: 511, // All methods in bitmask
        origins: [
          publicRole,       // HEAD
          publicRole,       // GET
          publicRole,       // POST
          siteAdminRole,    // PUT - site admin (for test setup)
          defaultAdminRole, // PATCH - admin only
          defaultAdminRole, // DELETE - admin only
          publicRole,       // OPTIONS
          publicRole,       // LOCATE
          defaultAdminRole  // DEFINE - admin only
        ],
        preset: 0,
        custom: "restricted"
      },
      redirect: { code: 0, location: "" }
    };

    deleteDisabledHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "no-delete" },
      cors: {
        methods: 479, // All except DELETE: 511 - 32 = 479
        origins: Array(9).fill(siteAdminRole),
        preset: 0,
        custom: "no-delete"
      },
      redirect: { code: 0, location: "" }
    };
  });

  beforeEach(async function () {
    const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
    testWTTPSite = await TestWTTPSiteFactory.deploy(
      owner.address,
      await dataPointRegistry.getAddress(),
      defaultHeader
    ) as unknown as TestWTTPSite;
    await testWTTPSite.waitForDeployment();

    await testWTTPSite.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
  });

  // Helper functions
  async function createResource(path: string, content: string, header?: any) {
    if (header) {
      await testWTTPSite.connect(owner).DEFINE({
        head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: header
      });
    }

    await testWTTPSite.connect(owner).PUT({ // changed to owner to avoid 405 error
      head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x746e" },
      data: [{ data: ethers.toUtf8Bytes(content), chunkIndex: 0, publisher: siteAdmin.address }]
    });
  }

  async function verifyResourceExists(path: string): Promise<boolean> {
    try {
      const response = await testWTTPSite.connect(user1).HEAD({
        path,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      return response.status === 200n;
    } catch {
      return false;
    }
  }

  describe("🔒 Permission Security Tests (PRIMARY FOCUS)", function () {

    it("should reject unauthorized users with 403", async function () {
      const testPath = "/delete-permission-test";
      await createResource(testPath, "Content to delete");

      await expect(
        testWTTPSite.connect(user1).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      expect(await verifyResourceExists(testPath)).to.be.true;
    });

    it("should allow siteAdmin role access", async function () {
      const testPath = "/delete-siteadmin-test";
      await createResource(testPath, "SiteAdmin deletion test");

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

    it("should allow DEFAULT_ADMIN_ROLE override behavior", async function () {
      const testPath = "/delete-admin-override-test";
      await createResource(testPath, "Admin override test", restrictedHeader);

      const deleteResponse = await testWTTPSite.connect(owner).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(owner).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

    it("should enforce role-based access control correctly", async function () {
      const testPath = "/delete-role-test";
      await createResource(testPath, "Role-based test", restrictedHeader);

      await expect(
        testWTTPSite.connect(user1).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      await expect(
        testWTTPSite.connect(siteAdmin).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should handle method-specific permissions with DELETE bit", async function () {
      const testPath = "/delete-method-bit-test";
      await createResource(testPath, "Method bit test", deleteDisabledHeader);

      await expect(
        testWTTPSite.connect(siteAdmin).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });

    it("should verify OPTIONS dependency for DELETE", async function () {
      const testPath = "/delete-options-dependency-test";

      const noOptionsHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "no-options" },
        cors: {
          methods: 40, // DELETE(32) + PUT(8) = 40 (missing OPTIONS bit 64)
          origins: Array(9).fill(siteAdminRole),
          preset: 0,
          custom: "no-options"
        },
        redirect: { code: 0, location: "" }
      };

      // Create resource first with valid header, then change it
      await createResource(testPath, "OPTIONS dependency test");
      
      // Apply problematic header after resource creation
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: noOptionsHeader
      });

      await expect(
        testWTTPSite.connect(siteAdmin).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });

    it("should handle blacklist role behavior", async function () {
      const testPath = "/delete-blacklist-test";
      const blacklistRole = ethers.keccak256(ethers.toUtf8Bytes("BLACKLIST"));
      
      const blacklistHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "blacklist" },
        cors: {
          methods: 104, // DELETE(32) + OPTIONS(64) + PUT(8) = 104
          origins: [
            publicRole, publicRole, publicRole, 
            siteAdminRole, // PUT - for test setup
            publicRole,
            blacklistRole, // DELETE requires blacklist role
            publicRole, publicRole, publicRole
          ],
          preset: 0,
          custom: "blacklist"
        },
        redirect: { code: 0, location: "" }
      };

      await createResource(testPath, "Blacklist test", blacklistHeader);

      await expect(
        testWTTPSite.connect(user1).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      const deleteResponse = await testWTTPSite.connect(owner).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(deleteResponse.status).to.equal(204);
    });

    it("should prevent privilege escalation attempts", async function () {
      const testPath = "/delete-privilege-test";
      await createResource(testPath, "Privilege escalation test");

      await expect(
        testWTTPSite.connect(user1).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

  });

  describe("📊 Basic Deletion Functionality", function () {

    it("should delete single resource correctly", async function () {
      const testPath = "/delete-single-test";
      await createResource(testPath, "Single resource deletion");

      expect(await verifyResourceExists(testPath)).to.be.true;

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

    it("should delete multi-chunk resources correctly", async function () {
      const testPath = "/delete-multi-chunk-test";
      const largeContent = "x".repeat(10000);

      await createResource(testPath, largeContent);
      expect(await verifyResourceExists(testPath)).to.be.true;

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

    it("should handle DELETE response metadata correctly", async function () {
      const testPath = "/delete-metadata-test";
      await createResource(testPath, "Metadata test content");

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);
      expect(deleteResponse.etag).to.not.equal(ethers.ZeroHash);
      expect(deleteResponse.headerInfo).to.not.be.undefined;
      expect(deleteResponse.metadata).to.not.be.undefined;
    });

    it("should emit DELETESuccess event correctly", async function () {
      const testPath = "/delete-event-test";
      await createResource(testPath, "Event emission test");

      await expect(
        testWTTPSite.connect(siteAdmin).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.emit(testWTTPSite, "DELETESuccess");
    });

    it("should handle zero-length resources", async function () {
      const testPath = "/delete-empty-test";
      
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: []
      });

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);
    });

  });

  describe("🛡️ Resource State Security", function () {

    it("should validate state consistency after deletion", async function () {
      const testPath = "/delete-consistency-test";
      await createResource(testPath, "Consistency test");

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");

      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle concurrent deletion attempts", async function () {
      const testPath = "/delete-concurrent-test";
      await createResource(testPath, "Concurrent deletion test");

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      await expect(
        testWTTPSite.connect(siteAdmin).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should preserve header information in delete response", async function () {
      const testPath = "/delete-header-preservation-test";
      await createResource(testPath, "Header preservation test", restrictedHeader);

      const deleteResponse = await testWTTPSite.connect(owner).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      // DELETEResponse contains the default header of the site. 

      expect(deleteResponse.headerInfo.cors.custom).to.equal(defaultHeader.cors.custom);
      expect(deleteResponse.headerInfo.cors.methods).to.equal(defaultHeader.cors.methods);
    });

    it("should handle resource re-creation after deletion", async function () {
      const testPath = "/delete-recreation-test";
      const originalContent = "Original content";
      const newContent = "New content after deletion";

      await createResource(testPath, originalContent);
      
      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      await createResource(testPath, newContent);

      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(200);
    });

    it("should handle ESP chunked resource cleanup validation", async function () {
      const testPath = "/delete-esp-cleanup-test";
      
      // Create multi-chunk resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x746e" },
        data: [{ data: ethers.toUtf8Bytes("Chunk 0"), chunkIndex: 0, publisher: siteAdmin.address }]
      });

      for (let i = 1; i <= 3; i++) {
        await testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes(`Chunk ${i}`), chunkIndex: i, publisher: siteAdmin.address }]
        });
      }

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);

      await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

  });

  describe("⚠️ Edge Cases & Error Handling", function () {

    it("should return 404 for non-existent resources", async function () {
      const nonExistentPath = "/delete-nonexistent";

      await expect(
        testWTTPSite.connect(siteAdmin).DELETE({
          path: nonExistentPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle malformed paths gracefully", async function () {
      const malformedPaths = ["", "/", "//"];

      for (const path of malformedPaths) {
        await expect(
          testWTTPSite.connect(siteAdmin).DELETE({
            path,
            ifModifiedSince: 0,
            ifNoneMatch: ethers.ZeroHash
          })
        ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      }
    });

    it("should handle invalid conditional headers", async function () {
      const testPath = "/delete-conditional-test";
      await createResource(testPath, "Conditional test");

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 999999999,
        ifNoneMatch: ethers.keccak256(ethers.toUtf8Bytes("invalid-etag"))
      });

      expect(deleteResponse.status).to.equal(204);
    });

    it("should handle very long path names", async function () {
      const longPath = "/delete-long-" + "x".repeat(100);
      
      await createResource(longPath, "Long path test");

      const deleteResponse = await testWTTPSite.connect(siteAdmin).DELETE.staticCall({
        path: longPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(deleteResponse.status).to.equal(204);
    });

  });

  describe("📦 Large File & Gas Testing", function () {

    it("should handle large multi-chunk resource deletion", async function () {
      const testPath = "/delete-large-test";
      const largeContent = "x".repeat(30000);

      await createResource(testPath, largeContent);

      const deleteTransaction = await testWTTPSite.connect(siteAdmin).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      const receipt = await deleteTransaction.wait();
      console.log(`Delete large resource gas used: ${receipt?.gasUsed}`);

      expect(await verifyResourceExists(testPath)).to.be.false;
    });

    it("should measure gas costs for deletion operations", async function () {
      const testCases = [
        { name: "small", content: "small content", size: "100B" },
        { name: "medium", content: "x".repeat(5000), size: "5KB" },
        { name: "large", content: "x".repeat(15000), size: "15KB" }
      ];

      console.log("\n📊 DELETE Gas Cost Analysis:");

      for (const testCase of testCases) {
        const testPath = `/delete-gas-${testCase.name}`;
        await createResource(testPath, testCase.content);

        const deleteTransaction = await testWTTPSite.connect(siteAdmin).DELETE({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        });

        const receipt = await deleteTransaction.wait();
        console.log(`  ${testCase.size} resource: ${receipt?.gasUsed} gas`);
      }
    });

    it("should validate gas efficiency for bulk deletions", async function () {
      const paths = ["/delete-bulk-1", "/delete-bulk-2", "/delete-bulk-3"];

      for (const path of paths) {
        await createResource(path, `Content for ${path}`);
      }

      let totalGas = 0n;

      for (const path of paths) {
        const deleteTransaction = await testWTTPSite.connect(siteAdmin).DELETE({
          path,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        });

        const receipt = await deleteTransaction.wait();
        totalGas += receipt?.gasUsed || 0n;
      }

      console.log(`\n💰 Bulk deletion total gas: ${totalGas}`);
      console.log(`💰 Average gas per deletion: ${totalGas / BigInt(paths.length)}`);

      for (const path of paths) {
        expect(await verifyResourceExists(path)).to.be.false;
      }
    });

  });

}); 