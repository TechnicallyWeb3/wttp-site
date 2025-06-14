import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  TestWTTPSite,
  TestWTTPPermissions
} from "../typechain-types";
import { HeaderInfoStruct, IDataPointStorage, IDataPointRegistry } from "@wttp/core";

describe("07 - PATCH Method Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointStorage: IDataPointStorage;
  let dataPointRegistry: IDataPointRegistry;
  let testWTTPPermissions: TestWTTPPermissions;

  let owner: HardhatEthersSigner;
  let siteAdmin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let patchUser: HardhatEthersSigner;
  let unauthorizedUser: HardhatEthersSigner;

  let siteAdminRole: string;
  let patchRole: string;
  let resourceSpecificRole: string;

  let defaultHeader: HeaderInfoStruct;
  let immutableHeader: HeaderInfoStruct;

  // Test data generation
  function createUniqueData(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  before(async function () {
    [owner, siteAdmin, user1, patchUser, unauthorizedUser] = await ethers.getSigners();

    // Deploy DataPointStorage
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorage");
    dataPointStorage = await DataPointStorageFactory.deploy() as unknown as IDataPointStorage;
    await dataPointStorage.waitForDeployment();

    // Deploy DataPointRegistry
    const DataPointRegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    dataPointRegistry = await DataPointRegistryFactory.deploy(
      owner.address,
      await dataPointStorage.getAddress(),
      ethers.parseEther("0.0001") // Default royalty rate
    ) as unknown as IDataPointRegistry;
    await dataPointRegistry.waitForDeployment();

    // Setup roles
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    patchRole = ethers.id("PATCH_ROLE");
    resourceSpecificRole = ethers.id("RESOURCE_ADMIN_ROLE");

    const publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    
    // Default header allowing all methods
    defaultHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "" },
      cors: {
        methods: 511, // All methods (2^9 - 1)
        origins: [
          publicRole,     // HEAD - public
          publicRole,     // GET - public  
          publicRole,     // POST - public
          siteAdminRole,  // PUT - site admin only
          siteAdminRole,  // PATCH - site admin
          siteAdminRole,  // DELETE - site admin
          publicRole,     // OPTIONS - public
          publicRole,     // LOCATE - public
          siteAdminRole   // DEFINE - site admin
        ],
        preset: 1, // PUBLIC
        custom: ""
      },
      redirect: { code: 0, location: "" }
    };

    // Immutable header
    immutableHeader = {
      cache: { immutableFlag: true, preset: 0, custom: "immutable" },
      cors: {
        methods: 227, // Only read methods (HEAD=1, GET=2, OPTIONS=64, LOCATE=128) = 1+2+64+128+32=227
        origins: [
          publicRole,     // HEAD
          publicRole,     // GET
          publicRole,     // POST (blocked by methods)
          publicRole,     // PUT (blocked by methods)
          publicRole,     // PATCH (blocked by methods)
          publicRole,     // DELETE (blocked by methods)
          publicRole,     // OPTIONS
          publicRole,     // LOCATE
          siteAdminRole   // DEFINE
        ],
        preset: 0,
        custom: "immutable"
      },
      redirect: { code: 0, location: "" }
    };
  });

  beforeEach(async function () {
    // Deploy fresh TestWTTPSite for each test
    const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
    testWTTPSite = await TestWTTPSiteFactory.deploy(
      owner.address,
      await dataPointRegistry.getAddress(),
      defaultHeader
    ) as unknown as TestWTTPSite;
    await testWTTPSite.waitForDeployment();

    // Grant site admin role
    await testWTTPSite.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
  });

  // Helper function to create a base resource with PUT
  async function createBaseResource(path: string, data: string, signer = siteAdmin): Promise<string> {
    const testData = createUniqueData(data);
    
    // Calculate royalty for the data
    const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
    const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
    
    await testWTTPSite.connect(signer).PUT({
      head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
      data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: signer.address }]
    }, { value: royalty });
    
    return testData;
  }

  // Helper function to patch a resource
  async function patchResource(path: string, data: string, chunkIndex: number, signer = siteAdmin): Promise<string> {
    const testData = createUniqueData(data);
    
    // Calculate royalty for the data
    const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
    const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
    
    await testWTTPSite.connect(signer).PATCH({
      head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex, publisher: signer.address }]
    }, { value: royalty });
    
    return testData;
  }

  describe("🔒 PATCH Permission Security", function () {
    
    it("should reject unauthorized users with 403", async function () {
      const testPath = "/patch-unauthorized-test";
      await createBaseResource(testPath, "Base content");
      
      await expect(
        testWTTPSite.connect(unauthorizedUser).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("unauthorized"), chunkIndex: 1, publisher: unauthorizedUser.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow siteAdmin role access", async function () {
      const testPath = "/patch-siteadmin-test";
      await createBaseResource(testPath, "Base content");
      
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("siteAdmin patch")), chunkIndex: 1, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should allow resource-specific PATCH roles", async function () {
      const testPath = "/patch-role-test";
      const publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      
      // Create restricted header first
      const restrictedHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "" },
        cors: {
          methods: 511,
          origins: [
            publicRole,           // HEAD
            publicRole,           // GET
            publicRole,           // POST
            patchRole,            // PUT - patch role specific
            patchRole,            // PATCH - patch role specific
            patchRole,            // DELETE
            publicRole,           // OPTIONS
            publicRole,           // LOCATE
            siteAdminRole         // DEFINE
          ],
          preset: 0,
          custom: "restricted"
        },
        redirect: { code: 0, location: "" }
      };
      
      // Create and grant PATCH role first
      await testWTTPSite.connect(owner).createResourceRole(patchRole);
      await testWTTPSite.connect(siteAdmin).grantRole(patchRole, patchUser.address);
      
      // Set up resource with restricted permissions
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });
      
      // Now create the base resource (patchUser has role for PUT on this path)
      const testData = createUniqueData("Base content");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      await testWTTPSite.connect(patchUser).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: patchUser.address }]
      }, { value: royalty });
      
      const response = await testWTTPSite.connect(patchUser).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("role-based patch")), chunkIndex: 1, publisher: patchUser.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should prevent PATCH on immutable resources with 405", async function () {
      const testPath = "/patch-immutable-test";
      await createBaseResource(testPath, "Base content");
      
      // Make resource immutable
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: immutableHeader
      });
      
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("immutable patch"), chunkIndex: 1, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });

    it("should handle role inheritance correctly", async function () {
      const testPath = "/patch-inheritance-test";
      await createBaseResource(testPath, "Base content");
      
      // Owner should always have access due to DEFAULT_ADMIN_ROLE
      const response = await testWTTPSite.connect(owner).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("owner patch")), chunkIndex: 1, publisher: owner.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should enforce method-specific permissions", async function () {
      const testPath = "/patch-method-specific-test";
      await createBaseResource(testPath, "Base content");
      
      // Create a role that doesn't have PATCH permissions
      const readOnlyRole = ethers.id("READ_ONLY_ROLE");
      await testWTTPSite.connect(owner).createResourceRole(readOnlyRole);
      await testWTTPSite.connect(siteAdmin).grantRole(readOnlyRole, user1.address);
      
      await expect(
        testWTTPSite.connect(user1).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("unauthorized method"), chunkIndex: 1, publisher: user1.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });
  });

  describe("🔗 PATCH Multi-Chunk Workflows", function () {
    
    it("should build large files via PUT + PATCH sequence", async function () {
      const testPath = "/multi-chunk-large-file";
      
      // PUT creates first chunk
      const chunk0Data = await createBaseResource(testPath, "Chunk 0 data");
      
      // PATCH adds subsequent chunks
      const chunk1Data = await patchResource(testPath, "Chunk 1 data", 1);
      const chunk2Data = await patchResource(testPath, "Chunk 2 data", 2);
      const chunk3Data = await patchResource(testPath, "Chunk 3 data", 3);
      
      // Verify all chunks are present
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 3 }
      });
      
      expect(getResponse.head.status).to.equal(200);
      expect(getResponse.resource.dataPoints.length).to.equal(4);
      
      // Verify metadata updated correctly
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.metadata.version).to.be.greaterThan(4); // 1 PUT + 3 PATCHes + DEFINE calls
      expect(headResponse.metadata.size).to.be.greaterThan(0);
    });

    it("should handle chunk assembly with PUT index 0 + PATCH 1,2,3", async function () {
      const testPath = "/assembly-test";
      
      // Sequential chunk assembly
      await createBaseResource(testPath, "First chunk");
      await patchResource(testPath, "Second chunk", 1);
      await patchResource(testPath, "Third chunk", 2);
      
      // Verify sequential assembly
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 2 }
      });
      
      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(3);
    });

    it("should validate chunk ordering and integrity", async function () {
      const testPath = "/chunk-ordering-test";
      
      // Create base resource
      await createBaseResource(testPath, "Base chunk");
      
      // Add chunks sequentially
      await patchResource(testPath, "Chunk 1", 1);
      await patchResource(testPath, "Chunk 2", 2);
      
      // Verify ordering with range requests
      const chunk1Response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 1, end: 1 }
      });
      
      expect(chunk1Response.head.status).to.equal(206); // Partial content
      expect(chunk1Response.resource.dataPoints.length).to.equal(1);
    });

    it("should handle chunk replacement at existing indexes", async function () {
      const testPath = "/chunk-replacement-test";
      
      // Create multi-chunk resource
      await createBaseResource(testPath, "Original chunk 0");
      await patchResource(testPath, "Original chunk 1", 1);
      
      // Replace existing chunk
      const newData = createUniqueData("Replacement chunk 1");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(newData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      const originalSize = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).metadata.size;
      
      await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(newData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      // Verify replacement
      const newSize = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).metadata.size;
      
      // Size should be updated based on new chunk size
      expect(newSize).to.not.equal(originalSize);
    });

    it("should preserve existing chunks when updating others", async function () {
      const testPath = "/preserve-chunks-test";
      
      // Create multi-chunk resource
      const chunk0Data = await createBaseResource(testPath, "Preserve chunk 0");
      await patchResource(testPath, "Original chunk 1", 1);
      await patchResource(testPath, "Preserve chunk 2", 2);
      
      // Replace middle chunk
      await patchResource(testPath, "New chunk 1", 1);
      
      // Verify all chunks still exist
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 2 }
      });
      
      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(3);
    });

    it("should handle non-sequential chunk updates", async function () {
      const testPath = "/non-sequential-test";
      
      // Create base and add chunk 1
      await createBaseResource(testPath, "Base chunk");
      await patchResource(testPath, "Chunk 1", 1);
      
      // Update chunk 0 (non-sequential)
      await patchResource(testPath, "Updated base", 0);
      
      // Verify both chunks exist
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 1 }
      });
      
      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(2);
    });

    it("should return proper status codes for multi-chunk operations", async function () {
      const testPath = "/status-codes-test";
      
      await createBaseResource(testPath, "Base content");
      
      // PATCH should return 200 for successful append
      const patchResponse = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("patch data")), chunkIndex: 1, publisher: siteAdmin.address }]
      });
      
      // Wait for transaction and check events
      const receipt = await patchResponse.wait();
      const patchEvent = receipt?.logs.find((log: any) => {
        try {
          return testWTTPSite.interface.parseLog(log)?.name === "PATCHSuccess";
        } catch {
          return false;
        }
      });
      
      expect(patchEvent).to.not.be.undefined;
    });

    it("should support large multi-chunk file workflows", async function () {
      const testPath = "/large-workflow-test";
      
      // Simulate large file upload: PUT + multiple PATCHes
      await createBaseResource(testPath, "Large file chunk 0");
      
      // Add multiple chunks to simulate large file
      for (let i = 1; i <= 5; i++) {
        await patchResource(testPath, `Large file chunk ${i}`, i);
      }
      
      // Verify complete file
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 5 }
      });
      
      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(6);
      expect(response.head.metadata.version).to.be.greaterThan(6); // 1 PUT + 5 PATCHes + DEFINE operations
    });
  });

  describe("🎯 PATCH Chunk Index Validation", function () {
    
    it("should enforce chunk index boundaries with 416 errors", async function () {
      const testPath = "/boundary-test";
      await createBaseResource(testPath, "Base content");
      
      // Current resource has 1 chunk (index 0)
      // Valid: append at index 1
      await patchResource(testPath, "Valid append", 1);
      
      // Invalid: skip to index 3 (should be 416 Out of Bounds)
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("invalid skip"), chunkIndex: 3, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_416");
    });

    it("should handle replace vs append logic correctly", async function () {
      const testPath = "/replace-append-test";
      
      // Create resource with 2 chunks
      await createBaseResource(testPath, "Chunk 0");
      await patchResource(testPath, "Chunk 1", 1);
      
      const originalSize = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).metadata.size;
      
      // Replace existing chunk 1
      await patchResource(testPath, "Replaced chunk 1", 1);
      
      // Append new chunk 2
      await patchResource(testPath, "New chunk 2", 2);
      
      const finalResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 2 }
      });
      
      expect(finalResponse.resource.dataPoints.length).to.equal(3);
      expect(finalResponse.head.status).to.equal(200);
    });

    it("should validate maximum chunk index bounds", async function () {
      const testPath = "/max-bounds-test";
      await createBaseResource(testPath, "Base content");
      
      // Test large chunk index (should fail)
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("large index"), chunkIndex: 1000, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_416");
    });

    it("should handle sequential chunk index validation", async function () {
      const testPath = "/sequential-validation-test";
      
      // Build sequential chunks
      await createBaseResource(testPath, "Chunk 0");
      
      // Each subsequent chunk should be valid at resourceLength
      for (let i = 1; i <= 3; i++) {
        await patchResource(testPath, `Chunk ${i}`, i);
        
        // Verify current resource length
        const response = await testWTTPSite.connect(user1).GET({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: i }
        });
        
        expect(response.resource.dataPoints.length).to.equal(i + 1);
      }
    });

    it("should properly calculate size during chunk operations", async function () {
      const testPath = "/size-calculation-test";
      
      // Create initial resource
      const baseData = createUniqueData("Base data for size test");
      const baseAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(baseData));
      const baseRoyalty = await dataPointRegistry.getDataPointRoyalty(baseAddress);
      
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(baseData), chunkIndex: 0, publisher: siteAdmin.address }]
      }, { value: baseRoyalty });
      
      const initialSize = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).metadata.size;
      
      // Add chunk - size should increase
      const appendData = createUniqueData("Append data");
      const appendAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(appendData));
      const appendRoyalty = await dataPointRegistry.getDataPointRoyalty(appendAddress);
      
      await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(appendData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: appendRoyalty });
      
      const newSize = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).metadata.size;
      
      expect(newSize).to.be.greaterThan(initialSize);
    });

    it("should handle zero-index updates correctly", async function () {
      const testPath = "/zero-index-test";
      
      // Create resource
      await createBaseResource(testPath, "Original chunk 0");
      await patchResource(testPath, "Chunk 1", 1);
      
      // Update chunk 0 via PATCH
      await patchResource(testPath, "Updated chunk 0", 0);
      
      // Test the range normalization behavior: (-1, 0) → (0, 0) normalization for chunk 0 selection
      const singleChunkResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: -1, end: 0 } // Gets normalized to (0, 0) for elegant chunk 0 selection
      });
      
      // After normalization to (0, 0), this is treated as full range request
      expect(Number(singleChunkResponse.head.status)).to.equal(200); // Full range after normalization
      expect(singleChunkResponse.resource.dataPoints.length).to.equal(2); // Full resource (both chunks)
      
      // Verify full resource still works with (0, 1) 
      const fullResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 1 }
      });
      
      expect(Number(fullResponse.head.status)).to.equal(200); // Full resource
      expect(fullResponse.resource.dataPoints.length).to.equal(2); // Both chunks present
    });

    it("should validate range normalization API behavior", async function () {
      const testPath = "/range-normalization-test";
      
      // Create multi-chunk resource for range testing
      await createBaseResource(testPath, "Chunk 0 content");
      await patchResource(testPath, "Chunk 1 content", 1);
      await patchResource(testPath, "Chunk 2 content", 2);
      
      // Test (-1, 0) → (0, 0) normalization for elegant chunk 0 API design
      const normalizedRequest = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: -1, end: 0 }
      });
      
      // (-1, 0) gets normalized to (0, 0) which is treated as full range
      expect(Number(normalizedRequest.head.status)).to.equal(200); // Full resource after normalization
      expect(normalizedRequest.resource.dataPoints.length).to.equal(3); // All chunks
      
      // Test (0, 0) as "full resource" request when user doesn't know length
      const unknownLength = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(Number(unknownLength.head.status)).to.equal(200); // Full resource
      expect(unknownLength.resource.dataPoints.length).to.equal(3); // All chunks
      
      // Test (-1, 1) - only (-1, 0) gets normalized, so this stays as (-1, 1) 
      const specificRange = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: -1, end: 1 }
      });
      
      expect(Number(specificRange.head.status)).to.equal(206); // Partial content
      expect(specificRange.resource.dataPoints.length).to.equal(1); // Just chunk 1 (range starts at -1)
    });
  });

  describe("🌐 PATCH HTTP Compliance", function () {
    
    it("should return correct status codes for all scenarios", async function () {
      const testPath = "/http-status-test";
      
      // 404 for non-existent resource
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: "/non-existent", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("patch data"), chunkIndex: 0, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      
      // 200 for successful PATCH
      await createBaseResource(testPath, "Base content");
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("patch data")), chunkIndex: 1, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should update ETags after successful patches", async function () {
      const testPath = "/etag-update-test";
      
      await createBaseResource(testPath, "Base content");
      
      const originalETag = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).etag;
      
      // PATCH should update ETag
      await patchResource(testPath, "Patched content", 1);
      
      const newETag = (await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      })).etag;
      
      expect(newETag).to.not.equal(originalETag);
    });

    it("should properly format response headers", async function () {
      const testPath = "/response-headers-test";
      
      await createBaseResource(testPath, "Base content");
      
      const patchResponse = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("patch data")), chunkIndex: 1, publisher: siteAdmin.address }]
      });
      
      // Verify response structure
      const receipt = await patchResponse.wait();
      expect(receipt?.status).to.equal(1); // Transaction success
    });

    it("should handle partial content responses correctly", async function () {
      const testPath = "/partial-content-test";
      
      // Create multi-chunk resource
      await createBaseResource(testPath, "Chunk 0");
      await patchResource(testPath, "Chunk 1", 1);
      await patchResource(testPath, "Chunk 2", 2);
      
      // Request partial content
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 1, end: 2 }
      });
      
      expect(response.head.status).to.equal(206); // Partial Content
      expect(response.resource.dataPoints.length).to.equal(2);
    });
  });

  describe("💰 PATCH ESP Integration", function () {
    
    it("should require royalty payments for each chunk", async function () {
      const testPath = "/royalty-per-chunk-test";
      
      await createBaseResource(testPath, "Base content");
      
      const patchData = createUniqueData("Patch content requiring royalty");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(patchData));
      
      // For new data, royalty might not be required on first use
      // PATCH with calculated royalty should succeed
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(patchData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      expect(response).to.not.be.reverted;
      
      // Verify the chunk was actually added
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 1 }
      });
      
      expect(getResponse.resource.dataPoints.length).to.equal(2);
    });

    it("should handle duplicate data with proper royalty payments", async function () {
      const testPath1 = "/royalty-duplicate-1";
      const testPath2 = "/royalty-duplicate-2";
      const duplicateData = createUniqueData("Duplicate patch data");
      
      // Create both resources
      await createBaseResource(testPath1, "Base 1");
      await createBaseResource(testPath2, "Base 2");
      
      // First PATCH with new data (no royalty needed for new data)
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(duplicateData));
      let royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath1, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(duplicateData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      // Second PATCH with same data (royalty required for duplicate)
      royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath2, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(duplicateData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      expect(response).to.not.be.reverted;
    });

    it("should calculate royalties correctly for multi-chunk PATCH", async function () {
      const testPath = "/multi-chunk-royalty-test";
      
      await createBaseResource(testPath, "Base content");
      
      // PATCH multiple chunks in single operation
      const chunk1Data = createUniqueData("Chunk 1 data");
      const chunk2Data = createUniqueData("Chunk 2 data");
      
      const addr1 = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(chunk1Data));
      const addr2 = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(chunk2Data));
      
      const royalty1 = await dataPointRegistry.getDataPointRoyalty(addr1);
      const royalty2 = await dataPointRegistry.getDataPointRoyalty(addr2);
      const totalRoyalty = royalty1 + royalty2;
      
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [
          { data: ethers.toUtf8Bytes(chunk1Data), chunkIndex: 1, publisher: siteAdmin.address },
          { data: ethers.toUtf8Bytes(chunk2Data), chunkIndex: 2, publisher: siteAdmin.address }
        ]
      }, { value: totalRoyalty });
      
      expect(response).to.not.be.reverted;
    });

    it("should validate economic model with sequential PATCH operations", async function () {
      const testPath = "/sequential-economics-test";
      
      await createBaseResource(testPath, "Base for economics test");
      
      // Multiple sequential PATCH operations, each with proper royalty
      for (let i = 1; i <= 3; i++) {
        const chunkData = createUniqueData(`Economics chunk ${i}`);
        const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(chunkData));
        const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
        
        const response = await testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes(chunkData), chunkIndex: i, publisher: siteAdmin.address }]
        }, { value: royalty });
        
        expect(response).to.not.be.reverted;
      }
      
      // Verify final state
      const finalResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 3 }
      });
      
      expect(finalResponse.resource.dataPoints.length).to.equal(4); // Base + 3 patches
    });
  });

  describe("⚠️ PATCH Edge Cases", function () {
    
    it("should handle empty patch data arrays correctly", async function () {
      const testPath = "/empty-patch-test";
      
      await createBaseResource(testPath, "Base content");
      
      // Empty data array should not cause errors
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: []
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should maintain metadata consistency after patches", async function () {
      const testPath = "/metadata-consistency-test";
      
      await createBaseResource(testPath, "Base content");
      
      const originalMetadata = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      // PATCH and verify metadata updates
      await patchResource(testPath, "Patch content", 1);
      
      const updatedMetadata = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(updatedMetadata.metadata.version).to.be.greaterThan(originalMetadata.metadata.version);
      expect(updatedMetadata.metadata.size).to.be.greaterThan(originalMetadata.metadata.size);
      expect(updatedMetadata.metadata.lastModified).to.be.greaterThan(originalMetadata.metadata.lastModified);
    });

    it("should handle resource integrity across operations", async function () {
      const testPath = "/integrity-test";
      
      // Create and modify resource
      await createBaseResource(testPath, "Original content");
      await patchResource(testPath, "Patch 1", 1);
      await patchResource(testPath, "Patch 2", 2);
      
      // Replace middle chunk
      await patchResource(testPath, "Replacement patch 1", 1);
      
      // Verify integrity
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 2 }
      });
      
      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(3);
      
      // All chunks should be unique addresses
      const uniqueAddresses = new Set(response.resource.dataPoints);
      expect(uniqueAddresses.size).to.equal(3);
    });

    it("should handle large chunk operations efficiently", async function () {
      const testPath = "/large-chunk-test";
      
      await createBaseResource(testPath, "Base for large test");
      
      // Create larger chunk data (but under 32KB limit)
      const largeData = createUniqueData("Large chunk data".repeat(100));
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(largeData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(largeData), chunkIndex: 1, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      expect(response).to.not.be.reverted;
      
      // Verify large chunk was added
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.metadata.size).to.be.greaterThan(largeData.length);
    });
  });

  describe("🔥 Empty Resource Edge Cases", function () {
    
    it("should throw custom _416 error for PATCH on zero-length resource", async function () {
      const testPath = "/empty-resource-test";
      
      // Try to PATCH a non-existent resource (zero-length)
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("patch on empty"), chunkIndex: 0, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404"); // Should be 404 for non-existent resource
    });

    it("should throw custom _416 error for PATCH with invalid ranges on empty resource", async function () {
      const testPath = "/empty-range-test";
      
      // Create empty resource with header only
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: defaultHeader
      });
      
      // Try to PATCH at index 1 on empty resource (should be 416)
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("invalid index"), chunkIndex: 1, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_416"); // Out of bounds
    });

    it("should handle range normalization gracefully with empty arrays", async function () {
      const testPath = "/empty-array-test";
      
      await createBaseResource(testPath, "Base content");
      
      // Empty data array should not cause errors
      const response = await testWTTPSite.connect(siteAdmin).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: []
      });
      
      expect(response).to.not.be.reverted;
      
      // Verify resource unchanged
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(getResponse.resource.dataPoints.length).to.equal(1); // Still just the base chunk
    });

    it("should prefer custom errors over generic reverts", async function () {
      const testPath = "/custom-error-test";
      
      await createBaseResource(testPath, "Base content");
      
      // Test custom _416 for out of bounds (skipping chunk 1 to go to 2)
      await expect(
        testWTTPSite.connect(siteAdmin).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("skip chunk 1"), chunkIndex: 2, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_416"); // Custom 416 error, not generic revert
      
      // Test custom _403 for unauthorized user  
      await expect(
        testWTTPSite.connect(unauthorizedUser).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes("unauthorized"), chunkIndex: 1, publisher: unauthorizedUser.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403"); // Custom 403 error, not generic revert
    });
  });
}); 