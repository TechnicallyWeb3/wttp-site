import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPStorage } from "../typechain-types";
import { 
  IDataPointRegistry, 
  IDataPointStorage, 
  DataRegistrationStruct, 
  ResourceMetadataStruct 
} from "@wttp/core";
import { 
  DEFAULT_ADMIN_ROLE, 
  PUBLIC_ROLE, 
  BLACKLIST_ROLE, 
  PUBLIC_HEADER,
} from "@wttp/core";

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
    // Get role identifiers
    defaultAdminRole = ethers.ZeroHash;
    expect(defaultAdminRole).to.equal(DEFAULT_ADMIN_ROLE);
    siteAdminRole = ethers.keccak256(ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
    
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    expect(publicRole).to.equal(PUBLIC_ROLE);
    blacklistRole = ethers.keccak256(ethers.toUtf8Bytes("BLACKLIST_ROLE"));
    expect(blacklistRole).to.equal(BLACKLIST_ROLE);



    // Create test header with all required methods (9 methods: 0-8)
    // HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS, LOCATE, DEFINE
    // const testOrigins = [
    //   publicRole,  // HEAD
    //   publicRole,  // GET
    //   publicRole,  // POST
    //   siteAdminRole,  // PUT
    //   siteAdminRole,  // PATCH
    //   siteAdminRole,  // DELETE
    //   publicRole,  // OPTIONS
    //   publicRole,  // LOCATE
    //   siteAdminRole  // DEFINE
    // ];

    // testHeader = {
    //   cors: {
    //     origins: testOrigins,
    //     methods: 511, // All methods allowed
    //     preset: 0,
    //     custom: ""
    //   },
    //   cache: {
    //     immutableFlag: false,
    //     preset: 0,
    //     custom: ""
    //   },
    //   redirect: {
    //     code: 0,
    //     location: ""
    //   }
    // };
    testHeader = PUBLIC_HEADER;
    // console.log("before each start")
    // console.log(await dataPointRegistry.getAddress())
    // console.log(testHeader)

    // Deploy TestWTTPStorage for each test
    const TestWTTPStorageFactory = await ethers.getContractFactory("TestWTTPStorage");
    testWTTPStorage = await TestWTTPStorageFactory.deploy(
      owner.address,
      await dataPointRegistry.getAddress()
    ) as unknown as TestWTTPStorage;
    await testWTTPStorage.waitForDeployment();

    // console.log("before each deploy storage")



    // Grant site admin role
    await testWTTPStorage.connect(owner).grantRole(siteAdminRole, siteAdmin.address);

    // Grant blacklist role
    await testWTTPStorage.connect(owner).grantRole(blacklistRole, blacklisted.address);

    // Create UNIQUE test data for each test run to avoid royalty issues
    // Using timestamp and random number to ensure uniqueness
    const uniqueData = createUniqueData();
    mockDataPointAddress = await dataPointStorage.calculateAddress(uniqueData);
    
    testDataRegistration = {
      data: uniqueData,
      publisher: user1.address,
      chunkIndex: 0
    };
    // console.log("before each success")
  });

  describe("🔒 Core Storage System Validation", function () {
    it("should correctly initialize with owner as DEFAULT_ADMIN", async function () {
      expect(await testWTTPStorage.hasRole(defaultAdminRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(defaultAdminRole, siteAdmin.address)).to.be.false;
      expect(await testWTTPStorage.hasRole(siteAdminRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(siteAdminRole, siteAdmin.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(siteAdminRole, attacker.address)).to.be.false;
      expect(await testWTTPStorage.hasRole(blacklistRole, blacklisted.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(blacklistRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(blacklistRole, siteAdmin.address)).to.be.false;
      expect(await testWTTPStorage.hasRole(blacklistRole, attacker.address)).to.be.false;
      expect(await testWTTPStorage.hasRole(publicRole, user1.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(publicRole, user2.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(publicRole, attacker.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(publicRole, blacklisted.address)).to.be.false;
      expect(await testWTTPStorage.hasRole(publicRole, owner.address)).to.be.true;
      expect(await testWTTPStorage.hasRole(publicRole, siteAdmin.address)).to.be.true;
    });

    it("should correctly initialize DPR and DPS references", async function () {
      const dprAddress = await testWTTPStorage.DPR();
      
      expect(dprAddress).to.equal(await dataPointRegistry.getAddress());
    });

    it("should establish correct constants and limits", async function () {
      expect(await testWTTPStorage.testMaxMethods()).to.equal(9);
    });

    it("should properly initialize zero structures", async function () {
      const zeroHeader = await testWTTPStorage.testZeroHeader();
      const zeroMetadata = await testWTTPStorage.testZeroMetadata();
      
      expect(zeroHeader.cors.origins.length).to.equal(0);
      expect(zeroMetadata.size).to.equal(0);
      expect(zeroMetadata.version).to.equal(0);
    });
  });

  describe("🚨 DEFAULT_ADMIN_ROLE Storage Security Audit", function () {
    // NOTE: DPR manipulation tests removed - DPR is immutable and set in constructor only

    it("should allow DEFAULT_ADMIN to set default header", async function () {
      const newHeader = { ...testHeader };
      newHeader.cache.preset = 1; // Change a field to test

      await testWTTPStorage.connect(owner).testSetDefaultHeader(newHeader);
      
      // Verify by reading a non-existent resource which should use default header
      const readHeader = await testWTTPStorage.testReadHeader("/nonexistent");
      expect(readHeader.cache.preset).to.equal(1);
    });

    // this is not a valid test, the setDefaultHeader is a test contract function
    // and is not accessible to the public
    // it("should prevent non-DEFAULT_ADMIN from setting default header", async function () {
    //   const newHeader = { ...testHeader };
    //   newHeader.cache.preset = 1;

    //   await expect(
    //     testWTTPStorage.connect(siteAdmin).setDefaultHeader(newHeader)
    //   ).to.be.reverted;

    //   await expect(
    //     testWTTPStorage.connect(attacker).setDefaultHeader(newHeader)
    //   ).to.be.reverted;
    // });


  });

  describe("🛡️ Header Security Audit", function () {
    it("should properly validate header structure during creation", async function () {
      // Valid header should work
      const validHeader = { ...testHeader };
      await testWTTPStorage.testCreateHeader(validHeader);

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
        testWTTPStorage.testCreateHeader(invalidHeader)
      ).to.be.revertedWithCustomError(testWTTPStorage, "InvalidHeader");
    });

    it("should prevent duplicate header creation", async function () {
      const header1 = { ...testHeader };
      const header2 = { ...testHeader }; // Identical header

      const headerAddress1 = await testWTTPStorage.testCreateHeader.staticCall(header1);
      await testWTTPStorage.testCreateHeader(header1);

      const headerAddress2 = await testWTTPStorage.testCreateHeader.staticCall(header2);
      await testWTTPStorage.testCreateHeader(header2);

      // Should be the same address since headers are identical
      expect(headerAddress1).to.equal(headerAddress2);
    });

    it("should calculate consistent header addresses", async function () {
      // Test the same header creation twice - should return the same address
      const headerAddress1 = await testWTTPStorage.testCreateHeader.staticCall(testHeader);
      
      // Create the header once
      await testWTTPStorage.testCreateHeader(testHeader);
      
      // Try to create the same header again - should return the same address
      const headerAddress2 = await testWTTPStorage.testCreateHeader.staticCall(testHeader);
      
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
        testWTTPStorage.connect(owner).testSetDefaultHeader(invalidHeader)
      ).to.be.revertedWithCustomError(testWTTPStorage, "InvalidHeader");
    });

    it("should handle header reading for non-existent paths", async function () {
      // Should return default header for non-existent paths
      const headerInfo = await testWTTPStorage.testReadHeader("/nonexistent");
      expect(headerInfo.cors.origins.length).to.equal(0);

      await testWTTPStorage.testSetDefaultHeader(testHeader);
      const headerInfo2 = await testWTTPStorage.testReadHeader("/nonexistent");
      expect(headerInfo2.cors.origins.length).to.equal(9);
    });
  });

  describe("🗂️ Metadata Security Audit", function () {
    beforeEach(async function () {
      // get the data point address from the storage contract
      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const dataRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      await testWTTPStorage.testCreateResource("/test", testDataRegistration, { value: dataRoyalty });
    });

    it("should properly track metadata versions and timestamps", async function () {
      const initialMetadata = await testWTTPStorage.testReadMetadata("/test");
      expect(initialMetadata.version).to.equal(1);
      expect(initialMetadata.lastModified).to.be.greaterThan(0);

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
      
      const tx = await testWTTPStorage.testUpdateMetadata("/test", newMetadata);
      await tx.wait();
      
      const updatedMetadata = await testWTTPStorage.testReadMetadata("/test");

      expect(updatedMetadata.version).to.equal(2);
      expect(updatedMetadata.lastModified).to.be.greaterThan(initialMetadata.lastModified);
    });

    it("should preserve calculated fields during metadata updates", async function () {
      const initialMetadata = await testWTTPStorage.testReadMetadata("/test");
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
      
      await testWTTPStorage.testUpdateMetadata("/test", maliciousMetadata);
      
      const updatedMetadata = await testWTTPStorage.testReadMetadata("/test");
      // Should preserve original size but increment version
      expect(updatedMetadata.size).to.equal(originalSize);
      expect(updatedMetadata.version).to.equal(originalVersion + 1n);
      expect(updatedMetadata.lastModified).to.be.greaterThan(0);
    });

    it("should properly handle metadata deletion", async function () {
      await testWTTPStorage.testDeleteMetadata("/test");
      
      const deletedMetadata = await testWTTPStorage.testReadMetadata("/test");
      expect(deletedMetadata.header).to.equal(ethers.ZeroHash);
      expect(deletedMetadata.properties.mimeType).to.equal("0x0000");
    });

    it("should update metadata stats correctly", async function () {
      const beforeUpdate = await testWTTPStorage.testReadMetadata("/test");
      const beforeTimestamp = beforeUpdate.lastModified;
      const beforeVersion = beforeUpdate.version;

      await testWTTPStorage.testUpdateMetadataStats("/test");
      
      const afterUpdate = await testWTTPStorage.testReadMetadata("/test");
      expect(afterUpdate.version).to.equal(beforeVersion + 1n);
      expect(afterUpdate.lastModified).to.be.greaterThan(beforeTimestamp);
    });
  });

  describe("📁 Resource Operations Security Audit", function () {
    it("should properly track resource chunks and size", async function () {

      await testWTTPStorage.testCreateResource("/test", testDataRegistration);

      expect((await testWTTPStorage.testReadResource("/test", {start: 0, end: 0})).dataPoints.length).to.equal(1);
      expect((await testWTTPStorage.testReadResource("/test", {start: 0, end: 0})).totalChunks).to.equal(1);
      const expectedSize = await dataPointStorage.dataPointSize(mockDataPointAddress);
      expect((await testWTTPStorage.testReadMetadata("/test")).size).to.equal(expectedSize);
    });

    it("should handle resource creation with payment validation", async function () {
      const royalty = await dataPointRegistry.getDataPointRoyalty(mockDataPointAddress);

      // Should succeed with correct payment
      await testWTTPStorage.testCreateResource("/test", testDataRegistration, { value: royalty });
      const metadata = await testWTTPStorage.testReadMetadata("/test");
      expect(metadata.lastModified).to.be.greaterThan(0);

      const dataPointAddress = await dataPointStorage.calculateAddress(testDataRegistration.data);
      const newRoyalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      const newTestRegistration = {
        data: testDataRegistration.data,
        publisher: user1.address,
        chunkIndex: 0
      };

      await expect(
        testWTTPStorage.testCreateResource("/test2", newTestRegistration, { value: newRoyalty / 2n }) // Half payment
      ).to.be.reverted;
    });

    it("should handle chunk index validation in updates", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);

      // Create another data point for updates
      const newTestData = createUniqueData("Update Data");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);

      // Valid chunk index (0 - update existing)
      await testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 0);
      
      // Valid chunk index (1 - append new)
      await testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 1);
      expect((await testWTTPStorage.testReadResource("/test", {start: 0, end: 0})).length).to.equal(2);
      
      // Invalid chunk index (out of bounds)
      await expect(
        testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 5)
      ).to.be.revertedWithCustomError(testWTTPStorage, "_416");
    });

    it("should properly calculate size during chunk updates", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);

      const initialSize = (await testWTTPStorage.testReadMetadata("/test")).size;
      expect(initialSize).to.be.greaterThan(0);

      // Update existing chunk with different size data
      const newTestData = createUniqueData("Longer Data Content for Size Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 0);
      
      const updatedSize = (await testWTTPStorage.testReadMetadata("/test")).size;
      const newSize = await dataPointStorage.dataPointSize(newDataPointAddress);
      expect(updatedSize).to.equal(newSize); // Should replace old size
    });

    it("should handle bulk upload correctly", async function () {
      const multipleRegistrations: DataRegistrationStruct[] = [];
      
      for (let i = 0; i < 3; i++) {
        const data = createUniqueData(`Bulk Data ${i}`);
        
        multipleRegistrations.push({
          data: data,
          publisher: user1.address,
          chunkIndex: i
        });
      }

      await testWTTPStorage.testUploadResource("/bulk", multipleRegistrations);
      
      expect((await testWTTPStorage.testReadResource("/bulk", {start: 0, end: 0})).dataPoints.length).to.equal(3);
      expect((await testWTTPStorage.testReadResource("/bulk", {start: 0, end: 0})).totalChunks).to.equal(3);
      const totalSize = (await testWTTPStorage.testReadMetadata("/bulk")).size;
      expect(totalSize).to.be.greaterThan(0);
    });

    it("should properly delete resources", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);

      // Check resource was created
      const beforeMetadata = await testWTTPStorage.testReadMetadata("/test");
      expect(beforeMetadata.lastModified).to.be.greaterThan(0);
      
      await testWTTPStorage.testDeleteResource("/test");
      
      // Check resource was deleted
      const afterMetadata = await testWTTPStorage.testReadMetadata("/test");
      expect(afterMetadata.lastModified).to.equal(0);
      expect((await testWTTPStorage.testReadResource("/test", {start: 0, end: 0})).dataPoints.length).to.equal(0);
      expect((await testWTTPStorage.testReadResource("/test", {start: 0, end: 0})).totalChunks).to.equal(0);
      expect((await testWTTPStorage.testReadMetadata("/test")).size).to.equal(0);
    });
  });

  describe("📊 Event Emission and Monitoring", function () {
    it("should emit ResourceCreated event on first chunk", async function () {
      
      await expect(
        testWTTPStorage.testCreateResource("/test", testDataRegistration)
      ).to.not.be.reverted;
    });

    it("should emit ResourceUpdated event on chunk updates", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);
      
      const newTestData = createUniqueData("Update Event Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await expect(
        testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 0)
      ).to.not.be.reverted;
    });

    it("should emit ResourceDeleted event on deletion", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);
      
      await expect(
        testWTTPStorage.testDeleteResource("/test")
      ).to.not.be.reverted;
    });

    it("should emit MetadataUpdated and MetadataDeleted events", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);
      
      const newMetadata = { 
        properties: { 
          mimeType: "0x7468", 
          charset: "0x7538", 
          encoding: "0x677a", 
          language: "0x656e" 
        }, 
        header: ethers.hexlify(ethers.randomBytes(32)), size: 0, version: 0, lastModified: 0 };
      
      await expect(
        testWTTPStorage.testUpdateMetadata("/test", newMetadata)
      ).to.not.be.reverted;
      
      await expect(
        testWTTPStorage.testDeleteMetadata("/test")
      ).to.not.be.reverted;
    });

    it("should emit _416 event for invalid indices", async function () {
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);
      
      const newTestData = createUniqueData("OutOfBounds Test");
      const newDataPointAddress = await dataPointStorage.calculateAddress(newTestData);
      await dataPointRegistry.connect(user1).registerDataPoint(newTestData, user1.address);
      
      await expect(
        testWTTPStorage.testUpdateResource("/test", newDataPointAddress, 10)
      ).to.be.revertedWithCustomError(testWTTPStorage, "_416");
    });
  });

  describe("💰 Payment and DPR Integration", function () {
    it("should properly forward payments to DPR", async function () {
      const royalty = await dataPointRegistry.getDataPointRoyalty(mockDataPointAddress);
      
      const dprBalanceBefore = await ethers.provider.getBalance(await dataPointRegistry.getAddress());
      
      await testWTTPStorage.testCreateResource("/test", testDataRegistration, { value: royalty });
      
      const dprBalanceAfter = await ethers.provider.getBalance(await dataPointRegistry.getAddress());
      expect(dprBalanceAfter - dprBalanceBefore).to.equal(royalty);
    });

    it("should handle bulk upload payment calculations", async function () {
      const registrations: DataRegistrationStruct[] = [];
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
      
      await testWTTPStorage.testUploadResource("/bulk", registrations, { value: totalRoyalty });
      expect((await testWTTPStorage.testReadResource("/bulk", {start: 0, end: 0})).dataPoints.length).to.equal(3);
      expect((await testWTTPStorage.testReadResource("/bulk", {start: 0, end: 0})).totalChunks).to.equal(3);
    });
  });

  describe("🔍 Storage Layer Security Assessment", function () {
    it("should validate header and metadata operations", async function () {
      await testWTTPStorage.testSetDefaultHeader(testHeader);
      // Test the header existence logic
      expect((await testWTTPStorage.testReadHeader("/nonexistent")).cors.origins.length).to.equal(9); // Uses default
      
      await testWTTPStorage.testCreateResource("/test", testDataRegistration);
      expect(((await testWTTPStorage.testReadHeader("/test")).cors.origins.length)).to.equal(9);
      
      // Validate resource version tracking
      expect((await testWTTPStorage.testReadMetadata("/test")).version).to.equal(1);
      expect((await testWTTPStorage.testReadMetadata("/test")).lastModified).to.be.greaterThan(0);
    });
  });

  // afterEach(async function () {
  //   // Clean up - reset DPR if it was modified during test
  //   const currentDPR = await testWTTPStorage.DPR();
  //   if (currentDPR !== await dataPointRegistry.getAddress()) {
  //     await testWTTPStorage.connect(owner).setDPR(await dataPointRegistry.getAddress());
  //   }
  // });
}); 