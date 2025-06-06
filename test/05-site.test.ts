import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPSite } from "../typechain-types/contracts/test/TestWTTPSite";
import { IDataPointRegistry, IDataPointStorage } from "@wttp/core";

describe("05 - WTTP Site Security Audit & Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointRegistry: IDataPointRegistry;
  let dataPointStorage: IDataPointStorage;
  let owner: SignerWithAddress;
  let siteAdmin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let attacker: SignerWithAddress;

  // Role identifiers
  let defaultAdminRole: string;
  let siteAdminRole: string;
  let publicRole: string;
  let blacklistRole: string;

  // Test data
  let testHeader: any;
  let restrictedHeader: any;
  
  // Method enum values (0-8)
  const Method = {
    HEAD: 0,
    GET: 1,
    POST: 2,
    PUT: 3,
    PATCH: 4,
    DELETE: 5,
    OPTIONS: 6,
    LOCATE: 7,
    DEFINE: 8
  };

  before(async function () {
    [owner, siteAdmin, user1, user2, attacker] = await ethers.getSigners();
    const { dps, dpr } = await loadEspContracts();
    dataPointStorage = dps;
    dataPointRegistry = dpr;
  });

  beforeEach(async function () {
    // Get role identifiers using constants
    defaultAdminRole = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE is 0x00...00
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // PUBLIC_ROLE is max uint256
    blacklistRole = ethers.id("BLACKLIST_ROLE");
    
    // Create test headers with different permission configurations
    testHeader = {
      cors: {
        origins: [
          publicRole, // HEAD - public
          publicRole, // GET - public  
          ethers.id("POST_ROLE"),                     // POST - restricted
          ethers.id("PUT_ROLE"),                      // PUT - restricted
          ethers.id("PATCH_ROLE"),                    // PATCH - restricted
          ethers.id("DELETE_ROLE"),                   // DELETE - restricted
          publicRole, // OPTIONS - public
          publicRole, // LOCATE - public
          ethers.id("DEFINE_ROLE")                    // DEFINE - restricted
        ],
        methods: 511, // All methods allowed (2^9 - 1)
        preset: 1, // PUBLIC
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

    restrictedHeader = {
      cors: {
        origins: Array(9).fill(ethers.id("ADMIN_ONLY_ROLE")), // All methods admin only
        methods: 511,
        preset: 5, // PRIVATE
        custom: ""
      },
      cache: {
        immutableFlag: true, // Test immutable resource
        preset: 6, // PERMANENT
        custom: ""
      },
      redirect: {
        code: 301,
        location: "https://example.com/redirect"
      }
    };

    // Deploy TestWTTPSite for each test
    const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
    testWTTPSite = await TestWTTPSiteFactory.deploy(
      await dataPointRegistry.getAddress(),
      testHeader,
      owner.address
    );
    await testWTTPSite.waitForDeployment();

    // Grant roles for testing
    await testWTTPSite.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
    await testWTTPSite.connect(owner).grantRole(ethers.id("PUT_ROLE"), user1.address);
    await testWTTPSite.connect(owner).grantRole(ethers.id("PATCH_ROLE"), user1.address);
    await testWTTPSite.connect(owner).grantRole(ethers.id("DELETE_ROLE"), user1.address);
    await testWTTPSite.connect(owner).grantRole(ethers.id("DEFINE_ROLE"), user1.address);
  });

  describe("🚨 Critical Security Audit - Method Authorization", function () {
    
    it("should properly validate method authorization for each HTTP method", async function () {
      const testPath = "/test-authorization";
      
      // Test unauthorized access to restricted methods
      await expect(
        testWTTPSite.connect(attacker).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
          data: []
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Test method not allowed scenarios
      const restrictedPath = "/restricted-resource";
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: restrictedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader
      });

      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: restrictedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("🚨 VULNERABILITY TEST: Attempt header manipulation to bypass authorization", async function () {
      console.log("🔍 Testing header manipulation attack vectors...");
      
      const maliciousPath = "/malicious-test";
      
      // Create a malicious header that tries to grant public access to restricted methods
      const maliciousHeader = {
        cors: {
          origins: Array(9).fill(publicRole), // Try to make everything public
          methods: 511,
          preset: 1,
          custom: ""
        },
        cache: { immutableFlag: false, preset: 0, custom: "" },
        redirect: { code: 0, location: "" }
      };

      try {
        // Attacker tries to define a resource with malicious header
        await testWTTPSite.connect(attacker).DEFINE({
          head: { path: maliciousPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: maliciousHeader
        });
        console.log("🚨 CRITICAL: Attacker can define malicious headers!");
      } catch (error) {
        console.log("✅ Header manipulation properly blocked");
      }

      // Even if header was created, test if authorization is still enforced
      try {
        await testWTTPSite.connect(attacker).PUT({
          head: { path: maliciousPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
          data: []
        });
        console.log("🚨 CRITICAL: Authorization bypass via header manipulation!");
      } catch (error) {
        console.log("✅ Authorization still enforced despite malicious header");
      }
    });

    it("should correctly handle DEFAULT_ADMIN_ROLE super admin privileges", async function () {
      const testPath = "/admin-test";
      
      // Admin should be able to access any method regardless of header configuration
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: restrictedHeader // All methods admin-only
      });

      // Admin should still have access
      const response = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(response.status).to.equal(204);
      
      const headResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(301);
    });
  });

  describe("🌐 HTTP Method Implementation Testing", function () {
    
    it("should properly implement OPTIONS method with method discovery", async function () {
      const testPath = "/options-test";
      
      // Test OPTIONS on non-existent resource (should still work)
      const response = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(511); // All methods from default header
      
      // Create resource with restricted methods
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          cors: {
            origins: Array(9).fill(publicRole),
            methods: 71, // HEAD, GET, POST, OPTIONS allowed (binary: 1000111)
            preset: 0,
            custom: ""
          },
          cache: { immutableFlag: false, preset: 0, custom: "" },
          redirect: { code: 0, location: "" }
        }
      });
      
      const restrictedResponse = await testWTTPSite.connect(user1).OPTIONS(testPath);
      expect(restrictedResponse.allow).to.equal(71);
    });

    it("should implement HEAD method with conditional headers and ETags", async function () {
      const testPath = "/head-test";
      const testData = createUniqueData("HEAD test content");
      
      // Create resource
      await testWTTPSite.connect(user1).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7465", charset: "0x7574", encoding: "0x6762", language: "0x656e" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
      });
      
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.status).to.equal(200);
      expect(headResponse.metadata.size).to.be.greaterThan(0);
      expect(headResponse.etag).to.not.equal(ethers.ZeroHash);
      
      // Test conditional request with matching ETag (should return 304)
      const conditionalResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: headResponse.etag
      });
      expect(conditionalResponse.status).to.equal(304);
    });

    it("should implement LOCATE method for data point discovery", async function () {
      const testPath = "/locate-test";
      const testData = createUniqueData("LOCATE test content");
      
      // Create resource with multiple chunks
      await testWTTPSite.connect(user1).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: [
          { data: ethers.toUtf8Bytes(testData + " chunk1"), chunkIndex: 0, publisher: user1.address },
          { data: ethers.toUtf8Bytes(testData + " chunk2"), chunkIndex: 1, publisher: user1.address }
        ]
      });
      
      const locateResponse = await testWTTPSite.connect(user1).LOCATE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(locateResponse.head.status).to.equal(200);
      expect(locateResponse.dataPoints.length).to.equal(2);
      expect(locateResponse.dataPoints[0]).to.not.equal(ethers.ZeroHash);
    });

    it("should implement GET method as alias for LOCATE", async function () {
      const testPath = "/get-test";
      const testData = createUniqueData("GET test content");
      
      await testWTTPSite.connect(user1).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
      });
      
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(getResponse.head.status).to.equal(200);
      expect(getResponse.dataPoints.length).to.be.greaterThan(0);
    });
  });

  describe("🔧 Resource Lifecycle Management", function () {
    
    it("should implement DEFINE method for header creation/updates", async function () {
      const testPath = "/define-test";
      
      const customHeader = {
        cors: {
          origins: [publicRole, publicRole, ethers.id("SPECIAL_ROLE"), publicRole, publicRole, publicRole, publicRole, publicRole, publicRole],
          methods: 255,
          preset: 0,
          custom: "custom-cors-config"
        },
        cache: {
          immutableFlag: true,
          preset: 3,
          custom: "max-age=3600"
        },
        redirect: {
          code: 302,
          location: "/redirected-resource"
        }
      };
      
      // Use staticCall to get the return value without sending transaction
      const defineResult = await testWTTPSite.connect(user1).DEFINE.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      
      expect(defineResult.head.status).to.equal(201);
      expect(defineResult.headerAddress).to.not.equal(ethers.ZeroHash);
      
      // Actually execute the transaction
      await testWTTPSite.connect(user1).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      
      // Verify header was stored correctly
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.headerInfo.cache.immutableFlag).to.be.true;
      expect(headResponse.headerInfo.redirect.code).to.equal(302);
    });

    it("should implement PUT method for resource creation and replacement", async function () {
      const testPath = "/put-test";
      const testData1 = createUniqueData("PUT test content v1");
      const testData2 = createUniqueData("PUT test content v2");
      
      // Create new resource
      const putResult1 = await testWTTPSite.connect(user1).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7465", charset: "0x7574", encoding: "0x6762", language: "0x656e" },
        data: [{ data: ethers.toUtf8Bytes(testData1), chunkIndex: 0, publisher: user1.address }]
      });
      console.log("putResult1", putResult1);
      console.log("putResult1.dataPoints", putResult1.dataPoints);
      
      expect(putResult1.head.status).to.equal(201); // Created
      expect(putResult1.dataPoints.length).to.equal(1);
      
      // Execute the transaction
      await testWTTPSite.connect(user1).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7465", charset: "0x7574", encoding: "0x6762", language: "0x656e" },
        data: [{ data: ethers.toUtf8Bytes(testData1), chunkIndex: 0, publisher: user1.address }]
      });
      
      // Replace existing resource
      const putResult2 = await testWTTPSite.connect(user1).PUT.staticCall({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7465", charset: "0x7574", encoding: "0x6762", language: "0x656e" },
        data: [{ data: ethers.toUtf8Bytes(testData2), chunkIndex: 0, publisher: user1.address }]
      });
      
      expect(putResult2.head.status).to.equal(200); // OK (updated)
    });

    it("should implement DELETE method with proper cleanup", async function () {
      const testPath = "/delete-test";
      const testData = createUniqueData("Content to be deleted");
      
      // Create resource
      await testWTTPSite.connect(user1).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
      });
      
      // Verify resource exists
      const headBefore = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headBefore.status).to.equal(200);
      
      // Delete resource
      const deleteResult = await testWTTPSite.connect(user1).DELETE.staticCall({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(deleteResult.status).to.equal(204); // No Content
      
      // Execute deletion
      await testWTTPSite.connect(user1).DELETE({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      // Verify resource is gone
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: testPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });
  });

  describe("🛡️ Edge Cases and Error Handling", function () {
    
    it("should handle non-existent resources correctly", async function () {
      const nonExistentPath = "/does-not-exist";
      
      // HEAD on non-existent resource should return 404
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: nonExistentPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      
      // LOCATE on non-existent resource should return 404
      await expect(
        testWTTPSite.connect(user1).LOCATE({
          path: nonExistentPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      
      // OPTIONS should work even on non-existent resources
      const optionsResponse = await testWTTPSite.connect(user1).OPTIONS(nonExistentPath);
      expect(optionsResponse.status).to.equal(204);
    });

    it("should handle immutable resource modification attempts", async function () {
      const immutablePath = "/immutable-test";
      
      // First create the resource with content, then make it immutable
      await testWTTPSite.connect(user1).PUT({
        head: { path: immutablePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: [{ data: ethers.toUtf8Bytes("immutable content"), chunkIndex: 0, publisher: user1.address }]
      });
      
      // Now define the resource as immutable
      await testWTTPSite.connect(owner).DEFINE({
        head: { path: immutablePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          cors: {
            origins: Array(9).fill(publicRole),
            methods: 511,
            preset: 0,
            custom: ""
          },
          cache: { immutableFlag: true, preset: 6, custom: "" },
          redirect: { code: 0, location: "" }
        }
      });
      
      // Attempt to modify immutable resource should fail
      await expect(
        testWTTPSite.connect(user1).PUT({
          head: { path: immutablePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
          data: [{ data: ethers.toUtf8Bytes("new content"), chunkIndex: 0, publisher: user1.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_409");
    });
  });

  describe("🔍 Internal Function Security Audit", function () {
    
    it("should test internal authorization logic through test contract", async function () {
      const testPath = "/internal-test";
      
      // Test _getAuthorizedRole function
      const authorizedRole = await testWTTPSite.getAuthorizedRole(testPath, Method.PUT);
      expect(authorizedRole).to.equal(ethers.id("PUT_ROLE"));
      
      // Test _isAuthorized function
      const isAuthorized = await testWTTPSite.isAuthorized(testPath, Method.PUT, user1.address);
      expect(isAuthorized).to.be.true;
      
      const isNotAuthorized = await testWTTPSite.isAuthorized(testPath, Method.PUT, attacker.address);
      expect(isNotAuthorized).to.be.false;
      
      // Test _methodAllowed function
      const methodAllowed = await testWTTPSite.methodAllowed(testPath, Method.HEAD);
      expect(methodAllowed).to.be.true;
    });

    it("should test method bit manipulation security", async function () {
      // Test method bit generation
      expect(await testWTTPSite.getMethodBit(Method.HEAD)).to.equal(1);
      expect(await testWTTPSite.getMethodBit(Method.GET)).to.equal(2);
      expect(await testWTTPSite.getMethodBit(Method.PUT)).to.equal(8);
      
      // Test method bit checking
      expect(await testWTTPSite.isMethodBitSet(511, Method.HEAD)).to.be.true;
      expect(await testWTTPSite.isMethodBitSet(511, Method.DEFINE)).to.be.true;
      expect(await testWTTPSite.isMethodBitSet(7, Method.DELETE)).to.be.false; // 7 = 111 binary (HEAD,GET,POST)
    });

    it("should test resource state edge cases", async function () {
      const edgePath = "/edge-test";
      
      // Test resource existence before creation
      expect(await testWTTPSite.resourceExistsPublic(edgePath)).to.be.false;
      
      // Test metadata reading of non-existent resource
      const emptyMetadata = await testWTTPSite.readMetadataPublic(edgePath);
      expect(emptyMetadata.size).to.equal(0);
      expect(emptyMetadata.version).to.equal(0);
      
      // Create resource and test state
      await testWTTPSite.connect(user1).PUT({
        head: { path: edgePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x0000", charset: "0x0000", encoding: "0x0000", language: "0x0000" },
        data: [{ data: ethers.toUtf8Bytes("test"), chunkIndex: 0, publisher: user1.address }]
      });
      
      expect(await testWTTPSite.resourceExistsPublic(edgePath)).to.be.true;
      
      const metadata = await testWTTPSite.readMetadataPublic(edgePath);
      expect(metadata.size).to.be.greaterThan(0);
      expect(metadata.version).to.equal(1); // 0 for header creation, 1 for data point creation
    });
  });
});
