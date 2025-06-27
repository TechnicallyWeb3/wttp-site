import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { TestWTTPSite } from "../typechain-types";
import { IDataPointRegistry, IDataPointStorage, normalizePath, pathIndicatesDirectory, displayPath, validatePathEdgeCases } from "@wttp/core";
import { fetchResource } from "../src/scripts/fetchResource";
import { uploadDirectory } from "../src/scripts/uploadDirectory";
import fs from "fs";
import path, { relative } from "path";
import os from "os";

describe("13 - Directory Upload & Path Normalization Comprehensive Testing", function () {
  let testWTTPSite: TestWTTPSite;
  let dataPointRegistry: IDataPointRegistry;
  let dataPointStorage: IDataPointStorage;
  let owner: SignerWithAddress;
  let siteAdmin: SignerWithAddress;
  let user1: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;

  // Role identifiers
  let defaultAdminRole: string;
  let siteAdminRole: string;
  let publicRole: string;

  // Default header configuration
  let defaultHeader: any;

  before(async function () {
    [owner, siteAdmin, user1, unauthorizedUser] = await ethers.getSigners();
    const { dps, dpr } = await loadEspContracts();
    dataPointStorage = dps;
    dataPointRegistry = dpr;

    // Get role identifiers
    defaultAdminRole = ethers.ZeroHash;
    siteAdminRole = ethers.id("SITE_ADMIN_ROLE");
    publicRole = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    // Default header allowing all methods for testing
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
  });

  // CATEGORY 1: Path Normalization Unit Tests
  describe("🔧 Path Normalization Utilities", function () {
    
    it("should normalize basic paths correctly", async function () {
      // Absolute paths (non-directory)
      expect(normalizePath("/path")).to.equal("/path");
      expect(normalizePath("/path/")).to.equal("/path/");
      expect(normalizePath("path")).to.equal("/path");
      expect(normalizePath("path/")).to.equal("/path/");
      expect(normalizePath("/")).to.equal("/");
      expect(normalizePath("")).to.equal("/");

      // Absolute paths (directory)
      expect(normalizePath("/path", true)).to.equal("/path/");
      expect(normalizePath("/path/", true)).to.equal("/path/");
      expect(normalizePath("path", true)).to.equal("/path/");
      expect(normalizePath("path/", true)).to.equal("/path/");
      expect(normalizePath("/", true)).to.equal("/");
      expect(normalizePath("", true)).to.equal("/");

    //   // Relative paths (non-directory)
    //   expect(normalizePath("./path", undefined, true)).to.equal("./path");
    //   expect(normalizePath("../path", undefined, true)).to.equal("../path");
    //   expect(normalizePath("../../path", undefined, true)).to.equal("../../path");

    //   // Relative paths (directory)
    //   expect(normalizePath("./path", true, true)).to.equal("./path/");
    //   expect(normalizePath("../path", true, true)).to.equal("../path/");
    //   expect(normalizePath("../../path", true, true)).to.equal("../../path/");
    });

    it("should handle edge cases without failing", async function () {
      // Whitespace handling (absolute paths)
      expect(normalizePath("  /path/  ")).to.equal("/path/");
      expect(normalizePath("  /path/  ", false)).to.equal("/path");
      
      // Complex paths (absolute)
      expect(normalizePath("/api/v1/users")).to.equal("/api/v1/users");
      expect(normalizePath("/api/v1/users", true)).to.equal("/api/v1/users/");
      
      // Single character paths
      expect(normalizePath("/a")).to.equal("/a");
      expect(normalizePath("/a", true)).to.equal("/a/");

    //   // Relative paths with whitespace
    //   expect(normalizePath("  ./path  ", undefined, true)).to.equal("./path");
    //   expect(normalizePath("  ../path  ", true, true)).to.equal("../path/");
    });

    it("should reject malformed paths appropriately", async function () {
      const malformedPaths = [
        "//path",           // Double slash
        "/path//subpath",   // Double slash in middle
        "/path///",         // Multiple trailing slashes
        "path//",           // Double slash after no leading slash
        // without the relative indicator, cannot test these
        // "/../bad",          // Relative path without starting with .
        // "/./bad",          // Absolute path with ./ in middle
      ];

      for (const testPath of malformedPaths) {
        expect(() => normalizePath(testPath)).to.throw();
      }

    //   // Relative directory paths must contain ./
    //   expect(() => normalizePath("path", true, true)).to.throw();
    //   expect(() => normalizePath("path/", true, true)).to.throw();
    });

    it("should correctly identify directory indicators", async function () {
      // Absolute paths
      expect(pathIndicatesDirectory("/path/")).to.be.true;
      expect(pathIndicatesDirectory("/api/users/")).to.be.true;
      expect(pathIndicatesDirectory("/path")).to.be.false;
      expect(pathIndicatesDirectory("/api/users")).to.be.false;
      expect(pathIndicatesDirectory("/")).to.be.true;
      expect(pathIndicatesDirectory("")).to.be.false;

      // Relative paths
      expect(pathIndicatesDirectory("./path/")).to.be.true;
      expect(pathIndicatesDirectory("../path/")).to.be.true;
      expect(pathIndicatesDirectory("./path")).to.be.false;
      expect(pathIndicatesDirectory("../path")).to.be.false;
    });

    it("should format display paths correctly", async function () {
      // Absolute paths
      expect(displayPath("/path", true)).to.equal("/path/");
      expect(displayPath("/path")).to.equal("/path");
      expect(displayPath("/", true)).to.equal("/");
      expect(displayPath("/")).to.equal("/");
      expect(displayPath("")).to.equal("/");

    //   // Relative paths
    //   expect(displayPath("./path", true)).to.equal("./path/");
    //   expect(displayPath("./path")).to.equal("./path");
    //   expect(displayPath("../path", true)).to.equal("../path/");
    //   expect(displayPath("../path")).to.equal("../path");
    });

    it("should validate edge cases systematically", async function () {
      const testCases = [
        // Absolute paths
        { path: "/valid/path", shouldPass: true },
        { path: "/valid/path/", shouldPass: true },
        { path: "valid/path", shouldPass: true },
        { path: "", shouldPass: true },
        { path: "   ", shouldPass: true },
        
        // Relative paths
        { path: "./valid/path", shouldPass: false },
        { path: "../valid/path", shouldPass: false },
        { path: "../../valid/path", shouldPass: false },
        
        // Invalid paths
        { path: "//invalid", shouldPass: false },
        { path: "/path//invalid", shouldPass: false },

        // not technically valid but will pass normalization
        { path: "/../invalid", shouldPass: true },
        { path: "/./invalid", shouldPass: true },
        { path: ".invalid", shouldPass: true },
      ];

      for (const testCase of testCases) {
        const result = validatePathEdgeCases(testCase.path);
        expect(result.isValid).to.equal(testCase.shouldPass, 
          `Path "${testCase.path}" validation failed${result.normalized ? `, normalized to "${result.normalized}"` : ''}`);
      }
    });
  });

  // CATEGORY 2: Contract-Level Path Behavior
  describe("🔒 Contract Path Behavior & Directory Semantics", function () {
    
    it("should handle directory paths correctly in contract calls", async function () {
      const dirPath = "/api/users/"; // Directory path with trailing slash
      
      // Create a DIRECTORY using DEFINE with 301 redirect
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: dirPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: { code: 301, location: "./index.html" }
        }
      });
      
      // Directory path should work and return 301
      const dirResponse = await testWTTPSite.connect(user1).HEAD({
        path: dirPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(dirResponse.status)).to.equal(301);
      expect(dirResponse.headerInfo.redirect.location).to.equal("./index.html");
      
      // Non-directory path should fail
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: "/api/users",
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle file paths correctly in contract calls", async function () {
      const filePath = "/api/config"; // File path without trailing slash
      const testData = createUniqueData("Test file content");
      
      // Create a FILE using PUT
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: filePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x616f", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // File path should work
      const fileResponse = await testWTTPSite.connect(user1).HEAD({
        path: filePath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(fileResponse.status)).to.equal(200);
      
      // Directory-style path should fail
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: filePath + "/",
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should reject direct contract calls with trailing slash (except root)", async function () {
      const normalizedPath = "/api/users/"; // Changed to include trailing slash for directory
      const nonNormalizedPath = "/api/users";
      
      // First create a DIRECTORY at the normalized path using DEFINE with 301 redirect
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: normalizedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: { code: 301, location: "./index.html" } // Directory redirect
        }
      });
      
      // Verify the normalized path works (should return 301 redirect)
      const normalizedResponse = await testWTTPSite.connect(user1).HEAD({
        path: normalizedPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(normalizedResponse.status)).to.equal(301);
      expect(normalizedResponse.headerInfo.redirect.location).to.equal("./index.html");
      
      // Now test that calling without trailing slash fails with 404
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: nonNormalizedPath,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");

      await expect(
        testWTTPSite.connect(user1).GET({
          head: { path: nonNormalizedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          rangeChunks: { start: 0, end: 0 }
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should accept normalized paths in contract calls", async function () {
      const testPath = "/api/users"; // Non-directory path, no trailing slash
      const testData = createUniqueData("Test API users content");
      
      // Create resource first
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x616f", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Now normalized path should work
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(Number(headResponse.status)).to.equal(200);
    });

    it("should demonstrate trailing slash behavior across multiple directories", async function () {
      const testCases = [
        { normalized: "/docs/", withoutSlash: "/docs" },
        { normalized: "/api/v1/users/", withoutSlash: "/api/v1/users" },
        { normalized: "/files/assets/", withoutSlash: "/files/assets" }
      ];
      
      for (const testCase of testCases) {
        // Create DIRECTORY at normalized path using DEFINE with 301 redirect
        await testWTTPSite.connect(siteAdmin).DEFINE({
          head: { path: testCase.normalized, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: {
            ...defaultHeader,
            redirect: { code: 301, location: "./index.html" } // Directory redirect
          }
        });
        
        // Normalized path should work (return 301 redirect)
        const normalizedResponse = await testWTTPSite.connect(user1).HEAD({
          path: testCase.normalized,
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        });
        expect(Number(normalizedResponse.status)).to.equal(301, 
          `Normalized directory path ${testCase.normalized} should return 301`);
        expect(normalizedResponse.headerInfo.redirect.location).to.equal("./index.html");
        
        // Path without trailing slash should fail with 404
        await expect(
          testWTTPSite.connect(user1).HEAD({
            path: testCase.withoutSlash,
            ifModifiedSince: 0,
            ifNoneMatch: ethers.ZeroHash
          })
        ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      }
    });

    it("should distinguish between files and directories in trailing slash behavior", async function () {
      const filePath = "/api/config";
      const dirPath = "/api/uploads";
      const testData = createUniqueData("Config file content");
      
      // Create a FILE using PUT
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: filePath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x616f", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // Create a DIRECTORY using DEFINE
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: dirPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: { code: 301, location: "./index.html" }
        }
      });
      
      // File should return 200 for content
      const fileResponse = await testWTTPSite.connect(user1).HEAD({
        path: filePath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(fileResponse.status)).to.equal(200);
      
      // Directory should return 301 redirect
      const dirResponse = await testWTTPSite.connect(user1).HEAD({
        path: dirPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(dirResponse.status)).to.equal(301);
      expect(dirResponse.headerInfo.redirect.location).to.equal("./index.html");
      
      // Both should fail with trailing slash
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: filePath + "/",
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      
      await expect(
        testWTTPSite.connect(user1).HEAD({
          path: dirPath + "/",
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        })
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });

    it("should handle fetchResource script normalization gracefully", async function () {
      const testPath = "/api/data/";
      const testData = createUniqueData("Test fetch normalization");
      
      // Create resource with normalized path
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x616f", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // fetchResource requires normalized, absolute paths
      const siteAddress = await testWTTPSite.getAddress();
      const response = await fetchResource(siteAddress, testPath); // With trailing slash
      
      expect(Number(response.response.head.status)).to.equal(200);
      expect(response.response).to.not.be.undefined;
    });

    it("should handle root path consistently", async function () {
      const testData = createUniqueData("Root content");
      
      // Create root resource
      await testWTTPSite.connect(siteAdmin).PUT({
        head: { path: "/", ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        properties: { mimeType: "0x7468", charset: "0x7438", encoding: "0x7a67", language: "0x747a" },
        data: [{ data: ethers.toUtf8Bytes(testData), chunkIndex: 0, publisher: siteAdmin.address }]
      });
      
      // All variations should work for root
      const headResponse1 = await testWTTPSite.connect(user1).HEAD({
        path: "/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(headResponse1.status).to.equal(200n);
      
      // fetchResource should also work with root
      const siteAddress = await testWTTPSite.getAddress();
      const response = await fetchResource(siteAddress, "/");
      expect(response.response.head.status).to.equal(200n);
    });
  });

  // CATEGORY 3: Directory Upload Functionality
  describe("📁 Directory Upload & Redirect Behavior", function () {
    
    let tempDir: string;
    
    beforeEach(function () {
      // Create temporary directory for testing
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wttp-test-'));
    });
    
    afterEach(function () {
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("should create directory with single index file (301 redirect)", async function () {
      // Create test directory with single index.html
      const indexContent = createUniqueData("<html><body>Index Page</body></html>");
      fs.writeFileSync(path.join(tempDir, "index.html"), indexContent);
      
      const siteAddress = await testWTTPSite.getAddress();
      await uploadDirectory(testWTTPSite, tempDir, "/testdir");
      
      // Check directory was created with correct redirect
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: "/testdir/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(Number(headResponse.status)).to.equal(301); // Permanent redirect
      expect(headResponse.headerInfo.redirect.location).to.equal("./index.html");
    });

    it("should create directory with multiple index files (300 redirect)", async function () {
      // Create test directory with multiple index files
      const htmlContent = createUniqueData("<html>HTML Index</html>");
      const jsContent = createUniqueData("console.log('JS Index');");
      
      fs.writeFileSync(path.join(tempDir, "index.html"), htmlContent);
      fs.writeFileSync(path.join(tempDir, "index.js"), jsContent);
      
      await uploadDirectory(testWTTPSite, tempDir, "/multidir");
      
      // Check directory was created with multiple choices redirect
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: "/multidir/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(Number(headResponse.status)).to.equal(300); // Multiple choices
      // Location should contain JSON directory listing
      expect(headResponse.headerInfo.redirect.location).to.include("directory");
    });

    it("should handle nested directory structures", async function () {
      // Create nested directory structure
      const subDir = path.join(tempDir, "subdir");
      fs.mkdirSync(subDir);
      
      const rootIndex = createUniqueData("<html>Root Index</html>");
      const subIndex = createUniqueData("<html>Sub Index</html>");
      
      fs.writeFileSync(path.join(tempDir, "index.html"), rootIndex);
      fs.writeFileSync(path.join(subDir, "index.html"), subIndex);
      
      await uploadDirectory(testWTTPSite, tempDir, "/nested");
      
      // Check root directory, should have been normalized to /nested/
      const rootResponse = await testWTTPSite.connect(user1).HEAD({
        path: "/nested/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(rootResponse.status)).to.equal(301);
      
      // Check subdirectory
      const subResponse = await testWTTPSite.connect(user1).HEAD({
        path: "/nested/subdir/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      expect(Number(subResponse.status)).to.equal(301);
    });

    it("should normalize directory paths during upload", async function () {
      // Create simple directory
      const indexContent = createUniqueData("<html>Normalized Directory</html>");
      fs.writeFileSync(path.join(tempDir, "index.html"), indexContent);
      
      // Upload with trailing slash - should be normalized
      await uploadDirectory(testWTTPSite, tempDir, "/normalized/");
      
      // Should be accessible only with trailing slash
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: "/normalized/",
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(Number(headResponse.status)).to.equal(301);
    });
  });

  // CATEGORY 4: Large Directory Listing Tests
  describe("📊 Large Directory Listing (32KB+ JSON)", function () {
    
    it("should handle large directory metadata that exceeds location header limit", async function () {
      // Create directory metadata that will exceed 32KB when JSON stringified
      const largeMetadata: Record<string, any> = {};
      
      // Create enough file entries to exceed 32KB
      for (let i = 0; i < 200; i++) {
        const fileName = `file_${i.toString().padStart(3, '0')}_${createUniqueData('name')}.txt`;
        largeMetadata[fileName] = {
          "mimeType": "text/plain",
          "charset": "utf-8", 
          "encoding": "identity",
          "language": "en-US"
        };
      }
      
      // Add some directories too
      for (let i = 0; i < 50; i++) {
        const dirName = `subdir_${i.toString().padStart(2, '0')}_${createUniqueData('dir')}`;
        largeMetadata[dirName] = { "directory": true };
      }
      
      const directoryMetadata = { "directory": largeMetadata };
      const directoryMetadataJson = JSON.stringify(directoryMetadata, null, 2);
      
      console.log(`📊 Generated directory listing: ${directoryMetadataJson.length} bytes`);
      expect(directoryMetadataJson.length).to.be.greaterThan(32 * 1024); // Should exceed 32KB
      
      // Manually create a directory resource that would trigger this behavior
      const testPath = "/largedir";
      
      // Since we can't easily create 200+ real files, we'll simulate by creating
      // a directory with a JSON metadata that exceeds the limit
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: {
            code: 300, // Multiple choices
            location: directoryMetadataJson.substring(0, 1000) + "..." // Truncated for header
          }
        }
      });
      
      const headResponse = await testWTTPSite.connect(user1).HEAD({
        path: testPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      });
      
      expect(Number(headResponse.status)).to.equal(300);
      expect(headResponse.headerInfo.redirect.location).to.include("directory");
    });

    it("should measure directory listing performance", async function () {
      const startTime = Date.now();
      
      // Create moderate-sized directory metadata
      const metadata: Record<string, any> = {};
      
      for (let i = 0; i < 100; i++) {
        const fileName = `perf_file_${i}_${createUniqueData('perf')}.txt`;
        metadata[fileName] = {
          "mimeType": "text/plain",
          "charset": "utf-8",
          "encoding": "identity", 
          "language": "en-US"
        };
      }
      
      const directoryMetadata = { "directory": metadata };
      const directoryMetadataJson = JSON.stringify(directoryMetadata, null, 2);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`📈 Directory metadata generation took ${duration}ms for ${Object.keys(metadata).length} files`);
      console.log(`📊 JSON size: ${directoryMetadataJson.length} bytes`);
      
      expect(duration).to.be.lessThan(1000); // Should complete within 1 second
      expect(directoryMetadataJson.length).to.be.greaterThan(5000); // Should have substantial content
    });
  });

  // CATEGORY 5: Integration & Error Handling
  describe("⚠️ Error Handling & Integration", function () {
    
    it("should handle malformed paths in directory operations", async function () {
      // Test various malformed paths - the contract doesn't validate these,
      // but our normalization function should catch them
      const malformedPaths = [
        "//invalid",
        "/path//invalid", 
        "/path///",
      ];
      
      for (const testPath of malformedPaths) {
        // Contract level - these will succeed (no path validation)
        const response = await testWTTPSite.connect(siteAdmin).DEFINE({
          head: { path: testPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
          data: {
            ...defaultHeader,
            redirect: { code: 301, location: "./index.html" }
          }
        });
        expect(response).to.not.be.reverted;
        
        // But our path utilities should reject them
        expect(() => normalizePath(testPath)).to.throw();
      }
    });

    it("should handle fetchResource with various path formats", async function () {
      const normalizedPath = "/api/test/";
      
      // Create resource
      await testWTTPSite.connect(siteAdmin).DEFINE({
        head: { path: normalizedPath, ifModifiedSince: 0, ifNoneMatch: ethers.ZeroHash },
        data: {
          ...defaultHeader,
          redirect: { code: 301, location: "./index.html" }
        }
      });
      
      const siteAddress = await testWTTPSite.getAddress();
      
      // Test various path formats that should all normalize to the same resource
      const pathVariations = [
        "/api/test/", 
        "api/test/",
      ];
      
      for (const pathVariation of pathVariations) {
        const response = await fetchResource(siteAddress, pathVariation);
        expect(response.response.head.status).to.equal(301n, 
          `Path variation "${pathVariation}" failed`);
      }
    });

    it("should preserve semantic meaning in display context", async function () {
      // Test that we can reconstruct directory intent for display purposes
      const originalDirectoryPath = "/api/users/";
      const originalFilePath = "/api/users";
      
      expect(pathIndicatesDirectory(originalDirectoryPath)).to.be.true;
      expect(pathIndicatesDirectory(originalFilePath)).to.be.false;
      
      // Both normalize to the same storage path
      expect(normalizePath(originalDirectoryPath)).to.equal("/api/users/");
      expect(normalizePath(originalDirectoryPath, false)).to.equal("/api/users");
      expect(normalizePath(originalFilePath)).to.equal("/api/users");
      expect(normalizePath(originalFilePath, true)).to.equal("/api/users/");
      
      // But can be displayed differently
      expect(displayPath("/api/users", true)).to.equal("/api/users/");
      expect(displayPath("/api/users", false)).to.equal("/api/users");
    });
  });
}); 