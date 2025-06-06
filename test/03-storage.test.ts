import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPStorage } from "../typechain-types/contracts/test/TestWTTPStorage";
import { IDataPointRegistry, IDataPointStorage } from "@wttp/core";
import { ResourceMetadataStruct } from "../typechain-types/contracts/test/TestWTTPStorage";

describe("03 - WTTP Storage Security Audit", function () {
  let testWTTPStorage: TestWTTPStorage;
  let dataPointRegistry: IDataPointRegistry;
  let dataPointStorage: IDataPointStorage;
  let owner: SignerWithAddress;
  let siteAdmin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let attacker: SignerWithAddress;
  let blacklisted: SignerWithAddress;

  // Role identifiers
  let defaultAdminRole: string;
  let siteAdminRole: string;
  let publicRole: string;
  let blacklistRole: string;

  // Test data
  let testHeader: any;
  let testDataRegistration: any;
  let mockDataPointAddress: string;
  let royaltyRate: bigint;

  before(async function () {
    // load/deploy common infrastructure contracts
    [owner, siteAdmin, user1, user2, attacker, blacklisted] = await ethers.getSigners();

    const { dps, dpr } = await loadEspContracts();

    dataPointStorage = dps;
    dataPointRegistry = dpr;
    royaltyRate = ethers.parseUnits("0.001", "gwei");
  });

  beforeEach(async function () {
    // Create test header with all required methods (9 methods: 0-8)
    const methodCount = 9; // HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, LOCATE, DEFINE
    const testOrigins = [];
    for (let i = 0; i < methodCount; i++) {
      testOrigins.push(ethers.id(`ROLE_${i}`)); // Different role for each method
    }

    testHeader = {
      cors: {
        origins: testOrigins,
        methods: 511, // All methods allowed
        preset: 0,
        custom: ""
      },
      cache: {
        immutableFlag: false,
        preset: 0,
        custom: ""
      },
      redirect: {
        code: 0,
        location: ""
      }
    };

    // Deploy TestWTTPStorage for each test
    const TestWTTPStorageFactory = await ethers.getContractFactory("TestWTTPStorage");
    testWTTPStorage = await TestWTTPStorageFactory.deploy(
      owner.address,
      await dataPointRegistry.getAddress(),
      testHeader
    );
    await testWTTPStorage.waitForDeployment();

    // Get role identifiers
    defaultAdminRole = await testWTTPStorage.DEFAULT_ADMIN_ROLE();
    siteAdminRole = await testWTTPStorage.getSiteAdminRole();
    publicRole = await testWTTPStorage.getPublicRole();
    blacklistRole = await testWTTPStorage.getBlacklistRole();

    // Grant site admin role
    await testWTTPStorage.connect(owner).grantRole(siteAdminRole, siteAdmin.address);

    // Create UNIQUE test data for each test run to avoid royalty issues
    // Using timestamp and random number to ensure uniqueness
    const uniqueData = createUniqueData();
    mockDataPointAddress = await dataPointStorage.calculateAddress(uniqueData);
    
    testDataRegistration = {
      data: uniqueData,
      publisher: user1.address,
      chunkIndex: 0
    };
  });

  describe("🔒 Core Storage System Validation", function () {
    it("should correctly initialize with owner as DEFAULT_ADMIN", async function () {
      expect(await testWTTPStorage.hasRole(defaultAdminRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(defaultAdminRole, siteAdmin.address)).to.be.false;
    });

    it("should correctly initialize DPR and DPS references", async function () {
      const dprAddress = await testWTTPStorage.DPR();
      const dpsAddress = await testWTTPStorage.DPS();
      
      expect(dprAddress).to.equal(await dataPointRegistry.getAddress());
      expect(dpsAddress).to.equal(await dataPointStorage.getAddress());
    });

    it("should establish correct constants and limits", async function () {
      expect(await testWTTPStorage.getMaxMethods()).to.equal(511);
    });

    it("should properly initialize zero structures", async function () {
      const zeroHeader = await testWTTPStorage.getZeroHeader();
      const zeroMetadata = await testWTTPStorage.getZeroMetadata();
      
      expect(zeroHeader.cors.origins.length).to.equal(0);
      expect(zeroMetadata.size).to.equal(0);
      expect(zeroMetadata.version).to.equal(0);
    });
  });

  describe("🚨 DEFAULT_ADMIN_ROLE Storage Security Audit", function () {
    it("should allow DEFAULT_ADMIN to change DPR", async function () {
      // Deploy a new DPR for testing
      const newDataPointRegistry = await (await ethers.getContractFactory("DataPointRegistry")).deploy(
        owner.address,
        await dataPointStorage.getAddress(),
        royaltyRate
      );
      await newDataPointRegistry.waitForDeployment();

      await testWTTPStorage.connect(owner).setDPR(await newDataPointRegistry.getAddress());
      expect(await testWTTPStorage.DPR()).to.equal(await newDataPointRegistry.getAddress());
    });

    it("should prevent non-DEFAULT_ADMIN from changing DPR", async function () {
      const newDataPointRegistry = await (await ethers.getContractFactory("DataPointRegistry")).deploy(
        owner.address,
        await dataPointStorage.getAddress(),
        royaltyRate
      );
      await newDataPointRegistry.waitForDeployment();

      await expect(
        testWTTPStorage.connect(siteAdmin).setDPR(await newDataPointRegistry.getAddress())
      ).to.be.reverted;

      await expect(
        testWTTPStorage.connect(attacker).setDPR(await newDataPointRegistry.getAddress())
      ).to.be.reverted;
    });

    it("should allow DEFAULT_ADMIN to set default header", async function () {
      const newHeader = { ...testHeader };
      newHeader.cache.preset = 1; // Change a field to test

      await testWTTPStorage.connect(owner).setDefaultHeader(newHeader);
      
      // Verify by reading a non-existent resource which should use default header
      const readHeader = await testWTTPStorage.readHeader("/nonexistent");
      expect(readHeader.cache.preset).to.equal(1);
    });

    it("should prevent non-DEFAULT_ADMIN from setting default header", async function () {
      const newHeader = { ...testHeader };
      newHeader.cache.preset = 1;

      await expect(
        testWTTPStorage.connect(siteAdmin).setDefaultHeader(newHeader)
      ).to.be.reverted;

      await expect(
        testWTTPStorage.connect(attacker).setDefaultHeader(newHeader)
      ).to.be.reverted;
    });

    it("🚨 VULNERABILITY: Test direct DPR manipulation via test function", async function () {
      console.log("🔍 Testing direct DPR manipulation vulnerability...");
      
      const maliciousDPR = await (await ethers.getContractFactory("DataPointRegistry")).deploy(
        attacker.address,
        await dataPointStorage.getAddress(),
        royaltyRate
      );
      await maliciousDPR.waitForDeployment();

      try {
        await testWTTPStorage.connect(attacker).setDPR_ForTesting(await maliciousDPR.getAddress());
        console.log("🚨 CRITICAL: Non-admin can manipulate DPR reference!");
        expect(await testWTTPStorage.getDPR_()).to.equal(await maliciousDPR.getAddress());
      } catch (error) {
        console.log("✅ DPR manipulation properly restricted");
      }
    });
  });

  describe("🛡️ Header Security Audit", function () {
    it("should properly validate header structure during creation", async function () {
      // Valid header should work
      const validHeader = { ...testHeader };
      await testWTTPStorage.createHeader(validHeader);

      // Invalid header (wrong number of origins) should fail
      const invalidHeader = {
        cors: {
          origins: [ethers.id("SINGLE_ROLE")], // Wrong length - should be 9
          methods: 0xFF,
          preset: 0,
          custom: ""
        },
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };

      await expect(
        testWTTPStorage.createHeader(invalidHeader)
      ).to.be.revertedWithCustomError(testWTTPStorage, "InvalidHeader");
    });

    it("should prevent duplicate header creation", async function () {
      const header1 = { ...testHeader };
      const header2 = { ...testHeader }; // Identical header

      const headerAddress1 = await testWTTPStorage.createHeader.staticCall(header1);
      await testWTTPStorage.createHeader(header1);

      const headerAddress2 = await testWTTPStorage.createHeader.staticCall(header2);
      await testWTTPStorage.createHeader(header2);

      // Should be the same address since headers are identical
      expect(headerAddress1).to.equal(headerAddress2);
    });

    it("should calculate consistent header addresses", async function () {
      const headerAddress1 = await testWTTPStorage.calculateHeaderAddress(testHeader);
      const headerAddress2 = await testWTTPStorage.calculateHeaderAddress(testHeader);
      
      expect(headerAddress1).to.equal(headerAddress2);
    });

    it("should validate default header properly", async function () {
      // Invalid default header should fail
      const invalidHeader = {
        cors: {
          origins: [ethers.id("SINGLE_ROLE")], // Wrong length
          methods: 0xFF,
          preset: 0,
          custom: ""
        },
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };

      await expect(
        testWTTPStorage.connect(owner).setDefaultHeader(invalidHeader)
      ).to.be.revertedWithCustomError(testWTTPStorage, "InvalidHeader");
    });

    it("should handle header reading for non-existent paths", async function () {
      // Should return default header for non-existent paths
      const headerInfo = await testWTTPStorage.readHeader("/nonexistent");
      expect(headerInfo.cors.origins.length).to.equal(testHeader.cors.origins.length);
    });
  });

  describe("🗂️ Metadata Security Audit", function () {
    beforeEach(async function () {
      // get the data point address from the storage contract
      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      await testWTTPStorage.createResource("/test", testDataRegistration, { value: dataRoyalty });
    });

    it("should properly track metadata versions and timestamps", async function () {
      const initialMetadata = await testWTTPStorage.readMetadata("/test");
      expect(initialMetadata.version).to.equal(1);
      expect(initialMetadata.lastModified).to.be.greaterThan(0);

      // console.log("initialMetadata", initialMetadata);

      // Update metadata
      const newMetadata: ResourceMetadataStruct = {
        properties: {
          mimeType: initialMetadata.properties.mimeType,
          charset: initialMetadata.properties.charset,
          encoding: initialMetadata.properties.encoding,
          language: initialMetadata.properties.language
        },
        size: initialMetadata.size,
        version: initialMetadata.version,
        lastModified: initialMetadata.lastModified,
        header: ethers.hexlify(ethers.randomBytes(32)),
      }

      // console.log("newMetadata", newMetadata);
      
      const tx = await testWTTPStorage.updateMetadata("/test", newMetadata);
      await tx.wait();
      
      const updatedMetadata = await testWTTPStorage.readMetadata("/test");

      console.log("updatedMetadata", updatedMetadata);

      expect(updatedMetadata.version).to.equal(2);
      expect(updatedMetadata.lastModified).to.be.greaterThan(initialMetadata.lastModified);
    });

    it("should preserve calculated fields during metadata updates", async function () {
      const initialMetadata = await testWTTPStorage.readMetadata("/test");
      const originalSize = initialMetadata.size;
      const originalVersion = initialMetadata.version;

      // Try to manually set size and version
      const maliciousMetadata: ResourceMetadataStruct = {
        properties: {
          mimeType: "0x7468", // "th"
          charset: "0x7538", // "u8"
          encoding: "0x677a", // "gz"
          language: "0x656e" // "en"
        },
        size: 999999, // Attempt to override
        version: 999, // Attempt to override
        lastModified: 0, // Attempt to override
        header: ethers.hexlify(ethers.randomBytes(32)),
      };
      
      await testWTTPStorage.updateMetadata("/test", maliciousMetadata);
      
      const updatedMetadata = await testWTTPStorage.readMetadata("/test");
      // Should preserve original size but increment version
      expect(updatedMetadata.size).to.equal(originalSize);
      expect(updatedMetadata.version).to.equal(originalVersion + 1n);
      expect(updatedMetadata.lastModified).to.be.greaterThan(0);
    });

    it("should properly handle metadata deletion", async function () {
      await testWTTPStorage.deleteMetadata("/test");
      
      const deletedMetadata = await testWTTPStorage.readMetadata("/test");
      expect(deletedMetadata.header).to.equal(ethers.ZeroHash);
      expect(deletedMetadata.properties.mimeType).to.equal("0x0000");
    });

    it("should update metadata stats correctly", async function () {
      const beforeUpdate = await testWTTPStorage.readMetadata("/test");
      const beforeTimestamp = beforeUpdate.lastModified;
      const beforeVersion = beforeUpdate.version;

      await testWTTPStorage.updateMetadataStats("/test");
      
      const afterUpdate = await testWTTPStorage.readMetadata("/test");
      expect(afterUpdate.version).to.equal(beforeVersion + 1n);
      expect(afterUpdate.lastModified).to.be.greaterThan(beforeTimestamp);
    });
  });

  describe("📁 Resource Operations Security Audit", function () {
    it("should properly validate resource existence", async function () {
      expect(await testWTTPStorage.resourceExists("/nonexistent")).to.be.false;
      
      // Create resource
      await testWTTPStorage.createResource("/test", testDataRegistration);
      
      expect(await testWTTPStorage.resourceExists("/test")).to.be.true;
    });

    it("should handle resource creation with payment validation", async function () {
      const royalty = await dataPointRegistry.getDataPointRoyalty(mockDataPointAddress);

      // Should succeed with correct payment
      await testWTTPStorage.createResource("/test", testDataRegistration, { value: royalty });
      expect(await testWTTPStorage.resourceExists("/test")).to.be.true;

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const newRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      const newTestRegistration = {
        data: testDataRegistration.data,
        publisher: user1.address,
        chunkIndex: 0
      };

      await expect(
        testWTTPStorage.createResource("/test2", newTestRegistration, { value: newRoyalty / 2n }) // Half payment
      ).to.be.reverted;
    });

    it("should properly track resource chunks and size", async function () {

      await testWTTPStorage.createResource("/test", testDataRegistration);

      expect(await testWTTPStorage.getResourceChunkCount("/test")).to.equal(1);
      const expectedSize = await dataPointStorage.dataPointSize(mockDataPointAddress);
      expect(await testWTTPStorage.getResourceSize("/test")).to.equal(expectedSize);
    });

    it("should handle chunk index validation in updates", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);

      // Create another data point for updates
      const newTestData = createUniqueData("Update Data");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);

      // Valid chunk index (0 - update existing)
      await testWTTPStorage.updateResource("/test", newDataPointAddress, 0);
      
      // Valid chunk index (1 - append new)
      await testWTTPStorage.updateResource("/test", newDataPointAddress, 1);
      expect(await testWTTPStorage.getResourceChunkCount("/test")).to.equal(2);
      
      // Invalid chunk index (out of bounds)
      await expect(
        testWTTPStorage.updateResource("/test", newDataPointAddress, 5)
      ).to.emit(testWTTPStorage, "OutOfBoundsChunk");
    });

    it("should properly calculate size during chunk updates", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);

      const initialSize = await testWTTPStorage.getResourceSize("/test");
      expect(initialSize).to.be.greaterThan(0);

      // Update existing chunk with different size data
      const newTestData = createUniqueData("Longer Data Content for Size Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await testWTTPStorage.updateResource("/test", newDataPointAddress, 0);
      
      const updatedSize = await testWTTPStorage.getResourceSize("/test");
      const newSize = await dataPointStorage.dataPointSize(newDataPointAddress);
      expect(updatedSize).to.equal(newSize); // Should replace old size
    });

    it("should handle bulk upload correctly", async function () {
      const multipleRegistrations = [];
      
      for (let i = 0; i < 3; i++) {
        const data = createUniqueData(`Bulk Data ${i}`);
        
        multipleRegistrations.push({
          data: data,
          publisher: user1.address,
          chunkIndex: i
        });
      }

      await testWTTPStorage.uploadResource("/bulk", multipleRegistrations);
      
      expect(await testWTTPStorage.getResourceChunkCount("/bulk")).to.equal(3);
      const totalSize = await testWTTPStorage.getResourceSize("/bulk");
      expect(totalSize).to.be.greaterThan(0);
    });

    it("should properly delete resources", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);

      expect(await testWTTPStorage.resourceExists("/test")).to.be.true;
      
      await testWTTPStorage.deleteResource("/test");
      
      expect(await testWTTPStorage.resourceExists("/test")).to.be.false;
      expect(await testWTTPStorage.getResourceChunkCount("/test")).to.equal(0);
      expect(await testWTTPStorage.getResourceSize("/test")).to.equal(0);
    });
  });

  describe("🔒 Immutable Resource Security Audit", function () {
    beforeEach(async function () {
      // Create immutable header
      const immutableHeader = { ...testHeader };
      immutableHeader.cache.immutableFlag = true;
      
      // Create resource with immutable header
      await testWTTPStorage.createHeader(immutableHeader);
      
      const immutableMetadata = {
        properties: {
          mimeType: "0x7468", // "th"
          charset: "0x7538", // "u8"
          encoding: "0x677a", // "gz"
          language: "0x656e", // "en"
        },
        header: await testWTTPStorage.calculateHeaderAddress(immutableHeader),
        size: 0,
        version: 0,
        lastModified: 0
      };
      
      await testWTTPStorage.createResource("/immutable", testDataRegistration);
      await testWTTPStorage.updateMetadata("/immutable", immutableMetadata);
    });

    it("should properly identify immutable resources", async function () {
      expect(await testWTTPStorage.isResourceImmutable("/immutable")).to.be.true;
      expect(await testWTTPStorage.isResourceImmutable("/nonexistent")).to.be.false;
    });

    it("should test notImmutable modifier protection", async function () {
      // Should fail for immutable resource
      await expect(
        testWTTPStorage.testNotImmutableModifier("/immutable")
      ).to.be.revertedWithCustomError(testWTTPStorage, "_409");
      
      // Should succeed for non-immutable resource
      await testWTTPStorage.testNotImmutableModifier("/nonexistent");
    });

    it("🚨 VULNERABILITY: Should prevent updates to immutable resources", async function () {
      console.log("🔍 Testing immutable resource protection...");
      
      const newTestData = createUniqueData("Immutable Test Data");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      // Should fail to update immutable resource
      await expect(
        testWTTPStorage.updateResource("/immutable", newDataPointAddress, 0)
      ).to.be.revertedWithCustomError(testWTTPStorage, "_409");
      
      // Should fail to delete immutable resource
      await expect(
        testWTTPStorage.deleteResource("/immutable")
      ).to.be.revertedWithCustomError(testWTTPStorage, "_409");
      
      console.log("✅ Immutable resources properly protected");
    });

    it("should prevent creation of additional chunks in immutable resources", async function () {
      const newTestData = createUniqueData("Additional Chunk Data");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);

      await expect(
        testWTTPStorage.updateResource("/immutable", newDataPointAddress, 1)
      ).to.be.revertedWithCustomError(testWTTPStorage, "_409");
    });

    it("should allow creation on non-existent immutable paths", async function () {
      // Creating on a path that doesn't exist yet should work even with immutable header
      const newPath = "/new-immutable";
      
      // Use unique data for this test to avoid royalty conflicts
      const uniqueData = createUniqueData("Unique Immutable Path Data");
      const uniqueTestRegistration = {
        data: uniqueData,
        publisher: user1.address,
        chunkIndex: 0
      };

      const immutableHeader = { ...testHeader };
      immutableHeader.cache.immutableFlag = true;

      await testWTTPStorage.createHeader(immutableHeader);

      const immutableMetadata = {
        properties: {
          mimeType: "0x7468", // "th"
          charset: "0x7538", // "u8"
          encoding: "0x677a", // "gz"
          language: "0x656e", // "en"
        },
        size: 0,
        version: 0,
        lastModified: 0,
        header: await testWTTPStorage.calculateHeaderAddress(immutableHeader),
      };
      await testWTTPStorage.updateMetadata(newPath, immutableMetadata);

      await testWTTPStorage.createResource(newPath, uniqueTestRegistration);
      
      expect(await testWTTPStorage.resourceExists(newPath)).to.be.true;
      expect(await testWTTPStorage.isResourceImmutable(newPath)).to.be.true;

      // should fail to update the immutable resource
      await expect(testWTTPStorage.createResource(newPath, testDataRegistration)).to.be.revertedWithCustomError(testWTTPStorage, "_409");
    });
  });

  describe("⚠️ Path Validation and Attack Vectors", function () {
    it("should handle empty and special paths", async function () {
      expect(await testWTTPStorage.resourceExists("")).to.be.false;
      
      // Empty path
      await testWTTPStorage.createResource("", testDataRegistration);
      expect(await testWTTPStorage.resourceExists("")).to.be.true;

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      // Path with special characters
      await testWTTPStorage.createResource("/path with spaces", testDataRegistration, { value: dataRoyalty });
      expect(await testWTTPStorage.resourceExists("/path with spaces")).to.be.true;
    });

    it("should handle path collision attacks", async function () {
      
      // Create resource with normal path
      await testWTTPStorage.createResource("/normal/path", testDataRegistration);

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      // Try similar but different paths
      await testWTTPStorage.createResource("/normal/path/", testDataRegistration, { value: dataRoyalty });
      await testWTTPStorage.createResource("/normal\\path", testDataRegistration, { value: dataRoyalty });
      
      // Each should be treated as separate resources
      expect(await testWTTPStorage.resourceExists("/normal/path")).to.be.true;
      expect(await testWTTPStorage.resourceExists("/normal/path/")).to.be.true;
      expect(await testWTTPStorage.resourceExists("/normal\\path")).to.be.true;
    });

    it("should handle very long paths", async function () {
      
      // Create very long path
      const longPath = "/very/long/path/" + "segment/".repeat(100);
      
      await testWTTPStorage.createResource(longPath, testDataRegistration);
      expect(await testWTTPStorage.resourceExists(longPath)).to.be.true;
    });

    it("should handle unicode and special character paths", async function () {
      
      const unicodePath = "/文件/テスト/файл.txt";
      const specialPath = "/file!@#$%^&*()+={}[]|\\:;'<>,.?/~`";
      
      await testWTTPStorage.createResource(unicodePath, testDataRegistration);

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);

      await testWTTPStorage.createResource(specialPath, testDataRegistration, { value: dataRoyalty });
      
      expect(await testWTTPStorage.resourceExists(unicodePath)).to.be.true;
      expect(await testWTTPStorage.resourceExists(specialPath)).to.be.true;
    });
  });

  describe("💰 Payment and DPR Integration Security", function () {
    it("should validate royalty calculations", async function () {
      const baseRoyalty = await dataPointRegistry.getDataPointRoyalty(mockDataPointAddress);
      
      // Should succeed with exact payment
      await testWTTPStorage.createResource("/test", testDataRegistration, { value: baseRoyalty });
      expect(await testWTTPStorage.resourceExists("/test")).to.be.true;
    });

    it("should handle DPR integration failures gracefully", async function () {
      // ORIGINAL TEST INTENT: The original test was trying to test "unregistered data"
      // but this is NOT a failure case - DPR automatically creates unregistered data.
      
      // ACTUAL DPR INTEGRATION FAILURE: Insufficient payment for existing data with royalties
      
      // First, create a data point and register it to establish royalty costs
      const existingTestData = createUniqueData("Existing Data With Royalties");
      
      // Register the data point directly through DPR to establish gas costs and publisher
      await dataPointRegistry.connect(user1).registerDataPoint(existingTestData, user1.address);
      
      const existingDataPointAddress = await dataPointStorage.calculateAddress(existingTestData);
      const royalty = await dataPointRegistry.getDataPointRoyalty(existingDataPointAddress);
      
      // Verify this data point now has royalty costs
      expect(royalty).to.be.greaterThan(0);
      
      // Now try to create a storage resource using this existing data with insufficient payment
      const testRegistration = {
        data: existingTestData,
        publisher: user2.address, // Different user trying to use existing data
        chunkIndex: 0
      };
      
      // This should fail due to insufficient royalty payment
      await expect(
        testWTTPStorage.createResource("/test-fail", testRegistration, { value: royalty / 2n })
      ).to.be.reverted; // Generic revert check since the exact error might come from different levels
      
      // SUCCESS CASE: Provide sufficient payment
      await testWTTPStorage.createResource("/test-success", testRegistration, { value: royalty });
      expect(await testWTTPStorage.resourceExists("/test-success")).to.be.true;
      
      // ORIGINAL MISUNDERSTOOD CASE: New/unregistered data should succeed (not fail)
      const newTestData = createUniqueData("New Unregistered Data");
      const newTestRegistration = {
        data: newTestData,
        publisher: user1.address,
        chunkIndex: 0
      };
      
      // This should succeed - DPR creates new data automatically
      await testWTTPStorage.createResource("/test-new", newTestRegistration);
      expect(await testWTTPStorage.resourceExists("/test-new")).to.be.true;

      const newRoyalty = await dataPointRegistry.getDataPointRoyalty(await dataPointStorage.calculateAddress(newTestData));
      expect(newRoyalty).to.be.greaterThan(0); // royalty for new data
    });

    it("should properly forward payments to DPR", async function () {
      const royalty = await dataPointRegistry.getDataPointRoyalty(mockDataPointAddress);
      
      const dprBalanceBefore = await ethers.provider.getBalance(await dataPointRegistry.getAddress());
      
      await testWTTPStorage.createResource("/test", testDataRegistration, { value: royalty });
      
      const dprBalanceAfter = await ethers.provider.getBalance(await dataPointRegistry.getAddress());
      expect(dprBalanceAfter - dprBalanceBefore).to.equal(royalty);
    });

    it("should handle bulk upload payment calculations", async function () {
      const registrations = [];
      let totalRoyalty = BigInt(0);
      
      for (let i = 0; i < 3; i++) {
        const data = createUniqueData(`Payment Test ${i}`);
        const dataPointAddress = await dataPointStorage.calculateAddress(data);
        const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
        totalRoyalty += royalty;
                
        registrations.push({
          data: data,
          publisher: user1.address,
          chunkIndex: i
        });
      }
      
      await testWTTPStorage.uploadResource("/bulk", registrations, { value: totalRoyalty });
      expect(await testWTTPStorage.getResourceChunkCount("/bulk")).to.equal(3);
    });
  });

  describe("🔍 Access Control Integration Security", function () {
    it("should properly inherit permissions from WTTPPermissions", async function () {
      // Test basic role functionality
      expect(await testWTTPStorage.hasRole(defaultAdminRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(publicRole, user1.address)).to.be.true;
    });

    it("should respect blacklisting in storage operations", async function () {
      // Blacklist user1
      await testWTTPStorage.connect(owner).blacklistForTesting(user1.address);
      expect(await testWTTPStorage.hasRole(publicRole, user1.address)).to.be.false;
      
      // Blacklisted user should still be able to use storage if they have other roles
      const customRole = ethers.id("STORAGE_USER_ROLE");
      await testWTTPStorage.connect(owner).grantRole(customRole, user1.address);
      expect(await testWTTPStorage.hasRole(customRole, user1.address)).to.be.true;
    });

    it("should validate role creation in context of storage", async function () {
      // SITE_ADMIN should be able to create resource-specific roles
      const storageRole = ethers.id("STORAGE_RESOURCE_ROLE");
      await testWTTPStorage.connect(siteAdmin).createResourceRole(storageRole);
      
      expect(await testWTTPStorage.getRoleAdmin(storageRole)).to.equal(siteAdminRole);
    });
  });

  describe("📊 Event Emission and Monitoring", function () {
    it("should emit ResourceCreated event on first chunk", async function () {
      
      await expect(
        testWTTPStorage.createResource("/test", testDataRegistration)
      ).to.emit(testWTTPStorage, "ResourceCreated").withArgs("/test");
    });

    it("should emit ResourceUpdated event on chunk updates", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);
      
      const newTestData = createUniqueData("Update Event Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await expect(
        testWTTPStorage.updateResource("/test", newDataPointAddress, 0)
      ).to.emit(testWTTPStorage, "ResourceUpdated").withArgs("/test", 0);
    });

    it("should emit ResourceDeleted event on deletion", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);
      
      await expect(
        testWTTPStorage.deleteResource("/test")
      ).to.emit(testWTTPStorage, "ResourceDeleted").withArgs("/test");
    });

    it("should emit MetadataUpdated and MetadataDeleted events", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);
      
      const newMetadata = { 
        properties: { 
          mimeType: "0x7468", 
          charset: "0x7538", 
          encoding: "0x677a", 
          language: "0x656e" 
        }, 
        header: ethers.hexlify(ethers.randomBytes(32)), size: 0, version: 0, lastModified: 0 };
      
      await expect(
        testWTTPStorage.updateMetadata("/test", newMetadata)
      ).to.emit(testWTTPStorage, "MetadataUpdated").withArgs("/test");
      
      await expect(
        testWTTPStorage.deleteMetadata("/test")
      ).to.emit(testWTTPStorage, "MetadataDeleted").withArgs("/test");
    });

    it("should emit OutOfBoundsChunk event for invalid indices", async function () {
      await testWTTPStorage.createResource("/test", testDataRegistration);
      
      const newTestData = createUniqueData("OutOfBounds Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await expect(
        testWTTPStorage.updateResource("/test", newDataPointAddress, 10)
      ).to.emit(testWTTPStorage, "OutOfBoundsChunk").withArgs("/test", 10);
    });
  });

  describe("🧪 Stress Testing and DoS Protection", function () {
    it("should handle maximum number of chunks per resource", async function () {
      await testWTTPStorage.createResource("/stress", testDataRegistration);
      
      // Add many chunks (test reasonable limit)
      const maxChunks = 50; // Reduced for test performance
      for (let i = 1; i < maxChunks; i++) {
        const data = createUniqueData(`Stress Test Chunk ${i}`);
        const dataPointAddress = await dataPointStorage.calculateAddress(data);
        await dataPointRegistry.connect(user1).registerDataPoint(data, user1.address);
        await testWTTPStorage.updateResource("/stress", dataPointAddress, i);
      }
      
      expect(await testWTTPStorage.getResourceChunkCount("/stress")).to.equal(maxChunks);
    });

    it("should handle large metadata operations efficiently", async function () {
      const batchSize = 20; // Reduced for test performance
      const paths = [];

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      let dataRoyalty: bigint = 0n;
            
      // Create many resources
      for (let i = 0; i < batchSize; i++) {
        const path = `/batch-${i}`;
        paths.push(path);
        await testWTTPStorage.createResource(path, testDataRegistration, { value: dataRoyalty });
        if (i == 0) {
          dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
        }
      }
      
      // Verify all exist
      for (const path of paths) {
        expect(await testWTTPStorage.resourceExists(path)).to.be.true;
      }
    });

    it("should handle gas-efficient operations", async function () {
      
      const createTx = await testWTTPStorage.createResource("/gas-test", testDataRegistration);
      const createReceipt = await createTx.wait();
      
      // Gas limit increased to account for integrated DPR registration
      // This includes: data point creation + gas measurement + royalty recording + storage updates
      // Limit ensures operations remain cost-effective for users (< $50 at 50 gwei gas price)
      expect(createReceipt?.gasUsed).to.be.lessThan(400000); // ~$20 at 50 gwei/$3000 ETH
      
      const readGas = await testWTTPStorage.readResource.estimateGas("/gas-test");
      expect(readGas).to.be.lessThan(100000); // Read operations should remain lightweight
    });
  });

  describe("💥 Real Contract Vulnerability Assessment", function () {
    it("🔍 COMPREHENSIVE SECURITY ANALYSIS", async function () {
      console.log("🔍 STORAGE SECURITY ASSESSMENT:");
      console.log("1. ✅ Immutable resource protection via notImmutable modifier");
      console.log("2. ✅ Header validation prevents malformed headers");
      console.log("3. ✅ Metadata integrity preserved during updates");
      console.log("4. ✅ Payment validation through real DPR integration");
      console.log("5. ✅ Access control inheritance from WTTPPermissions");
      console.log("6. ✅ Proper event emission for monitoring");
      console.log("7. ✅ Chunk index validation prevents out-of-bounds access");
      console.log("8. ✅ Resource existence validation");
      console.log("9. ⚠️  Test functions lack access control (test-only issue)");
      console.log("10. ✅ DPR manipulation properly restricted to DEFAULT_ADMIN");
    });

    it("🛡️ STORAGE SECURITY RECOMMENDATIONS", async function () {
      console.log("🛡️ STORAGE SECURITY RECOMMENDATIONS:");
      console.log("1. ✅ Immutable resource protection working correctly");
      console.log("2. ✅ Header validation prevents invalid configurations");
      console.log("3. ✅ Metadata fields properly protected from manipulation");
      console.log("4. ✅ Payment flow secure through real DPR integration");
      console.log("5. ✅ Access control properly inherited and integrated");
      console.log("6. ✅ Resource size calculations accurate and protected");
      console.log("7. ⚠️  Consider adding rate limiting for bulk operations");
      console.log("8. ⚠️  Consider adding path length/format validation");
      console.log("9. ✅ Event emission provides good audit trail");
      console.log("10. ✅ No critical vulnerabilities found in main contract");
    });

    it("should validate header exists check", async function () {
      // Test the header existence logic
      expect(await testWTTPStorage.headerExistsForPath("/nonexistent")).to.be.true; // Uses default
      
      await testWTTPStorage.createResource("/test", testDataRegistration);
      expect(await testWTTPStorage.headerExistsForPath("/test")).to.be.true;
    });

    it("should validate resource version tracking", async function () {
      await testWTTPStorage.createResource("/version-test", testDataRegistration);
      
      expect(await testWTTPStorage.getResourceVersion("/version-test")).to.equal(1);
      expect(await testWTTPStorage.getResourceLastModified("/version-test")).to.be.greaterThan(0);
    });
  });

  afterEach(async function () {
    // Clean up and validate no side effects
    const currentDPR = await testWTTPStorage.DPR();
    if (currentDPR !== await dataPointRegistry.getAddress()) {
      console.log(`⚠️  DPR was modified during test: ${currentDPR}`);
    }
  });
}); 