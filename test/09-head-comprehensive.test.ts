import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { TestWTTPSite } from "../typechain-types";

describe("📋 HEAD Method - Comprehensive Testing", function () {
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
  let redirectHeader: any;
  let immutableHeader: any;

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
        methods: 195, // HEAD(1) + GET(2) + OPTIONS(64) + LOCATE(128) = 195
        origins: [
          publicRole,     // HEAD
          publicRole,     // GET
          siteAdminRole,  // POST (blocked by methods bitmask)
          siteAdminRole,  // PUT (blocked by methods bitmask)
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

    // Redirect header
    redirectHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "redirect" },
      cors: {
        methods: 511, // All methods allowed
        origins: Array(9).fill(publicRole),
        preset: 0,
        custom: "redirect"
      },
      redirect: { code: 301, location: "/redirected-target" }
    };

    // Immutable header  
    immutableHeader = {
      cache: { immutableFlag: true, preset: 6, custom: "permanent" },
      cors: {
        methods: 195, // Only read methods: HEAD(1) + GET(2) + OPTIONS(64) + LOCATE(128) = 195
        origins: Array(9).fill(publicRole),
        preset: 1,
        custom: "immutable"
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

  describe("🔒 Permission Security Tests (PRIMARY FOCUS)", function () {

    it("should enforce onlyAuthorized modifier with different roles", async function () {
      const testPath = "/permission-test";
      await createResource(testPath, "Test content");

      // Public users should be able to access HEAD (default header allows)
      const publicResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(publicResponse.status).to.equal(200);
      expect(publicResponse.metadata.size).to.be.greaterThan(0);

      // Site admin should also be able to access HEAD
      const adminResponse = await testWTTPSite.connect(siteAdmin).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(adminResponse.status).to.equal(200);

      // Owner (super admin) should also be able to access HEAD
      const ownerResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(ownerResponse.status).to.equal(200);
    });

    it("should verify OPTIONS dependency check in _HEAD", async function () {
      const testPath = "/options-dependency-test";
      
      // Create resource with admin-only HEAD access
      const adminOnlyHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "admin-only" },
        cors: {
          methods: 1, // Only HEAD allowed (bit 0 = 1)
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

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: adminOnlyHeader
      });

      // Regular users should be blocked by _OPTIONS check
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Only owner (DEFAULT_ADMIN_ROLE) should succeed
      const adminResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(adminResponse.status)).to.be.oneOf([200, 204]); // Valid response
    });

    it("should handle super admin override correctly", async function () {
      const testPath = "/super-admin-head-test";
      await createResource(testPath, "Admin override test");

      // Create admin-only access
      const adminOnlyHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "admin-only" },
        cors: {
          methods: 1, // Only HEAD allowed
          origins: Array(9).fill(defaultAdminRole), // All require admin
          preset: 0,
          custom: "admin-only"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: adminOnlyHeader
      });

      // Regular user should be blocked
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Owner (DEFAULT_ADMIN_ROLE) should bypass restrictions
      const superAdminResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(superAdminResponse.status).to.equal(200);
    });

    it("should reject unauthorized access with 403", async function () {
      const testPath = "/unauthorized-head-test";
      await createResource(testPath, "Unauthorized test");

      // Create header where HEAD requires admin role
      const headAdminOnlyHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "head-admin-only" },
        cors: {
          methods: 511, // All methods allowed in bitmask
          origins: [
            defaultAdminRole, // HEAD - admin only
            publicRole,       // GET - public
            publicRole,       // POST - public
            siteAdminRole,    // PUT - site admin
            siteAdminRole,    // PATCH - site admin
            siteAdminRole,    // DELETE - site admin
            publicRole,       // OPTIONS - public
            publicRole,       // LOCATE - public
            siteAdminRole     // DEFINE - site admin
          ],
          preset: 0,
          custom: "head-admin-only"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: headAdminOnlyHeader
      });

      // Regular users should be rejected with 403
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      await expect(
        testWTTPSite.connect(siteAdmin).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Only owner should succeed
      const adminResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(adminResponse.status).to.equal(200);
    });

  });

  describe("📋 Header Metadata & Core Functionality", function () {

    it("should return correct metadata for existing resources", async function () {
      const testPath = "/metadata-test";
      const testData = "Metadata test content";
      await createResource(testPath, testData);

      const response = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(response.status).to.equal(200);
      expect(response.metadata.size).to.be.greaterThan(0);
      expect(response.metadata.lastModified).to.be.greaterThan(0);
      expect(response.metadata.version).to.be.greaterThanOrEqual(0);
      expect(response.etag).to.not.equal(ethers.ZeroHash);
      
      // Verify header info structure
      expect(response.headerInfo.cors.methods).to.equal(511);
      expect(response.headerInfo.cache.immutableFlag).to.be.false;
      expect(response.headerInfo.redirect.code).to.equal(0);
    });

    it("should handle conditional headers with ETags", async function () {
      const testPath = "/etag-test";
      await createResource(testPath, "ETag test content");

      // Get initial response
      const initialResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(initialResponse.status).to.equal(200);
      expect(initialResponse.etag).to.not.equal(ethers.ZeroHash);

      // Test conditional request with matching ETag (should return 304)
      const conditionalResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: initialResponse.etag
      });
      expect(conditionalResponse.status).to.equal(304);
    });

    it("should handle conditional headers with ifModifiedSince", async function () {
      const testPath = "/modified-since-test";
      await createResource(testPath, "Modified since test content");

      // Get initial response
      const initialResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(initialResponse.status).to.equal(200);
      expect(initialResponse.metadata.lastModified).to.be.greaterThan(0);

      // Test conditional request with ifModifiedSince equal to lastModified
      const conditionalResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: initialResponse.metadata.lastModified,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(conditionalResponse.status).to.equal(304);
    });

    it("should handle redirect headers correctly", async function () {
      const testPath = "/redirect-test";

      // Apply redirect header first, then create resource
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: redirectHeader
      });

      // Create resource (redirect takes precedence over content)
      await createResource(testPath, "Redirect test content");

      const response = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(response.status).to.equal(301);
      expect(response.headerInfo.redirect.code).to.equal(301);
      expect(response.headerInfo.redirect.location).to.equal("/redirected-target");
    });

  });

  describe("⚠️ Edge Cases & Resource States", function () {

    it("should return 404 for non-existent resources", async function () {
      const nonExistentPath = "/does-not-exist";

      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: nonExistentPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should return 204 for zero-length resources", async function () {
      const testPath = "/zero-length-test";
      
      // Create resource with empty data
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [] // Empty data array
      });

      const response = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(response.status).to.equal(204); // No Content
      expect(response.metadata.size).to.equal(0);
    });

    it("should handle empty path gracefully", async function () {
      const emptyPath = "";

      // Empty path should return 404 based on contract behavior
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: emptyPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

  });

  describe("🔄 OPTIONS Dependency Validation", function () {

    it("should call _OPTIONS for permission checking", async function () {
      const testPath = "/options-call-test";
      await createResource(testPath, "Options call test");

      // This test verifies that HEAD internally calls _OPTIONS
      // If permission fails in _OPTIONS, HEAD should fail too
      const permissionRestrictedHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "permission-test" },
        cors: {
          methods: 0, // No methods allowed in bitmask
          origins: Array(9).fill(defaultAdminRole),
          preset: 0,
          custom: "no-methods"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: permissionRestrictedHeader
      });

      // Should fail due to _OPTIONS permission check
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");

      // Super admin should still work due to override
      const adminResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(adminResponse.status).to.equal(200);
    });

    it("should validate method bitmask via OPTIONS", async function () {
      const testPath = "/bitmask-validation-test";
      await createResource(testPath, "Bitmask validation test");

      // Create header where HEAD is not in methods bitmask
      const noHeadHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "no-head" },
        cors: {
          methods: 2, // Only GET allowed (bit 1 = 2), HEAD (bit 0 = 1) not allowed
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "no-head"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: noHeadHeader
      });

      // HEAD should fail due to method not allowed in bitmask
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });

    it("should confirm HEAD depends on OPTIONS foundation", async function () {
      const testPath = "/foundation-dependency-test";
      await createResource(testPath, "Foundation dependency test");

      // Test that HEAD works when OPTIONS works
      const optionsResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(optionsResponse.status).to.equal(204);
      expect(optionsResponse.allow & 1n).to.equal(1n); // HEAD allowed

      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(200);

      // This confirms the dependency: if OPTIONS works, HEAD should work
      // (assuming HEAD is allowed in the methods bitmask)
    });

  });

}); 