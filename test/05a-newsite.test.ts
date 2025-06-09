import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPSite } from "../typechain-types/contracts/test/TestWTTPSite";
import { ALL_METHODS_BITMASK, IDataPointRegistry, IDataPointStorage } from "@wttp/core";

describe("05a - WTTP Site Systematic Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointRegistry: IDataPointRegistry;
  let dataPointStorage: IDataPointStorage;
  let owner: SignerWithAddress;
  let siteAdmin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  // Additional users for permission testing
  let headUser: SignerWithAddress;
  let getUser: SignerWithAddress;
  let postUser: SignerWithAddress;
  let putUser: SignerWithAddress;
  let patchUser: SignerWithAddress;
  let deleteUser: SignerWithAddress;
  let optionsUser: SignerWithAddress;
  let locateUser: SignerWithAddress;
  let defineUser: SignerWithAddress;

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

  // Role identifiers
  let defaultAdminRole: string;
  let siteAdminRole: string;
  let publicRole: string;
  
  // Method-specific roles
  let headRole: string;
  let getRole: string;
  let postRole: string;
  let putRole: string;
  let patchRole: string;
  let deleteRole: string;
  let optionsRole: string;
  let locateRole: string;
  let defineRole: string;

  // Default header configuration for new sites
  let defaultHeader: any;
  let permissionTestHeader: any;
  let permissionTestPath: string;

  before(async function () {
    [owner, siteAdmin, user1, user2, headUser, getUser, postUser, putUser, patchUser, deleteUser, optionsUser, locateUser, defineUser] = await ethers.getSigners();
    const { dps, dpr } = await loadEspContracts();
    dataPointStorage = dps;
    dataPointRegistry = dpr;

    // Get role identifiers
    defaultAdminRole = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE is 0x00...00
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; // PUBLIC_ROLE is max uint256

    // Create method-specific roles
    headRole = ethers.id("HEAD_ROLE");
    getRole = ethers.id("GET_ROLE");
    postRole = ethers.id("POST_ROLE");
    putRole = ethers.id("PUT_ROLE"); // siteAdminRole; // Use existing siteAdminRole for PUT
    patchRole = ethers.id("PATCH_ROLE");
    deleteRole = ethers.id("DELETE_ROLE");
    optionsRole = ethers.id("OPTIONS_ROLE");
    locateRole = ethers.id("LOCATE_ROLE");
    defineRole = ethers.id("DEFINE_ROLE");

    // Create a typical default header configuration
    defaultHeader = {
      cache: {
        immutableFlag: false,
        preset: 0,
        custom: ""
      },
      cors: {
        methods: 511, // All methods allowed (2^9 - 1)
        origins: [
          publicRole,     // HEAD - public
          publicRole,     // GET - public  
          publicRole,     // POST - public (not used in TestWTTPSite)
          siteAdminRole,  // PUT - site admin
          siteAdminRole,  // PATCH - site admin
          siteAdminRole,  // DELETE - site admin
          publicRole,     // OPTIONS - public
          publicRole,     // LOCATE - public
          siteAdminRole   // DEFINE - site admin
        ],
        preset: 1, // PUBLIC
        custom: ""
      },
      redirect: {
        code: 0,
        location: ""
      }
    };

    // Create permission test header with unique role for each method
    permissionTestHeader = {
      cache: {
        immutableFlag: false,
        preset: 0,
        custom: ""
      },
      cors: {
        methods: ALL_METHODS_BITMASK, // All methods allowed (2^9 - 1)
        origins: [
          headRole,     // HEAD - unique role
          getRole,      // GET - unique role
          postRole,     // POST - unique role
          putRole,      // PUT - siteAdminRole (reused)
          patchRole,    // PATCH - unique role
          deleteRole,   // DELETE - unique role
          optionsRole,  // OPTIONS - unique role
          locateRole,   // LOCATE - unique role
          defineRole    // DEFINE - unique role
        ],
        preset: 0,
        custom: "permission-test"
      },
      redirect: {
        code: 0,
        location: ""
      }
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

    // Grant site admin role for testing
    await testWTTPSite.connect(owner).grantRole(siteAdminRole, siteAdmin.address);
  });

  describe("📖 Read Methods - Basic Functionality", function () {
    
    it("should handle HEAD method on non-existent resource (404)", async function () {
      const nonExistentPath = "/does-not-exist";
      
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: nonExistentPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle GET method on non-existent resource (404)", async function () {
      const nonExistentPath = "/does-not-exist";
      
      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: nonExistentPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle OPTIONS method on non-existent resource (should work)", async function () {
      const nonExistentPath = "/does-not-exist";
      
      const response = await testWTTPSite.connect(user1).OPTIONS(nonExistentPath);
      expect(response.status).to.equal(204);
      expect(response.allow).to.equal(511); // All methods from default header
    });

  });

  describe("✏️ Write Methods - Basic Functionality", function () {

    it("should handle PUT method to create a new resource", async function () {
      const testPath = "/new-resource";
      const testData = createUniqueData("Test content for PUT");
      
      const putResponse = await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Should succeed
      expect(putResponse).to.not.be.reverted;
      await putResponse.wait();

      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse.head.status).to.equal(200);
      expect(getResponse.dataPoints[0]).not.to.equal(ethers.ZeroHash);

    });

    it("should reject PUT method from unauthorized user", async function () {
      const testPath = "/unauthorized-resource";
      const testData = createUniqueData("Unauthorized content");
      
      await expect(
        testWTTPSite.connect(user1).PUT({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: user1.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should handle DEFINE method to set custom headers", async function () {
      const testPath = "/custom-header-resource";
      
      const customHeader = {
        cors: {
          origins: Array(9).fill(publicRole), // All methods public for this test
          methods: 511,
          preset: 0,
          custom: "test-custom-cors"
        },
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: "test-custom-cache"
        },
        redirect: {
          code: 0,
          location: ""
        }
      };

      const defineResponse = await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      
      // Should succeed
      expect(defineResponse).to.not.be.reverted;
    });

    it("should reject DEFINE method from unauthorized user", async function () {
      const testPath = "/unauthorized-header";
      
      const customHeader = {
        cors: {
          origins: Array(9).fill(publicRole),
          methods: 511,
          preset: 0,
          custom: ""
        },
        cache: { immutableFlag: false, preset: 0, custom: "" },
        redirect: { code: 0, location: "" }
      };

      await expect(
        testWTTPSite.connect(user1).DEFINE({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: customHeader
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

  });

  describe("🔗 Read-Write Integration", function () {

    it("should create resource with PUT then read it with HEAD", async function () {
      const testPath = "/integration-test";
      const testData = createUniqueData("Integration test content");
      
      // Create resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Read resource metadata
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse.status).to.equal(200);
      expect(headResponse.metadata.size).to.be.greaterThan(0);
    });

    it("should create resource with PUT then read it with GET", async function () {
      const testPath = "/get-integration-test";
      const testData = createUniqueData("GET integration test content");
      
      // Create resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Read resource data
      const getResponse = await testWTTPSite.connect(user1).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      
      expect(getResponse.head.status).to.equal(200);
      expect(getResponse.dataPoints.length).to.equal(1);
      expect(getResponse.dataPoints[0]).to.not.equal(ethers.ZeroHash);
    });

  });

  describe("🔐 Comprehensive Permission Testing", function () {

    beforeEach(async function () {
      // create the resource admin roles for the permission test
      await testWTTPSite.connect(owner).createResourceRole(headRole);
      await testWTTPSite.connect(owner).createResourceRole(getRole);
      await testWTTPSite.connect(owner).createResourceRole(postRole);
      await testWTTPSite.connect(owner).createResourceRole(putRole);
      await testWTTPSite.connect(owner).createResourceRole(patchRole);
      await testWTTPSite.connect(owner).createResourceRole(deleteRole);
      await testWTTPSite.connect(owner).createResourceRole(optionsRole);
      await testWTTPSite.connect(owner).createResourceRole(locateRole);
      await testWTTPSite.connect(owner).createResourceRole(defineRole);
      // now site admin can manage the resource roles

      // Create method-specific roles and grant them to respective users
      await testWTTPSite.connect(siteAdmin).grantRole(headRole, headUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(getRole, getUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(postRole, postUser.address);
      // putRole is siteAdminRole, so putUser gets siteAdminRole
      await testWTTPSite.connect(siteAdmin).grantRole(putRole, putUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(patchRole, patchUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(deleteRole, deleteUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(optionsRole, optionsUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(locateRole, locateUser.address);
      await testWTTPSite.connect(siteAdmin).grantRole(defineRole, defineUser.address);

      permissionTestPath = "/permission-test";
      // Apply permission test header to a test resource
      await testWTTPSite.connect(owner).testSiteSetDefaultHeader(permissionTestHeader);

      // TODO: Apply permission test header to a test resource - DEFINE issue to investigate
      // await testWTTPSite.connect(owner).DEFINE({
      //   head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
      //   data: permissionTestHeader
      // });

      // Create a resource for testing read methods
      await testWTTPSite.connect(owner).PUT({
        head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("Permission test content")), chunkIndex: 0, publisher: siteAdmin.address }]
      });
    });

    it("should have correct methods and origin roles from the default header", async function () {
      const headResponse = await testWTTPSite.connect(headUser).HEAD({
        path: permissionTestPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });

      expect(headResponse.status).to.equal(200);
      expect(headResponse.headerInfo.cors.methods).to.equal(ALL_METHODS_BITMASK);
      expect(headResponse.headerInfo.cors.origins[0]).to.equal(headRole);
    });

    it("should allow HEAD access only to headUser and owner", async function () {
      
      // headUser should have access
      const headResponse = await testWTTPSite.connect(headUser).HEAD({
        path: permissionTestPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(200);

      // owner should have access (admin override)
      const ownerHeadResponse = await testWTTPSite.connect(owner).HEAD({
        path: permissionTestPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(ownerHeadResponse.status).to.equal(200);

      // getUserUser should NOT have access
      await expect(
        testWTTPSite.connect(getUser).HEAD({
          path: permissionTestPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Regular user should NOT have access
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: permissionTestPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow GET access only to getUserUser and owner", async function () {
      
      // getUserUser should have access
      const getResponse = await testWTTPSite.connect(getUser).GET({
        head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse.head.status).to.equal(200);

      // owner should have access (admin override)
      const ownerGetResponse = await testWTTPSite.connect(owner).GET({
        head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(ownerGetResponse.head.status).to.equal(200);

      // headUser should NOT have access
      await expect(
        testWTTPSite.connect(headUser).GET({
          head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Regular user should NOT have access
      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: permissionTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow OPTIONS access only to optionsUser and owner", async function () {
      const testPath = "/permission-test";
      
      // optionsUser should have access
      const optionsResponse = await testWTTPSite.connect(optionsUser).OPTIONS(testPath);
      expect(optionsResponse.status).to.equal(204);

      // owner should have access (admin override)
      const ownerOptionsResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(ownerOptionsResponse.status).to.equal(204);

      // headUser should NOT have access
      await expect(
        testWTTPSite.connect(headUser).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");

      // Regular user should NOT have access
      await expect(
        testWTTPSite.connect(user1).OPTIONS(testPath)
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow PUT access only to putUser (siteAdmin) and owner", async function () {
      const testPath = "/permission-test-put";
      const testData = createUniqueData("PUT permission test");
      
      // putUser should have access (has siteAdminRole)
      const putResponse = await testWTTPSite.connect(putUser).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: putUser.address }]
      });
      expect(putResponse).to.not.be.reverted;

      // owner should have access (admin override)
      const ownerPutResponse = await testWTTPSite.connect(owner).PUT({
        head: { path: testPath + "-owner", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("Owner PUT test")), chunkIndex: 0, publisher: owner.address }]
      });
      expect(ownerPutResponse).to.not.be.reverted;

      // headUser should NOT have access
      await expect(
        testWTTPSite.connect(headUser).PUT({
          head: { path: testPath + "-unauthorized", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
          data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: headUser.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow PATCH access only to patchUser and owner", async function () {
      const testPath = "/permission-test";
      const additionalData = createUniqueData("PATCH permission test");
      
      // patchUser should have access
      const patchResponse = await testWTTPSite.connect(patchUser).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(additionalData), chunkIndex: 1, publisher: patchUser.address }]
      });
      expect(patchResponse).to.not.be.reverted;

      // owner should have access (admin override)
      const ownerPatchResponse = await testWTTPSite.connect(owner).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(additionalData + "-owner"), chunkIndex: 2, publisher: owner.address }]
      });
      expect(ownerPatchResponse).to.not.be.reverted;

      // headUser should NOT have access
      await expect(
        testWTTPSite.connect(headUser).PATCH({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: [{ data: ethers.toUtf8Bytes(additionalData), chunkIndex: 3, publisher: headUser.address }]
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should allow DEFINE access only to defineUser and owner", async function () {
      const testPath = "/permission-test-define";
      
      const customHeader = {
        cors: {
          origins: Array(9).fill(publicRole),
          methods: 511,
          preset: 0,
          custom: "define-permission-test"
        },
        cache: { immutableFlag: false, preset: 0, custom: "" },
        redirect: { code: 0, location: "" }
      };

      // defineUser should have access
      const defineResponse = await testWTTPSite.connect(defineUser).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      expect(defineResponse).to.not.be.reverted;

      // owner should have access (admin override)
      const ownerDefineResponse = await testWTTPSite.connect(owner).DEFINE({
        head: { path: testPath + "-owner", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: customHeader
      });
      expect(ownerDefineResponse).to.not.be.reverted;

      // headUser should NOT have access
      await expect(
        testWTTPSite.connect(headUser).DEFINE({
          head: { path: testPath + "-unauthorized", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: customHeader
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_403");
    });

    it("should verify that owner has access to all methods regardless of role restrictions", async function () {
      const testPath = "/permission-test";
      
      // Owner should be able to use all methods
      const headResponse = await testWTTPSite.connect(owner).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(headResponse.status).to.equal(200);

      const getResponse = await testWTTPSite.connect(owner).GET({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      expect(getResponse.head.status).to.equal(200);

      const optionsResponse = await testWTTPSite.connect(owner).OPTIONS(testPath);
      expect(optionsResponse.status).to.equal(204);

      // Owner can create new resources
      const putResponse = await testWTTPSite.connect(owner).PUT({
        head: { path: "/owner-test", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("Owner test"), chunkIndex: 0, publisher: owner.address }]
      });
      expect(putResponse).to.not.be.reverted;

      // Owner can patch
      const patchResponse = await testWTTPSite.connect(owner).PATCH({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: [{ data: ethers.toUtf8Bytes(createUniqueData("Owner patch - append")), chunkIndex: 1, publisher: owner.address }]
      });
      expect(patchResponse).to.not.be.reverted;
    });

    it("should investigate DEFINE vs default header behavior", async function () {
      const definePath = "/define-investigation";
      
      // First, check what the default header looks like
      // console.log("\n=== INVESTIGATING DEFINE ISSUE ===");
      
      // Create a resource with the current default header (permissionTestHeader)
      await testWTTPSite.connect(owner).PUT({
        head: { path: definePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("Investigation content"), chunkIndex: 0, publisher: owner.address }]
      });

      // Read the resource with current default header
      const defaultHeaderResponse = await testWTTPSite.connect(headUser).HEAD({
        path: definePath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      // console.log("Default header - status:", defaultHeaderResponse.status);
      // console.log("Default header - metadata.header:", defaultHeaderResponse.metadata.header);
      // console.log("Default header - cors.origins[0]:", defaultHeaderResponse.headerInfo.cors.origins[0]);
      // console.log("Default header - cors.custom:", defaultHeaderResponse.headerInfo.cors.custom);

      // Now try DEFINE on a new resource
      const defineTestPath = "/define-test-resource";
      
      // Create custom header for DEFINE
      const defineTestHeader = {
        cors: {
          origins: Array(9).fill(publicRole), // Make everything public for this test
          methods: ALL_METHODS_BITMASK,
          preset: 0,
          custom: "define-test-custom"
        },
        cache: { immutableFlag: false, preset: 0, custom: "define-test-cache" },
        redirect: { code: 0, location: "" }
      };

      // Apply DEFINE
      // console.log("\n--- Applying DEFINE ---");
      
      // Use staticCall to get the response data, then execute the transaction
      const defineResponseData = await testWTTPSite.connect(owner).DEFINE.staticCall({
        head: { path: defineTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: defineTestHeader
      });
      
      const defineTransaction = await testWTTPSite.connect(owner).DEFINE({
        head: { path: defineTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: defineTestHeader
      });
      await defineTransaction.wait();
      
      // console.log("DEFINE response - status:", defineResponseData.head.status);
      // console.log("DEFINE response - headerAddress:", defineResponseData.headerAddress);
      // console.log("DEFINE response - metadata.header:", defineResponseData.head.metadata.header);

      // Create resource using DEFINE path
      await testWTTPSite.connect(owner).PUT({
        head: { path: defineTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7470", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes("DEFINE test content"), chunkIndex: 0, publisher: owner.address }]
      });

      // Debug: Check metadata after PUT to see if header was preserved
      // console.log("\n--- Checking metadata after PUT ---");
      try {
        // Use owner to bypass authorization and just check the metadata
        const debugHeadResponse = await testWTTPSite.connect(owner).HEAD({
          path: defineTestPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        });
        // console.log("Debug - After PUT metadata.header:", debugHeadResponse.metadata.header);
        // console.log("Debug - After PUT cors.custom:", debugHeadResponse.headerInfo.cors.custom);
      } catch (error: any) {
        // console.log("Debug - Even owner can't access, error:", error.message);
      }

      // Read the resource after DEFINE
      const defineHeaderResponse = await testWTTPSite.connect(user1).HEAD({
        path: defineTestPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      // console.log("After DEFINE - status:", defineHeaderResponse.status);
      // console.log("After DEFINE - metadata.header:", defineHeaderResponse.metadata.header);
      // console.log("After DEFINE - cors.origins[0]:", defineHeaderResponse.headerInfo.cors.origins[0]);
      // console.log("After DEFINE - cors.custom:", defineHeaderResponse.headerInfo.cors.custom);
      // console.log("After DEFINE - cache.custom:", defineHeaderResponse.headerInfo.cache.custom);

      // Check if the header address is ZeroHash (indicating DEFINE didn't work)
      if (defineHeaderResponse.metadata.header === ethers.ZeroHash) {
        // console.log("❌ ISSUE FOUND: Header address is ZeroHash - DEFINE didn't create/assign header properly");
      } else {
        // console.log("✅ Header address is set:", defineHeaderResponse.metadata.header);
      }

      // Check if the custom values match what we set in DEFINE
      if (defineHeaderResponse.headerInfo.cors.custom === "define-test-custom") {
        // console.log("✅ DEFINE custom cors value applied correctly");
      } else {
        // console.log("❌ DEFINE custom cors value NOT applied. Expected: 'define-test-custom', Got:", defineHeaderResponse.headerInfo.cors.custom);
      }

      if (defineHeaderResponse.headerInfo.cache.custom === "define-test-cache") {
        // console.log("✅ DEFINE custom cache value applied correctly");
      } else {
        // console.log("❌ DEFINE custom cache value NOT applied. Expected: 'define-test-cache', Got:", defineHeaderResponse.headerInfo.cache.custom);
      }

      // Test access with the new header (should be public)
      const publicGetResponse = await testWTTPSite.connect(user1).GET({
        head: { path: defineTestPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        rangeChunks: { start: 0, end: 0 }
      });
      // console.log("Public GET after DEFINE - status:", publicGetResponse.head.status);

      // Assertions for the test
      expect(defineResponseData.headerAddress).to.not.equal(ethers.ZeroHash, "DEFINE should create a non-zero header address");
      expect(defineHeaderResponse.metadata.header).to.not.equal(ethers.ZeroHash, "Resource should have non-zero header address after DEFINE");
    });

  });

});
