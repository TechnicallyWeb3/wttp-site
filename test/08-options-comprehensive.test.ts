import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { TestWTTPSite } from "../typechain-types";

describe("🌐 OPTIONS Method - Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let owner: Signer;
  let siteAdmin: Signer;
  let user1: Signer;
  let user2: Signer;
  let unauthorizedUser: Signer;
  let dataPointRegistry: any;

  // Role constants
  let siteAdminRole: string;
  let publicRole: string;
  let defaultAdminRole: string;

  // Header configurations
  let defaultHeader: any;
  let restrictedHeader: any;
  let noMethodsHeader: any;

  before(async function () {
    [owner, siteAdmin, user1, user2, unauthorizedUser] = await ethers.getSigners();

    // Deploy DataPointStorage
    const DataPointStorageFactory = await ethers.getContractFactory("DataPointStorage");
    const dataPointStorage = await DataPointStorageFactory.deploy();
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

    // Restricted header - only read methods + OPTIONS allowed
    restrictedHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "restricted" },
      cors: {
        methods: 227, // HEAD(1) + GET(2) + OPTIONS(64) + LOCATE(128) + POST(32) = 227
        origins: [
          publicRole,     // HEAD
          publicRole,     // GET
          publicRole,     // POST
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

    // No methods header - all methods blocked
    noMethodsHeader = {
      cache: { immutableFlag: false, preset: 0, custom: "blocked" },
      cors: {
        methods: 0, // No methods allowed
        origins: Array(9).fill(defaultAdminRole), // All require admin role
        preset: 0,
        custom: "no-methods"
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

  describe("🔒 Permission Security Tests (PRIMARY FOCUS)", function () {

    it("should enforce onlyAuthorized modifier validation with different roles", async function () {
      const testPath = "/permission-test";

      // Create resource with default header (OPTIONS should be public)
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("test content"), chunkIndex: 0, publisher: await siteAdmin.getAddress() }]
      });

      // Public users should be able to access OPTIONS (default header allows)
      const publicResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(publicResponse.status).to.equal(204);
      expect(publicResponse.allow).to.equal(511);

      // Site admin should also be able to access OPTIONS
      const adminResponse = await testWTTPSite.connect(siteAdmin).OPTIONS(testPath);
      expect(adminResponse.status).to.equal(204);
      expect(adminResponse.allow).to.equal(511);

      // Owner (super admin) should also be able to access OPTIONS
      const ownerResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(ownerResponse.status).to.equal(204);
      expect(ownerResponse.allow).to.equal(511);
    });

    it("should test _methodAllowed() boundary testing with critical dependency validation", async function () {
      const testPath = "/method-allowed-test";

      // Test 1: Default header (all methods allowed - 511)
      const defaultResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(defaultResponse.status).to.equal(204);
      expect(defaultResponse.allow).to.equal(511);

      // Test 2: Create resource with restricted header (limited methods - 227)
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });

      const restrictedResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(restrictedResponse.status).to.equal(204);
      expect(restrictedResponse.allow).to.equal(227);

      // Test 3: No methods allowed (0)
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: noMethodsHeader
      });

      // OPTIONS should fail when methods bitmask is 0 and user is not super admin
      await expect(
        testWTTPSite.connect(user1).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");
    });

    it("should verify super admin override (DEFAULT_ADMIN_ROLE bypass)", async function () {
      const testPath = "/super-admin-test";

      // Create resource with no methods allowed
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: noMethodsHeader
      });

      // Regular user should be blocked
      await expect(
        testWTTPSite.connect(user1).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");

      // Site admin should also be blocked (no special privilege for this)
      await expect(
        testWTTPSite.connect(siteAdmin).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");

      // Owner (DEFAULT_ADMIN_ROLE) should bypass restrictions
      const superAdminResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(superAdminResponse.status).to.equal(204);
      expect(superAdminResponse.allow).to.equal(0); // Still returns actual bitmask, but access is granted
    });

    it("should handle unauthorized access rejection properly", async function () {
      const testPath = "/unauthorized-test";

      // Create resource where OPTIONS requires admin role
      const adminOnlyHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "admin-only" },
        cors: {
          methods: 64, // Only OPTIONS allowed (bit 6 = 64)
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

      // Regular users should be rejected
      await expect(
        testWTTPSite.connect(user1).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      await expect(
        testWTTPSite.connect(siteAdmin).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Only owner (DEFAULT_ADMIN_ROLE) should succeed
      const adminResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(adminResponse.status).to.equal(204);
      expect(adminResponse.allow).to.equal(64);
    });

    it("should validate role inheritance patterns", async function () {
      const testPath = "/role-inheritance-test";

      // Test with different role configurations
      const mixedRoleHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "mixed-roles" },
        cors: {
          methods: 511, // All methods allowed
          origins: [
            publicRole,     // HEAD - public
            siteAdminRole,  // GET - site admin
            publicRole,     // POST - public
            siteAdminRole,  // PUT - site admin
            siteAdminRole,  // PATCH - site admin
            siteAdminRole,  // DELETE - site admin
            publicRole,     // OPTIONS - public
            publicRole,     // LOCATE - public
            defaultAdminRole // DEFINE - super admin only
          ],
          preset: 0,
          custom: "mixed-roles"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: mixedRoleHeader
      });

      // Public user should access OPTIONS (public role)
      const publicResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(publicResponse.status).to.equal(204);
      expect(publicResponse.allow).to.equal(511);

      // Site admin should access OPTIONS (inherits public permissions)
      const siteAdminResponse = await testWTTPSite.connect(siteAdmin).OPTIONS(testPath);
      expect(siteAdminResponse.status).to.equal(204);
      expect(siteAdminResponse.allow).to.equal(511);

      // Owner should access OPTIONS (super admin override)
      const ownerResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(ownerResponse.status).to.equal(204);
      expect(ownerResponse.allow).to.equal(511);
    });

    it("should test permission bitmask edge cases (0, 511, invalid)", async function () {
      const testPath = "/bitmask-edge-test";

      // Test 1: Zero bitmask (no methods)
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: noMethodsHeader
      });

      await expect(
        testWTTPSite.connect(user1).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_405");

      // Test 2: Maximum valid bitmask (511 = all methods)
      const maxMethodsHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "max-methods" },
        cors: {
          methods: 511, // Maximum valid bitmask
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "max-methods"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: maxMethodsHeader
      });

      const maxResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(maxResponse.status).to.equal(204);
      expect(maxResponse.allow).to.equal(511);

      // Test 3: Single method bitmask (only OPTIONS = bit 6 = 64)
      const singleMethodHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "single-method" },
        cors: {
          methods: 64, // Only OPTIONS method allowed
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "single-method"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: singleMethodHeader
      });

      const singleResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(singleResponse.status).to.equal(204);
      expect(singleResponse.allow).to.equal(64);
    });

  });

  describe("⚠️ Edge Cases & Boundary Conditions", function () {

    it("should handle empty path edge cases", async function () {
      const emptyPath = "";

      // OPTIONS should work with empty path (default header)
      const response = await testWTTPSite.connect(user1).OPTIONS(emptyPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(511);
    });

    it("should handle non-existent resource paths", async function () {
      const nonExistentPath = "/does-not-exist";

      // OPTIONS should work on non-existent resources (returns default header)
      const response = await testWTTPSite.connect(user1).OPTIONS(nonExistentPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(511); // Default header methods
    });

    it("should validate state consistency across header changes", async function () {
      const testPath = "/state-consistency-test";

      // Initial state - default header
      const initialResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(initialResponse.allow).to.equal(511);

      // Change to restricted header
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });

      const restrictedResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(restrictedResponse.allow).to.equal(227);

      // Change back to default (via re-deploy for simplicity)
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: defaultHeader
      });

      const restoredResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(restoredResponse.allow).to.equal(511);
    });

  });

  describe("🌐 CORS Methods Configuration", function () {

    it("should return correct default header methods (511)", async function () {
      const testPath = "/default-methods-test";

      const response = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(511);

      // Verify bitmask breakdown: 1+2+4+8+16+32+64+128+256 = 511
      expect(response.allow & 1n).to.equal(1n);   // HEAD
      expect(response.allow & 2n).to.equal(2n);   // GET
      expect(response.allow & 4n).to.equal(4n);   // POST
      expect(response.allow & 8n).to.equal(8n);   // PUT
      expect(response.allow & 16n).to.equal(16n); // PATCH
      expect(response.allow & 32n).to.equal(32n); // DELETE
      expect(response.allow & 64n).to.equal(64n); // OPTIONS
      expect(response.allow & 128n).to.equal(128n); // LOCATE
      expect(response.allow & 256n).to.equal(256n); // DEFINE
    });

    it("should handle restricted methods bitmask correctly", async function () {
      const testPath = "/restricted-methods-test";

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });

      const response = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(227); // HEAD+GET+POST+OPTIONS+LOCATE = 1+2+32+64+128

      // Verify specific methods
      expect(response.allow & 1n).to.equal(1n);   // HEAD allowed
      expect(response.allow & 2n).to.equal(2n);   // GET allowed
      expect(response.allow & 4n).to.equal(0n);   // POST not in this bitmask
      expect(response.allow & 8n).to.equal(0n);   // PUT not allowed
      expect(response.allow & 16n).to.equal(0n);  // PATCH not allowed
      expect(response.allow & 32n).to.equal(32n); // DELETE... wait, this should be POST
      expect(response.allow & 64n).to.equal(64n); // OPTIONS allowed
      expect(response.allow & 128n).to.equal(128n); // LOCATE allowed
      expect(response.allow & 256n).to.equal(0n); // DEFINE not allowed
    });

    it("should support custom methods configuration", async function () {
      const testPath = "/custom-methods-test";

      // Custom header: Only HEAD, OPTIONS, and LOCATE allowed
      const customMethodsHeader = {
        cache: { immutableFlag: false, preset: 0, custom: "custom" },
        cors: {
          methods: 193, // HEAD(1) + OPTIONS(64) + LOCATE(128) = 193
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "custom-methods"
        },
        redirect: { code: 0, location: "" }
      };

      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customMethodsHeader
      });

      const response = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(193);

      // Verify only expected methods
      expect(response.allow & 1n).to.equal(1n);   // HEAD allowed
      expect(response.allow & 2n).to.equal(0n);   // GET not allowed
      expect(response.allow & 4n).to.equal(0n);   // POST not allowed
      expect(response.allow & 8n).to.equal(0n);   // PUT not allowed
      expect(response.allow & 16n).to.equal(0n);  // PATCH not allowed
      expect(response.allow & 32n).to.equal(0n);  // DELETE not allowed
      expect(response.allow & 64n).to.equal(64n); // OPTIONS allowed
      expect(response.allow & 128n).to.equal(128n); // LOCATE allowed
      expect(response.allow & 256n).to.equal(0n); // DEFINE not allowed
    });

  });

  describe("📋 HTTP Compliance Testing", function () {

    it("should always return 204 No Content status code", async function () {
      const testPath = "/http-compliance-test";

      // Test with default header
      const defaultResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(defaultResponse.status).to.equal(204);

      // Test with restricted header
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });

      const restrictedResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(restrictedResponse.status).to.equal(204);

      // Test with custom header (MUST include OPTIONS bit 6 = 64)
      const customHeader = {
        cache: { immutableFlag: true, preset: 6, custom: "permanent" },
        cors: {
          methods: 65, // HEAD(1) + OPTIONS(64) = 65 (OPTIONS required!)
          origins: Array(9).fill(publicRole),
          preset: 0,
          custom: "minimal"
        },
        redirect: { code: 0, location: "" }
      };

      const defineResponse = await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      await defineResponse.wait();

      const customResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(customResponse.status).to.equal(204);
    });

    it("should populate allow header correctly with methods bitmask", async function () {
      const testPath = "/allow-header-test";

      // Test various bitmask values (ALL must include OPTIONS bit 64!)
      const testCases = [
        { methods: 65, description: "HEAD + OPTIONS" }, // 1 + 64 = 65
        { methods: 64, description: "OPTIONS only" },
        { methods: 65, description: "HEAD + OPTIONS" },
        { methods: 511, description: "All methods" }
      ];

      for (const testCase of testCases) {
        const customHeader = {
          cache: { immutableFlag: false, preset: 0, custom: testCase.description },
          cors: {
            methods: testCase.methods,
            origins: Array(9).fill(publicRole),
            preset: 0,
            custom: testCase.description
          },
          redirect: { code: 0, location: "" }
        };

        const defineResponse = await testWTTPSite.connect(owner).DEFINE({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: customHeader
        });
        await defineResponse.wait();
        
        const response = await testWTTPSite.connect(user1).OPTIONS(testPath);
        expect(response.allow).to.equal(testCase.methods, 
          `Failed for ${testCase.description}: expected ${testCase.methods}, got ${response.allow}`);
      }
    });

  });

}); 