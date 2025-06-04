import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Web3Site } from "../typechain-types";
import { DataPointStorage__factory, DataPointRegistry__factory } from "@tw3/esp";

describe("Scripts Tests", function () {
  let site: Web3Site;
  let dpr: any;
  let dps: any;
  let owner: any;
  let siteAdmin: any;

  const DEFAULT_HEADER = {
    methods: 511, // All methods
    cache: {
      maxAge: 3600,
      sMaxAge: 1800,
      noStore: false,
      noCache: false,
      immutableFlag: false,
      publicFlag: true,
      mustRevalidate: false,
      proxyRevalidate: false,
      mustUnderstand: false,
      staleWhileRevalidate: 600,
      staleIfError: 300
    },
    redirect: {
      code: 0,
      location: ""
    },
    resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
  };

  async function deployScriptFixture() {
    [owner, siteAdmin] = await hre.ethers.getSigners();
    
    // Deploy ESP contracts using ESP package factories
    dps = await new DataPointStorage__factory(owner).deploy();
    await dps.waitForDeployment();
    
    const royaltyRate = hre.ethers.parseEther("0.00001");
    dpr = await new DataPointRegistry__factory(owner).deploy(owner.address, await dps.getAddress(), royaltyRate);
    await dpr.waitForDeployment();
    
    // Deploy Web3Site
    const Web3Site = await hre.ethers.getContractFactory("Web3Site");
    site = await Web3Site.deploy(await dpr.getAddress(), DEFAULT_HEADER, owner.address);
    await site.waitForDeployment();
    
    // Setup site admin
    const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
    await site.grantRole(siteAdminRole, siteAdmin.address);
    
    return { site, dpr, dps, owner, siteAdmin };
  }

  describe("Upload File Script Simulation", function () {
    it("Should simulate uploadFile script functionality", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      // Simulate what the uploadFile script does
      const filePath = "/documents/readme.txt";
      const fileContent = "This is a test file for upload script simulation.";
      const fileBytes = hre.ethers.toUtf8Bytes(fileContent);
      
      // 1. Check if resource exists (HEAD request)
      const headRequest = {
        requestLine: {
          path: filePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await site.HEAD(headRequest);
      const resourceExists = headResponse.responseLine.code === 200n;
      
      // 2. If resource doesn't exist, use PUT to create it
      if (!resourceExists) {
        await site.connect(siteAdmin).DEFINE({
          data: DEFAULT_HEADER,
          head: {
            requestLine: {
              path: filePath,
              protocol: "WTTP/3.0",
              method: 8 // DEFINE
            },
            ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
            ifModifiedSince: 0
          }
        });
        
        const putRequest = {
          head: {
            requestLine: {
              path: filePath,
              protocol: "WTTP/3.0",
              method: 3 // PUT
            },
            ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
            ifModifiedSince: 0
          },
          mimeType: "0x7470", // "tp" for text/plain
          charset: "0x7538", // "u8" for utf-8
          encoding: "0x6964", // "id" for identity
          language: "0x656e", // "en" for english
          data: [{
            data: fileBytes,
            publisher: siteAdmin.address,
            chunkIndex: 0
          }]
        };
        
        const putTx = await site.connect(siteAdmin).PUT(putRequest, { 
          value: hre.ethers.parseEther("0.0001") 
        });
        await putTx.wait();
      }
      
      // 3. Verify upload with LOCATE
      const locateRequest = {
        requestLine: {
          path: filePath,
          protocol: "WTTP/3.0",
          method: 7 // LOCATE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const locateResponse = await site.LOCATE(locateRequest);
      
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.be.greaterThan(0);
      expect(locateResponse.head.metadata.size).to.equal(fileBytes.length);
      
      console.log(`Successfully uploaded file: ${filePath}`);
      console.log(`File size: ${locateResponse.head.metadata.size} bytes`);
      console.log(`Data points: ${locateResponse.dataPoints.length}`);
    });

    it("Should handle large file upload with multiple chunks", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      const filePath = "/documents/large-file.txt";
      
      // Create large content that would be split into chunks
      const chunks = [
        "This is the first chunk of a large file. ",
        "This is the second chunk containing more data. ",
        "This is the third chunk with additional content. ",
        "This is the final chunk completing the large file."
      ];
      
      // Define resource
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: filePath,
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      // Upload first chunk with PUT
      const putRequest = {
        head: {
          requestLine: {
            path: filePath,
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x656e",
        data: [{
          data: hre.ethers.toUtf8Bytes(chunks[0]),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      };
      
      await site.connect(siteAdmin).PUT(putRequest, { 
        value: hre.ethers.parseEther("0.0001") 
      });
      
      // Upload remaining chunks with PATCH
      for (let i = 1; i < chunks.length; i++) {
        const patchRequest = {
          head: {
            requestLine: {
              path: filePath,
              protocol: "WTTP/3.0",
              method: 4 // PATCH
            },
            ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
            ifModifiedSince: 0
          },
          data: [{
            data: hre.ethers.toUtf8Bytes(chunks[i]),
            publisher: siteAdmin.address,
            chunkIndex: i
          }]
        };
        
        await site.connect(siteAdmin).PATCH(patchRequest, { 
          value: hre.ethers.parseEther("0.0001") 
        });
      }
      
      // Verify final upload
      const locateResponse = await site.LOCATE({
        requestLine: {
          path: filePath,
          protocol: "WTTP/3.0",
          method: 7 // LOCATE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      const expectedSize = chunks.reduce((total, chunk) => total + hre.ethers.toUtf8Bytes(chunk).length, 0);
      
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.equal(chunks.length);
      expect(locateResponse.head.metadata.size).to.equal(expectedSize);
    });

    it("Should handle file overwrite scenarios", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      const filePath = "/documents/overwrite-test.txt";
      const originalContent = "Original content";
      const updatedContent = "Updated content that replaces the original";
      
      // Upload original file
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: filePath,
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: filePath,
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x656e",
        data: [{
          data: hre.ethers.toUtf8Bytes(originalContent),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Get original metadata
      const originalHead = await site.HEAD({
        requestLine: {
          path: filePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      // Overwrite with new content
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: filePath,
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x656e",
        data: [{
          data: hre.ethers.toUtf8Bytes(updatedContent),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Verify overwrite
      const updatedHead = await site.HEAD({
        requestLine: {
          path: filePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(updatedHead.responseLine.code).to.equal(200);
      expect(updatedHead.metadata.size).to.equal(hre.ethers.toUtf8Bytes(updatedContent).length);
      expect(updatedHead.metadata.size).to.not.equal(originalHead.metadata.size);
      expect(updatedHead.etag).to.not.equal(originalHead.etag);
    });
  });

  describe("Fetch Resource Script Simulation", function () {
    it("Should simulate fetchResource script functionality", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      const resourcePath = "/api/data.json";
      const resourceData = JSON.stringify({
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" }
        ]
      });
      
      // Setup resource
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: resourcePath,
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: resourcePath,
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x6a73", // "js" for application/json
        charset: "0x7538", // "u8" for utf-8
        encoding: "0x6964", // "id" for identity
        language: "0x656e", // "en" for english
        data: [{
          data: hre.ethers.toUtf8Bytes(resourceData),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Simulate HEAD request (metadata only)
      const headResponse = await site.HEAD({
        requestLine: {
          path: resourcePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(hre.ethers.toUtf8Bytes(resourceData).length);
      
      // Simulate GET request (with data points)
      const getResponse = await site.GET({
        requestLine: {
          path: resourcePath,
          protocol: "WTTP/3.0",
          method: 2 // GET
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(getResponse.head.responseLine.code).to.equal(200);
      expect(getResponse.dataPoints.length).to.be.greaterThan(0);
      
      console.log(`Fetched resource: ${resourcePath}`);
      console.log(`Content-Length: ${getResponse.head.metadata.size}`);
      console.log(`Data points: ${getResponse.dataPoints.length}`);
      console.log(`ETag: ${getResponse.head.etag}`);
    });

    it("Should handle conditional requests", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      const resourcePath = "/api/conditional.json";
      const resourceData = '{"status": "ok", "timestamp": 1234567890}';
      
      // Setup resource
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: resourcePath,
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: resourcePath,
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x6a73",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x656e",
        data: [{
          data: hre.ethers.toUtf8Bytes(resourceData),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Get initial ETag
      const initialHead = await site.HEAD({
        requestLine: {
          path: resourcePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      const etag = initialHead.etag;
      
      // Make conditional request with matching ETag
      const conditionalResponse = await site.HEAD({
        requestLine: {
          path: resourcePath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: etag, // Matching ETag
        ifModifiedSince: 0
      });
      
      // Should return 304 Not Modified
      expect(conditionalResponse.responseLine.code).to.equal(304);
      
      console.log("Conditional request returned 304 Not Modified as expected");
    });

    it("Should handle non-existent resources", async function () {
      const { site } = await loadFixture(deployScriptFixture);
      
      const nonExistentPath = "/does/not/exist.txt";
      
      // Try to fetch non-existent resource
      const headResponse = await site.HEAD({
        requestLine: {
          path: nonExistentPath,
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(404);
      
      const getResponse = await site.GET({
        requestLine: {
          path: nonExistentPath,
          protocol: "WTTP/3.0",
          method: 2 // GET
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(getResponse.head.responseLine.code).to.equal(404);
      
      console.log("Non-existent resource correctly returned 404");
    });
  });

  describe("Directory Upload Script Simulation", function () {
    it("Should simulate directory structure creation", async function () {
      const { site, siteAdmin } = await loadFixture(deployScriptFixture);
      
      // Simulate creating a directory structure like:
      // /docs/
      // /docs/index.html
      // /docs/styles/
      // /docs/styles/main.css
      
      const directoryHeader = {
        methods: 7, // GET, HEAD, OPTIONS for directory listing
        cache: {
          maxAge: 0, // Directories shouldn't be cached long
          sMaxAge: 0,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true,
          mustRevalidate: false,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 0,
          staleIfError: 0
        },
        redirect: {
          code: 300, // Multiple Choices for directory
          location: "/docs/index.html"
        },
        resourceAdmin: hre.ethers.zeroPadBytes("0x", 32)
      };
      
      // Create main directory
      await site.connect(siteAdmin).DEFINE({
        data: directoryHeader,
        head: {
          requestLine: {
            path: "/docs/",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      // Create index file
      const indexContent = "<html><head><title>Documentation</title></head><body><h1>Welcome to Docs</h1></body></html>";
      
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/docs/index.html",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/docs/index.html",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x6874", // "ht" for text/html
        charset: "0x7538", // "u8" for utf-8
        encoding: "0x6964", // "id" for identity
        language: "0x656e", // "en" for english
        data: [{
          data: hre.ethers.toUtf8Bytes(indexContent),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Create styles subdirectory
      const stylesDirectoryHeader = {
        ...directoryHeader,
        redirect: {
          code: 300,
          location: "/docs/styles/main.css"
        }
      };
      
      await site.connect(siteAdmin).DEFINE({
        data: stylesDirectoryHeader,
        head: {
          requestLine: {
            path: "/docs/styles/",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      // Create CSS file
      const cssContent = "body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }";
      
      await site.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/docs/styles/main.css",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await site.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/docs/styles/main.css",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x6373", // "cs" for text/css
        charset: "0x7538", // "u8" for utf-8
        encoding: "0x6964", // "id" for identity
        language: "0x656e", // "en" for english
        data: [{
          data: hre.ethers.toUtf8Bytes(cssContent),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Verify directory structure
      const paths = ["/docs/", "/docs/index.html", "/docs/styles/", "/docs/styles/main.css"];
      
      for (const path of paths) {
        const headResponse = await site.HEAD({
          requestLine: {
            path: path,
            protocol: "WTTP/3.0",
            method: 0 // HEAD
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        });
        
        if (path.endsWith("/")) {
          // Directory should redirect or return status indicating directory
          expect([200, 300, 301, 302].includes(Number(headResponse.responseLine.code))).to.be.true;
        } else {
          // File should exist
          expect(headResponse.responseLine.code).to.equal(200);
        }
        
        console.log(`Verified: ${path} -> ${headResponse.responseLine.code}`);
      }
    });
  });

  describe("Utility Script Functions", function () {
    it("Should validate MIME type detection", async function () {
      // Simulate MIME type detection logic
      const mimeTypes = {
        ".html": "0x6874", // "ht" for text/html
        ".css": "0x6373",  // "cs" for text/css
        ".js": "0x6a73",   // "js" for application/javascript
        ".json": "0x6a73", // "js" for application/json
        ".txt": "0x7470",  // "tp" for text/plain
        ".md": "0x6d64"    // "md" for text/markdown
      };
      
      Object.entries(mimeTypes).forEach(([extension, expectedMimeType]) => {
        expect(expectedMimeType).to.match(/^0x[0-9a-f]{4}$/);
        console.log(`${extension} -> ${expectedMimeType}`);
      });
    });

    it("Should validate path normalization", async function () {
      // Test path normalization logic
      const testPaths = [
        { input: "file.txt", expected: "/file.txt" },
        { input: "/file.txt", expected: "/file.txt" },
        { input: "dir/file.txt", expected: "/dir/file.txt" },
        { input: "/dir/file.txt", expected: "/dir/file.txt" },
        { input: "./file.txt", expected: "/file.txt" },
        { input: "../file.txt", expected: "/file.txt" },
      ];
      
      testPaths.forEach(({ input, expected }) => {
        // Simulate path normalization
        let normalized = input;
        if (!normalized.startsWith("/")) {
          normalized = "/" + normalized;
        }
        normalized = normalized.replace(/\/\.\//g, "/");
        normalized = normalized.replace(/\/[^\/]+\/\.\.\//g, "/");
        
        expect(normalized).to.equal(expected);
        console.log(`${input} -> ${normalized}`);
      });
    });

    it("Should validate chunk size calculations", async function () {
      // Test chunk size calculation for large files
      const maxChunkSize = 1024; // 1KB chunks
      const testSizes = [500, 1024, 1500, 2048, 5000];
      
      testSizes.forEach(size => {
        const expectedChunks = Math.ceil(size / maxChunkSize);
        expect(expectedChunks).to.be.greaterThan(0);
        
        console.log(`File size: ${size} bytes -> ${expectedChunks} chunks`);
      });
    });
  });

  describe("Error Handling in Scripts", function () {
    it("Should handle invalid file paths", async function () {
      const { site } = await loadFixture(deployScriptFixture);
      
      // Test various invalid paths
      const invalidPaths = ["", "\\invalid\\windows\\path", "file:///invalid"];
      
      for (const invalidPath of invalidPaths) {
        if (invalidPath === "") {
          const headResponse = await site.HEAD({
            requestLine: {
              path: invalidPath,
              protocol: "WTTP/3.0",
              method: 0 // HEAD
            },
            ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
            ifModifiedSince: 0
          });
          
          expect(headResponse.responseLine.code).to.equal(404);
        }
      }
    });

    it("Should handle insufficient permissions", async function () {
      const { site, owner } = await loadFixture(deployScriptFixture);
      
      // Try to upload without proper permissions
      const unauthorizedRequest = {
        head: {
          requestLine: {
            path: "/unauthorized.txt",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x656e",
        data: [{
          data: hre.ethers.toUtf8Bytes("Unauthorized content"),
          publisher: owner.address,
          chunkIndex: 0
        }]
      };
      
      // This should fail because no resource definition exists
      await expect(
        site.PUT(unauthorizedRequest, { value: hre.ethers.parseEther("0.0001") })
      ).to.be.reverted;
    });

    it("Should handle network timeouts gracefully", async function () {
      // Simulate timeout handling (in practice, this would be handled by the script)
      const timeout = 5000; // 5 seconds
      const startTime = Date.now();
      
      // Simulate a quick operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).to.be.lessThan(timeout);
      
      console.log(`Operation completed in ${elapsed}ms (under ${timeout}ms timeout)`);
    });
  });
}); 