import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { TestWTTPSite } from "../typechain-types";

describe("🌐 GET Method - Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let owner: Signer;
  let siteAdmin: Signer;
  let user1: Signer;
  let user2: Signer;
  let unauthorizedUser: Signer;
  let dataPointRegistry: any;
  let dataPointStorage: any;

  // Role constants
  let siteAdminRole: string;
  let publicRole: string;
  let defaultAdminRole: string;

  // Header configurations
  let defaultHeader: any;
  let restrictedHeader: any;

  // Helper function
  function createUniqueData(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 15)}`;
  }

  before(async function () {
    [owner, siteAdmin, user1, user2, unauthorizedUser] = await ethers.getSigners();

    // Deploy DataPointStorage
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorage");
    dataPointStorage = await DataPointStorageFactory.deploy();
    await dataPointStorage.waitForDeployment();

    // Deploy DataPointRegistry
    const DataPointRegistryFactory = await ethers.getContractFactory("DataPointRegistry");
    dataPointRegistry = await DataPointRegistryFactory.deploy(
      await owner.getAddress(),
      await dataPointStorage.getAddress(),
      ethers.parseEther("0.0001") // Default royalty rate
    );
    await dataPointRegistry.waitForDeployment();

    // Role definitions
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // PUBLIC_ROLE is max uint256
    defaultAdminRole = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE

    // Default header with all methods allowed
    defaultHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "" },
      cors: {
        methods: 511, // All 9 methods: 2^9 - 1 = 511
        origins: [
          publicRole,     // HEAD - public
          publicRole,     // GET - public  
          publicRole,     // POST - public
          siteAdminRole,  // PUT - site admin
          siteAdminRole,  // PATCH - site admin
          siteAdminRole,  // DELETE - site admin
          publicRole,     // OPTIONS - public
          publicRole,     // LOCATE - public
          siteAdminRole   // DEFINE - site admin
        ],
        preset: 0,
        custom: ""
      },
      redirect: { code: 0, location: "" }
    };

    // Restricted header - only read methods allowed
    restrictedHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "restricted" },
      cors: {
        methods: 203, // HEAD(1) + GET(2) + PUT(8) + OPTIONS(64) + LOCATE(128) = 203
        origins: [
          publicRole,     // HEAD
          publicRole,     // GET
          siteAdminRole,  // POST (blocked by methods bitmask)
          siteAdminRole,  // PUT - site admin
          siteAdminRole,  // PATCH (blocked by methods bitmask)
          siteAdminRole,  // DELETE (blocked by methods bitmask)
          publicRole,     // OPTIONS
          publicRole,     // LOCATE
          siteAdminRole   // DEFINE (blocked by methods bitmask)
        ],
        preset: 0,
        custom: "restricted"
      },
      redirect: { code: 0, location: "" }
    };
  });

  beforeEach(async function () {
    // Deploy fresh TestWTTPSite for each test
    const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
    testWTTPSite = await TestWTTPSiteFactory.deploy(
      await owner.getAddress(),
      await dataPointRegistry.getAddress(),
      defaultHeader
    ) as unknown as TestWTTPSite;
    await testWTTPSite.waitForDeployment();

    // Grant site admin role
    await testWTTPSite.connect(owner).grantRole(siteAdminRole, await siteAdmin.getAddress());
  });

  // Helper function to create a resource
  async function createResource(path: string, data: string, signer = siteAdmin): Promise<void> {
    const testData = createUniqueData(data);
    
    // Calculate royalty for the data
    const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
    const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
    
    await testWTTPSite.connect(signer).PUT({
      head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
      data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: await signer.getAddress() }]
    }, { value: royalty });
  }

  // Helper function to create multi-chunk resource
  async function createMultiChunkResource(path: string, chunks: string[], signer = siteAdmin): Promise<void> {
    const dataRegistrations = await Promise.all(chunks.map(async (chunk, index) => {
      const testData = createUniqueData(chunk);
      return {
        data: ethers.toUtf8Bytes(testData),
        chunkIndex: index,
        publisher: await signer.getAddress()
      };
    }));

    // Calculate total royalty for all chunks
    let totalRoyalty = 0n;
    for (const reg of dataRegistrations) {
      const dataPointAddress = await dataPointStorage.calculateAddress(reg.data);
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      totalRoyalty += royalty;
    }
    
    await testWTTPSite.connect(signer).PUT({
      head: { path, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
      data: dataRegistrations
    }, { value: totalRoyalty });
  }

  describe("🔒 Security & Permissions (PRIORITY 1)", function () {

    it("should enforce onlyAuthorized modifier validation", async function () {
      const testPath = "/permission-test";
      await createResource(testPath, "Permission test content");

      // Public users should be able to access GET (default header allows)
      const publicResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(publicResponse.head.status).to.equal(200);
      expect(publicResponse.resource.dataPoints.length).to.be.greaterThan(0);

      // Site admin should also be able to access GET
      const adminResponse = await testWTTPSite.connect(siteAdmin).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(adminResponse.head.status).to.equal(200);

      // Owner (super admin) should also be able to access GET
      const ownerResponse = await testWTTPSite.connect(owner).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(ownerResponse.head.status).to.equal(200);
    });

    it("should verify OPTIONS→HEAD→GET dependency checking", async function () {
      const testPath = "/dependency-test";
      await createResource(testPath, "Dependency test content");

      // Test that GET depends on HEAD which depends on OPTIONS
      // First verify OPTIONS works
      const optionsResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(optionsResponse.status).to.equal(204);
      expect(optionsResponse.allow & 2n).to.equal(2n); // GET allowed (bit 1 = 2)

      // Then verify HEAD works
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(200);

      // Finally verify GET works
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse.head.status).to.equal(200);

      // This confirms the dependency chain: OPTIONS → HEAD → GET
    });

    it("should handle super admin override behavior", async function () {
      const testPath = "/super-admin-get-test";
      await createResource(testPath, "Super admin test content");

      // Use a new site with restricted header (avoid DEFINE issue)
      const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
      const restrictedTestSite = await TestWTTPSiteFactory.deploy(
        await owner.getAddress(),
        await dataPointRegistry.getAddress(),
        restrictedHeader
      ) as unknown as TestWTTPSite;
      await restrictedTestSite.waitForDeployment();
      await restrictedTestSite.connect(owner).grantRole(siteAdminRole, await siteAdmin.getAddress());

      // Create resource in restricted site
      const testData = createUniqueData("Super admin test");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      await restrictedTestSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: await siteAdmin.getAddress() }]
      }, { value: royalty });

      // Regular user should be able to access GET (allowed in restrictedHeader)
      const publicResponse = await restrictedTestSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(publicResponse.head.status).to.equal(200);

      // Owner (DEFAULT_ADMIN_ROLE) should also work
      const superAdminResponse = await restrictedTestSite.connect(owner).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(superAdminResponse.head.status).to.equal(200);
    });

    it("should enforce role-based access control", async function () {
      const testPath = "/role-access-test";
      await createResource(testPath, "Role access test content");

      // Create header where GET requires admin role (avoid DEFINE by creating new site)
      const adminOnlyHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "admin-only" },
        cors: {
          methods: 74, // GET(2) + PUT(8) + OPTIONS(64) = 74
          origins: [
            defaultAdminRole, // HEAD - admin only
            defaultAdminRole, // GET - admin only
            defaultAdminRole, // POST - admin only
            defaultAdminRole, // PUT - admin only
            defaultAdminRole, // PATCH - admin only
            defaultAdminRole, // DELETE - admin only
            defaultAdminRole, // OPTIONS - admin only
            defaultAdminRole, // LOCATE - admin only
            defaultAdminRole  // DEFINE - admin only
          ],
          preset: 0,
          custom: "admin-only"
        },
        redirect: { code: 0, location: "" }
      };

      const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
      const adminOnlyTestSite = await TestWTTPSiteFactory.deploy(
        await owner.getAddress(),
        await dataPointRegistry.getAddress(),
        adminOnlyHeader
      ) as unknown as TestWTTPSite;
      await adminOnlyTestSite.waitForDeployment();

      // Create resource in admin-only site
      const testData = createUniqueData("Admin only test");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      await adminOnlyTestSite.connect(owner).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: await owner.getAddress() }]
      }, { value: royalty });

      // Regular users should be blocked
      await expect(
        adminOnlyTestSite.connect(user1).GET({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(adminOnlyTestSite, "_403");

      // Only owner (DEFAULT_ADMIN_ROLE) should succeed
      const adminResponse = await adminOnlyTestSite.connect(owner).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(adminResponse.head.status).to.equal(200);
    });

    it("should reject unauthorized access with proper error codes", async function () {
      const testPath = "/unauthorized-get-test";

      // Test GET on non-existent resource
      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");

      // Create resource
      await createResource(testPath, "Unauthorized test content");

      // Test with method not allowed (use a site where GET bit is not set)
      const noGetHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "no-get" },
        cors: {
          methods: 73, // HEAD(1) + PUT(8) + OPTIONS(64) = 73 (no GET bit)
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "no-get"
        },
        redirect: { code: 0, location: "" }
      };

      const NoGetTestSiteFactory = await ethers.getContractFactory("TestWTTPSite");
      const noGetTestSite = await NoGetTestSiteFactory.deploy(
        await owner.getAddress(),
        await dataPointRegistry.getAddress(),
        noGetHeader
      ) as unknown as TestWTTPSite;
      await noGetTestSite.waitForDeployment();
      await noGetTestSite.connect(owner).grantRole(siteAdminRole, await siteAdmin.getAddress());

      // Create resource in no-GET site
      const testData = createUniqueData("No GET test");
      const dataPointAddress = await dataPointStorage.calculateAddress(ethers.toUtf8Bytes(testData));
      const royalty = await dataPointRegistry.getDataPointRoyalty(dataPointAddress);
      
      await noGetTestSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: await siteAdmin.getAddress() }]
      }, { value: royalty });

      // GET should fail with _405 (Method Not Allowed)
      await expect(
        noGetTestSite.connect(user1).GET({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(noGetTestSite, "_405");
    });

  });

  describe("📋 Content Retrieval Core Functionality", function () {

    it("should retrieve basic content for existing resources", async function () {
      const testPath = "/basic-content-test";
      await createResource(testPath, "Basic content test data");

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(1);
      expect(response.resource.dataPoints[0]).to.not.equal(ethers.ZeroHash);
      expect(response.head.metadata.size).to.be.greaterThan(0);
      expect(response.head.etag).to.not.equal(ethers.ZeroHash);
    });

    it("should handle multi-chunk content (ESP integration)", async function () {
      const testPath = "/multi-chunk-test";
      await createMultiChunkResource(testPath, ["chunk1", "chunk2", "chunk3"]);

      // Request all chunks
      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 } // This should normalize to all chunks
      });

      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(3);
      
      // Verify each chunk has a valid data point
      response.resource.dataPoints.forEach(dataPoint => {
        expect(dataPoint).to.not.equal(ethers.ZeroHash);
      });
    });

    it("should handle zero-length resources correctly", async function () {
      const testPath = "/zero-length-test";
      
      // Create resource with empty data
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [] // Empty data array
      });

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      expect(response.head.status).to.equal(204); // No Content
      expect(response.resource.dataPoints.length).to.equal(0);
      expect(response.head.metadata.size).to.equal(0);
    });

    it("should integrate resource metadata correctly", async function () {
      const testPath = "/metadata-integration-test";
      await createResource(testPath, "Metadata integration test");

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      expect(response.head.status).to.equal(200);
      expect(response.head.metadata.size).to.be.greaterThan(0);
      expect(response.head.metadata.lastModified).to.be.greaterThan(0);
      expect(response.head.metadata.version).to.be.greaterThanOrEqual(0);
      
      // Verify header info is included
      expect(response.head.headerInfo.cors.methods).to.equal(511);
      expect(response.head.headerInfo.cache.immutableFlag).to.be.false;
    });

  });

  describe("🔄 Conditional Headers & HTTP Compliance", function () {

    it("should handle ETag conditional requests (304 responses)", async function () {
      const testPath = "/etag-conditional-test";
      await createResource(testPath, "ETag conditional test");

      // Get initial response
      const initialResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(initialResponse.head.status).to.equal(200);
      expect(initialResponse.head.etag).to.not.equal(ethers.ZeroHash);

      console.log("🔍 GET ETag Test Debug:");
      console.log("  Initial GET ETag:", initialResponse.head.etag);
      console.log("  Initial GET Status:", initialResponse.head.status);
      console.log("  Initial GET lastModified:", initialResponse.head.metadata.lastModified);

      // Test conditional request with matching ETag
      const conditionalResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: initialResponse.head.etag },
        rangeChunks: { start: 0, end: 0 }
      });

      console.log("  Conditional GET ETag:", conditionalResponse.head.etag);
      console.log("  Conditional GET Status:", conditionalResponse.head.status);
      console.log("  Request ifNoneMatch:", initialResponse.head.etag);
      console.log("  ETags Match:", conditionalResponse.head.etag === initialResponse.head.etag);

      expect(conditionalResponse.head.status).to.equal(304); // Not Modified
    });

    it("should handle If-Modified-Since conditional requests", async function () {
      const testPath = "/modified-since-test";
      await createResource(testPath, "Modified since test");

      // Get initial response
      const initialResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(initialResponse.head.status).to.equal(200);
      expect(initialResponse.head.metadata.lastModified).to.be.greaterThan(0);

      console.log("🔍 GET If-Modified-Since Test Debug:");
      console.log("  Initial GET lastModified:", initialResponse.head.metadata.lastModified);
      console.log("  Initial GET Status:", initialResponse.head.status);
      console.log("  Initial GET ETag:", initialResponse.head.etag);

      // Test conditional request with ifModifiedSince
      const conditionalResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: initialResponse.head.metadata.lastModified, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      console.log("  Conditional GET Status:", conditionalResponse.head.status);
      console.log("  Request ifModifiedSince:", initialResponse.head.metadata.lastModified);
      console.log("  Conditional lastModified:", conditionalResponse.head.metadata.lastModified);
      console.log("  Times Equal:", conditionalResponse.head.metadata.lastModified === initialResponse.head.metadata.lastModified);

      expect(conditionalResponse.head.status).to.equal(304); // Not Modified
    });

    it("🔍 DEBUG: should compare GET vs HEAD ETag results", async function () {
      const testPath = "/get-vs-head-etag-test";
      await createResource(testPath, "GET vs HEAD ETag comparison");

      // Get HEAD response
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      // Get GET response
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      console.log("🔍 GET vs HEAD ETag Comparison:");
      console.log("  HEAD ETag:", headResponse.etag);
      console.log("  GET ETag: ", getResponse.head.etag);
      console.log("  ETags Match:", headResponse.etag === getResponse.head.etag);
      console.log("  HEAD Status:", headResponse.status);
      console.log("  GET Status: ", getResponse.head.status);
      console.log("  HEAD lastModified:", headResponse.metadata.lastModified);
      console.log("  GET lastModified: ", getResponse.head.metadata.lastModified);
      console.log("  Times Match:", headResponse.metadata.lastModified === getResponse.head.metadata.lastModified);

      // Test HEAD conditional request with matching ETag
      const headConditional = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: headResponse.etag
      });

      console.log("  HEAD Conditional Status:", headConditional.status);

      // Test GET conditional request with same ETag
      const getConditional = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: headResponse.etag },
        rangeChunks: { start: 0, end: 0 }
      });

      console.log("  GET Conditional Status: ", getConditional.head.status);

      // Verify HEAD properly returns 304
      expect(headConditional.status).to.equal(304);
      
      // Document the difference
      console.log("🎯 KEY FINDING: HEAD returns 304, GET returns", getConditional.head.status);
      
      // The ETags should match
      expect(headResponse.etag).to.equal(getResponse.head.etag);
    });

    it("should validate cache headers integration", async function () {
      const testPath = "/cache-headers-test";
      await createResource(testPath, "Cache headers test");

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      expect(response.head.status).to.equal(200);
      expect(response.head.headerInfo.cache.immutableFlag).to.be.false;
      expect(response.head.headerInfo.cache.preset).to.equal(0);
      expect(response.head.headerInfo.cache.custom).to.equal("");
    });

    it("should validate CORS headers", async function () {
      const testPath = "/cors-headers-test";
      await createResource(testPath, "CORS headers test");

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });

      expect(response.head.status).to.equal(200);
      expect(response.head.headerInfo.cors.methods).to.equal(511);
      expect(response.head.headerInfo.cors.preset).to.equal(0);
      
      // Verify origins array structure
      expect(response.head.headerInfo.cors.origins.length).to.equal(9);
      expect(response.head.headerInfo.cors.origins[1]).to.equal(publicRole); // GET is public
    });

  });

  describe("⚠️ Edge Cases & Error Handling", function () {

    it("should return 404 for non-existent resources", async function () {
      const nonExistentPath = "/does-not-exist";

      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: nonExistentPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle empty path gracefully", async function () {
      const emptyPath = "";

      // Empty path should return 404 based on contract behavior
      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: emptyPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle chunk range edge cases", async function () {
      const testPath = "/chunk-range-test";
      await createMultiChunkResource(testPath, ["chunk1", "chunk2", "chunk3"]);

      // Test single chunk request
      const singleChunkResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 } // Will normalize to all chunks in this implementation
      });
      expect(singleChunkResponse.head.status).to.equal(200);

      // Test range that covers all chunks
      const allChunksResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 2 }
      });
      expect(allChunksResponse.head.status).to.equal(200);
      expect(allChunksResponse.resource.dataPoints.length).to.equal(3);
    });

    it("should handle large resource retrieval", async function () {
      const testPath = "/large-resource-test";
      
      // Create a larger multi-chunk resource
      const manyChunks = Array(5).fill(0).map((_, i) => `large-chunk-${i}`);
      await createMultiChunkResource(testPath, manyChunks);

      const response = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 } // Should get all chunks
      });

      expect(response.head.status).to.equal(200);
      expect(response.resource.dataPoints.length).to.equal(5);
      expect(response.head.metadata.size).to.be.greaterThan(0);
    });

  });

}); 