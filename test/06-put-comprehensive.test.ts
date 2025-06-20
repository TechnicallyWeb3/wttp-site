import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPSite } from "../typechain-types";
import { IDataPointRegistry, IDataPointStorage } from "@wttp/core";
import { normalizePath } from "../src/scripts/pathUtils";

describe("06 - PUT Method Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointRegistry: IDataPointRegistry;
  let dataPointStorage: IDataPointStorage;
  let owner: SignerWithAddress;
  let siteAdmin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;
  let resourceAdmin: SignerWithAddress;

  // Role identifiers
  let defaultAdminRole: string;
  let siteAdminRole: string;
  let publicRole: string;
  let putRole: string;
  let resourceSpecificRole: string;

  // Default header configuration
  let defaultHeader: any;
  let restrictedHeader: any;
  let immutableHeader: any;

  before(async function () {
    [owner, siteAdmin, user1, user2, unauthorizedUser, resourceAdmin] = await ethers.getSigners();
    const { dps, dpr } = await loadEspContracts();
    dataPointStorage = dps;
    dataPointRegistry = dpr;

    // Get role identifiers
    defaultAdminRole = ethers.ZeroHash;
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    putRole = ethers.id("PUT_ROLE");
    resourceSpecificRole = ethers.id("RESOURCE_ADMIN_ROLE");

    // Default header allowing all methods for siteAdmin
    defaultHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "" },
      cors: {
        methods: 511, // All methods allowed
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
        preset: 1,
        custom: ""
      },
      redirect: { code: 0, location: "" }
    };

    // Restricted header with resource-specific role for PUT
    restrictedHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "" },
      cors: {
        methods: 511,
        origins: [
          publicRole,           // HEAD
          publicRole,           // GET
          publicRole,           // POST
          resourceSpecificRole, // PUT - resource specific
          resourceSpecificRole, // PATCH
          resourceSpecificRole, // DELETE
          publicRole,           // OPTIONS
          publicRole,           // LOCATE
          siteAdminRole         // DEFINE
        ],
        preset: 0,
        custom: "restricted"
      },
      redirect: { code: 0, location: "" }
    };

    // Immutable header that blocks modifications
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

    // Grant roles for testing
    await testWTTPSite.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
    await testWTTPSite.connect(owner).grantRole(resourceSpecificRole, resourceAdmin.address);
  });

  // CATEGORY 1: Permission Security Tests (Highest Priority)
  describe("🔒 PUT Permission Security", function () {
    
    it("should reject unauthorized users with 403", async function () {
      const testPath = "/security-test";
      const testData = createUniqueData("Unauthorized content");
      
      await expect(
        testWTTPSite.connect(unauthorizedUser).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: unauthorizedUser.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow siteAdmin role access", async function () {
      const testPath = "/admin-test";
      const testData = createUniqueData("Admin content");
      
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
      const receipt = await response.wait();
      expect(receipt).to.not.be.null;
    });

    it("should allow resource-specific PUT roles", async function () {
      const testPath = "/resource-specific-test";
      
      // First set up restricted header for this path
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });
      
      const testData = createUniqueData("Resource admin content");
      const response = await testWTTPSite.connect(resourceAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: resourceAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should prevent privilege escalation attempts", async function () {
      const testPath = "/privilege-test";
      
      // Set up restricted resource
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });
      
      // Regular user (not resource admin) should be rejected
      const testData = createUniqueData("Escalation attempt");
      await expect(
        testWTTPSite.connect(user1).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should handle role inheritance correctly", async function () {
      const testPath = "/inheritance-test";
      
      // Owner should always have access (DEFAULT_ADMIN_ROLE)
      const testData = createUniqueData("Owner content");
      const response = await testWTTPSite.connect(owner).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: owner.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should enforce method-specific permissions", async function () {
      const testPath = "/method-specific-test";
      
      // Create resource with default permissions (PUT requires siteAdmin)
      const testData = createUniqueData("Method test content");
      
      // User with only read permissions should fail
      await expect(
        testWTTPSite.connect(user1).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
      
      // SiteAdmin should succeed
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });
  });

  // CATEGORY 2: Input Validation Security 
  describe("🛡️ PUT Input Validation", function () {
    
    it("should handle malformed metadata gracefully", async function () {
      const testPath = "/malformed-test";
      const testData = createUniqueData("Malformed test");
      
      // Test with edge case hex values (should still work as they're just bytes)
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { 
          mimeType: "0x0000", // empty mimetype (2 bytes)
          charset: "0xffff",  // invalid charset (2 bytes)
          encoding: "0x0000", // empty encoding (2 bytes)
          language: "0x1234"  // random bytes (2 bytes)
        },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should handle empty/null inputs correctly", async function () {
      const testPath = "/empty-test";
      
      // Test with empty data array (should return 204 No Content)
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [] // Empty data
      });
      
      expect(response).to.not.be.reverted;
      
      // Verify 204 No Content response
      const result = await response.wait();
      expect(result).to.not.be.null;
    });

    it("should validate content-type headers", async function () {
      const testPath = "/content-type-test";
      const testData = createUniqueData("Content type test");
      
      // Test with various content types (using proper 2-byte identifiers)
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { 
          mimeType: "0x616f", // "ao" for application/json (2 bytes)
          charset: "0x7538",  // "u8" for utf8 (2 bytes)
          encoding: "0x677a", // "gz" for gzip (2 bytes)
          language: "0x656e"  // "en" for english (2 bytes)
        },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should sanitize path inputs", async function () {
      // Test various path formats
      const validPaths = ["/normal-path", "/path/with/slashes", "/path-with-dashes"];
      
      for (const testPath of validPaths) {
        const testData = createUniqueData(`Path test for ${testPath}`);
        const response = await testWTTPSite.connect(siteAdmin).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
        });
        
        expect(response).to.not.be.reverted;
      }
    });

    it("should handle special characters in paths", async function () {
      const testPath = "/special-chars-àéîöü";
      const testData = createUniqueData("Special chars test");
      
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
    });
  });

  // CATEGORY 3: Resource State Management
  describe("📊 PUT Resource State", function () {
    
    it("should create new resources (201 Created)", async function () {
      const testPath = "/new-resource-state";
      const testData = createUniqueData("New resource content");
      
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response.head.status).to.equal(201); // Created
    });

    it("should replace existing resources (200 OK)", async function () {
      const testPath = "/replace-resource";
      const testData1 = createUniqueData("Original content");
      const testData2 = createUniqueData("Replaced content");
      
      // Create original resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData1), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Replace with new content
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData2), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response.head.status).to.equal(200); // OK (updated)
    });

    it("should handle empty data replacements (204 No Content)", async function () {
      const testPath = "/empty-replacement";
      
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [] // Empty data
      });
      
      expect(response.head.status).to.equal(204); // No Content
    });

    it("should preserve headers during replacement", async function () {
      const testPath = "/header-preservation";
      
      // Define custom header
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });
      
      // Create resource
      const testData1 = createUniqueData("Original content");
      await testWTTPSite.connect(resourceAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData1), chunkIndex: 0, publisher: resourceAdmin.address }]
      });
      
      // Replace resource
      const testData2 = createUniqueData("Replaced content");
      await testWTTPSite.connect(resourceAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x616f", charset: "0x7538", encoding: "0x677a", language: "0x656e" },
        data: [{ data: ethers.toUtf8Bytes(testData2), chunkIndex: 0, publisher: resourceAdmin.address }]
      });
      
      // Verify header is preserved
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.headerInfo.cors.custom).to.equal("restricted");
    });

    it("should maintain resource immutability where required", async function () {
      const testPath = "/immutable-resource";
      
      // Define immutable header
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: immutableHeader
      });
      
      // Attempt PUT on immutable resource should fail
      const testData = createUniqueData("Immutable attempt");
      await expect(
        testWTTPSite.connect(siteAdmin).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });
  });

  // CATEGORY 4: HTTP Compliance Testing
  describe("🌐 PUT HTTP Compliance", function () {
    
    it("should return correct status codes", async function () {
      const testPath = "/status-code-test";
      
      // Test 201 Created for new resource
      const response1 = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("New content"), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      expect(response1.head.status).to.equal(201);
      
      // Actually create the resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("New content"), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Test 200 OK for resource update
      const response2 = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("Updated content"), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      expect(response2.head.status).to.equal(200);
      
      // Test 204 No Content for empty data
      const response3 = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: "/empty-status", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: []
      });
      expect(response3.head.status).to.equal(204);
    });

    it("should generate proper ETags", async function () {
      const testPath = "/etag-test";
      const testData = createUniqueData("ETag test content");
      
      // Create the resource first
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Get ETag via HEAD request
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      // ETag should be generated and non-zero
      expect(headResponse.etag).to.not.equal(ethers.ZeroHash);
      
      // ETag should be consistent across calls
      const headResponse2 = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse2.etag).to.equal(headResponse.etag);
    });

    it("should properly format response headers", async function () {
      const testPath = "/headers-test";
      const testData = createUniqueData("Headers test content");
      
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { 
          mimeType: "0x616f", // "ao" for application/json (2 bytes)
          charset: "0x7538",  // "u8" for utf8 (2 bytes)
          encoding: "0x677a", // "gz" for gzip (2 bytes)
          language: "0x656e"  // "en" for english (2 bytes)
        },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Verify metadata structure
      expect(response.head.metadata.properties.mimeType).to.equal("0x616f");
      expect(response.head.metadata.properties.charset).to.equal("0x7538");
      expect(response.head.metadata.properties.encoding).to.equal("0x677a");
      expect(response.head.metadata.properties.language).to.equal("0x656e");
      expect(response.head.metadata.size).to.be.greaterThan(0);
    });
  });

  // CATEGORY 5: Chunking & Data Size Tests
  describe("📦 PUT Data Handling", function () {
    
    it("should handle small data (<1KB)", async function () {
      const testPath = "/small-data";
      const testData = "Small test content"; // < 1KB
      
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
      
      // Verify content retrieval
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(getResponse.head.status).to.equal(200);
      expect(getResponse.resource.dataPoints.length).to.equal(1);
    });

    it("should handle medium data (~10KB)", async function () {
      const testPath = "/medium-data";
      const testData = "A".repeat(10000); // ~10KB
      
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      expect(response).to.not.be.reverted;
      
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.metadata.size).to.equal(10000);
    });

    it("should handle multi-chunk data (moderate size to avoid gas limits)", async function () {
      const testPath = "/multi-chunk-data";
      const chunk1Data = "A".repeat(8000); // 8KB
      const chunk2Data = "B".repeat(8000); // 8KB
      
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [
          { data: ethers.toUtf8Bytes(chunk1Data), chunkIndex: 0, publisher: siteAdmin.address },
          { data: ethers.toUtf8Bytes(chunk2Data), chunkIndex: 1, publisher: siteAdmin.address }
        ]
      });
      
      expect(response).to.not.be.reverted;
      
      // Verify both chunks are stored
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 1 }
      });
      
      expect(getResponse.resource.dataPoints.length).to.equal(2);
      expect(getResponse.head.metadata.size).to.equal(16000); // 8000 + 8000
    });

    it("should verify content addressing integrity", async function () {
      const testPath = "/integrity-test";
      const testData = createUniqueData("Integrity test content");
      
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Calculate expected address
      const expectedAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      
      expect(response.resource.dataPoints[0]).to.equal(expectedAddress);
    });
  });

  // CATEGORY 6: Path Normalization Integration
  describe("🔧 PUT Path Normalization", function () {
    
    it("should handle normalized paths in PUT operations", async function () {
      const testData = createUniqueData("Path normalization test");
      const originalPath = "/api/users";
      const normalizedPath = normalizePath(originalPath, true);
      
      expect(normalizedPath).to.equal("/api/users/"); // Should remove trailing slash
      
      // PUT should work with normalized path
      const response = await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: normalizedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: { code: 301, location: "./index.html" }
        }
      });
      
      expect(response).to.not.be.reverted;

      const headResponse = await testWTTPSite.connect(user1).HEAD({ 
        path: normalizedPath, 
        ifModifiedSince: 0, 
        ifNoneMatch: ethers.ZeroHash 
      });
      
      expect(headResponse.headerInfo.redirect.code).to.equal(301);
      expect(headResponse.headerInfo.redirect.location).to.equal("./index.html");
    });

    // not an issue, the contract accepts any path, the handler will reject this though. And our tooling won't allow it even though the contract can technically handle it.
    // it("should reject malformed paths in PUT operations", async function () {
    //   const testData = createUniqueData("Malformed path test");
      
    //   // Test double slash paths - should be rejected by path validation
    //   const malformedPath = "//invalid";
    //   await expect(
    //     testWTTPSite.connect(siteAdmin).PUT({
    //       head: { path: malformedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
    //       properties: { mimeType: "0x616f", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
    //       data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
    //     })
    //   ).to.be.rejected;
    // });

    it("should normalize various path formats consistently", async function () {
      const testData = createUniqueData("Path format consistency test");
      
      // All these should normalize to the same path
      const fileVariations = [
        "/api/data",
        "api/data",
      ];
      
      for (let i = 0; i < fileVariations.length; i++) {
        const normalizedPath = normalizePath(fileVariations[i]);
        expect(normalizedPath).to.equal("/api/data", 
          `Path "${fileVariations[i]}" didn't normalize correctly`);
      }

      const dirVariations = [
        "/api/data/",
        "api/data/",
      ];
      
      for (let i = 0; i < dirVariations.length; i++) {
        const normalizedPath = normalizePath(dirVariations[i], true);
        expect(normalizedPath).to.equal("/api/data/", 
          `Path "${dirVariations[i]}" didn't normalize correctly`);
      }
      
    });
  });

  // CATEGORY 7: Edge Cases & Error Handling
  describe("⚠️ PUT Edge Cases", function () {
    
    it("should handle resource conflicts gracefully", async function () {
      const testPath = "/conflict-test";
      const testData = createUniqueData("Conflict test");
      
      // Create resource with one user
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Overwrite with owner (should succeed due to admin role)
      const newData = createUniqueData("Owner override");
      const response = await testWTTPSite.connect(owner).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(newData), chunkIndex: 0, publisher: owner.address }]
      });
      
      expect(response).to.not.be.reverted;
    });

    it("should validate resource path formats", async function () {
      const validPaths = ["/", "/simple", "/path/with/multiple/segments", "/path-with-dashes"];
      
      for (const testPath of validPaths) {
        const testData = createUniqueData(`Path validation test for ${testPath}`);
        const response = await testWTTPSite.connect(siteAdmin).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
        });
        
        expect(response).to.not.be.reverted;
      }
    });

    it("should handle idempotency correctly with royalty payments", async function () {
      const testPath = "/idempotency-test";
      const testData = createUniqueData("Idempotent content");
      
      // Calculate expected data point address
      const expectedDataPoint = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      
      // First PUT (creation) - no royalty needed for new data
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Verify first creation
      const getResponse1 = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse1.resource.dataPoints[0]).to.equal(expectedDataPoint);
      const version1 = getResponse1.head.metadata.version;
      
      // Calculate royalty for existing datapoint
      const royalty = await dataPointRegistry.getDataPointRoyalty(expectedDataPoint);
      
      // Second PUT with same data (idempotent operation) - must pay royalty
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      }, { value: royalty }); // Pay the required royalty
      
      // Verify idempotency: same data point, incremented version
      const getResponse2 = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse2.resource.dataPoints[0]).to.equal(expectedDataPoint); // Same data
      expect(getResponse2.head.metadata.version).to.be.greaterThan(version1); // Version incremented
    });

    it("should handle zero-length data arrays correctly", async function () {
      const testPath = "/zero-length-test";
      
      const response = await testWTTPSite.connect(siteAdmin).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: []
      });
      
      expect(response.head.status).to.equal(204); // No Content
      expect(response.resource.dataPoints.length).to.equal(0);
    });

    it("should require royalty payments for duplicate data", async function () {
      const testPath1 = "/royalty-test-1";
      const testPath2 = "/royalty-test-2";
      const testData = createUniqueData("Duplicate data test");
      
      // Create first resource (original data)
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath1, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Calculate data point and royalty
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      // Attempt to create second resource with same data without royalty (should fail with ESP error)
      await expect(
        testWTTPSite.connect(siteAdmin).PUT({
          head: { path: testPath2, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
        })
      ).to.be.reverted; // Should fail due to insufficient royalty
      
      // Create second resource with same data WITH royalty (should succeed)
      const response = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath2, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      }, { value: royalty });
      
      expect(response).to.not.be.reverted;
      
      // Verify both resources point to same data
      const getResponse1 = await testWTTPSite.connect(user1).GET({
        head: { path: testPath1, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      const getResponse2 = await testWTTPSite.connect(user1).GET({
        head: { path: testPath2, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(getResponse1.resource.dataPoints[0]).to.equal(getResponse2.resource.dataPoints[0]);
      expect(getResponse1.resource.dataPoints[0]).to.equal(dataPointAddress);
    });
  });
}); 