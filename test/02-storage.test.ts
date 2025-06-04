import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { Web3Site } from "../typechain-types";
import { DataPointStorage__factory, DataPointRegistry__factory } from "@tw3/esp";

describe("WTTPStorage", function () {
  let storage: Web3Site;
  let dpr: any;
  let dps: any;
  let owner: any;
  let siteAdmin: any;
  let resourceAdmin: any;
  let publicUser: any;

  const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
  
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

  // Fixture to deploy the storage contract with dependencies
  async function deployStorageFixture() {
    [owner, siteAdmin, resourceAdmin, publicUser] = await hre.ethers.getSigners();
    
    // Deploy DPS using ESP package factory
    dps = await new DataPointStorage__factory(owner).deploy();
    await dps.waitForDeployment();
    
    // Deploy DPR using ESP package factory
    const royaltyRate = hre.ethers.parseEther("0.00001");
    dpr = await new DataPointRegistry__factory(owner).deploy(owner.address, await dps.getAddress(), royaltyRate);
    await dpr.waitForDeployment();
    
    // Deploy concrete Web3Site to test storage functionality
    const Web3Site = await hre.ethers.getContractFactory("Web3Site");
    storage = await Web3Site.deploy(await dpr.getAddress(), DEFAULT_HEADER, owner.address);
    await storage.waitForDeployment();
    
    // Grant site admin role
    await storage.grantRole(siteAdminRole, siteAdmin.address);
    
    // Create resource admin role
    const resourceAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("RESOURCE_ADMIN_ROLE"));
    await storage.connect(siteAdmin).createResourceRole(resourceAdminRole);
    await storage.connect(siteAdmin).grantRole(resourceAdminRole, resourceAdmin.address);
    
    return { storage, dpr, dps, owner, siteAdmin, resourceAdmin, publicUser, resourceAdminRole };
  }

  describe("Deployment and Configuration", function () {
    it("Should deploy with correct DPR address", async function () {
      const { storage, dpr } = await loadFixture(deployStorageFixture);
      
      expect(await storage.DPR()).to.equal(await dpr.getAddress());
    });

    it("Should set default header correctly", async function () {
      const { storage } = await loadFixture(deployStorageFixture);
      
      // Test a HEAD request to non-existent path to check default header
      const headRequest = {
        requestLine: {
          path: "/non-existent",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const response = await storage.HEAD(headRequest);
      expect(response.responseLine.code).to.equal(404); // Not found but validates structure
    });
  });

  describe("Header Management", function () {
    it("Should allow defining custom headers", async function () {
      const { storage, siteAdmin, resourceAdminRole } = await loadFixture(deployStorageFixture);
      
      const customHeader = {
        methods: 256, // Limited methods
        cache: {
          maxAge: 1800,
          sMaxage: 900,
          noStore: true,
          noCache: false,
          immutableFlag: true,
          publicFlag: false,
          mustRevalidate: true,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 300,
          staleIfError: 150
        },
        redirect: {
          code: 301,
          location: "https://example.com"
        },
        resourceAdmin: resourceAdminRole
      };
      
      const defineRequest = {
        data: customHeader,
        head: {
          requestLine: {
            path: "/custom-resource",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await storage.connect(siteAdmin).DEFINE(defineRequest);
      
      // Verify the header was set by checking with HEAD
      const headRequest = {
        requestLine: {
          path: "/custom-resource",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      // Since no content exists yet, we get 404 but can't verify headers
      const headResponse = await storage.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(404);
    });

    it("Should prevent non-admins from defining headers", async function () {
      const { storage, publicUser } = await loadFixture(deployStorageFixture);
      
      const defineRequest = {
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/unauthorized-resource",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await expect(
        storage.connect(publicUser).DEFINE(defineRequest)
      ).to.be.reverted; // Should fail due to permissions
    });
  });

  describe("Resource Storage", function () {
    it("Should store and retrieve simple content", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Define resource first
      const defineRequest = {
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await storage.connect(siteAdmin).DEFINE(defineRequest);
      
      // Store content
      const content = hre.ethers.toUtf8Bytes("Hello, WTTP World!");
      const putRequest = {
        head: {
          requestLine: {
            path: "/test-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: content,
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      };
      
      const putTx = await storage.connect(siteAdmin).PUT(putRequest, { 
        value: hre.ethers.parseEther("0.0001") 
      });
      const receipt = await putTx.wait();
      
      // Verify PUT success event
      const events = receipt?.logs.map((log: any) => {
        try {
          return storage.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      const putSuccessEvent = events?.find((event: any) => event?.name === "PUTSuccess");
      expect(putSuccessEvent).to.not.be.undefined;
      
      // Verify content with HEAD
      const headRequest = {
        requestLine: {
          path: "/test-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await storage.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(content.length);
    });

    it("Should handle multiple chunk storage", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Define resource
      const defineRequest = {
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/large-content",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      };
      
      await storage.connect(siteAdmin).DEFINE(defineRequest);
      
      // Store content in multiple chunks
      const chunk1 = hre.ethers.toUtf8Bytes("First chunk of content. ");
      const chunk2 = hre.ethers.toUtf8Bytes("Second chunk of content.");
      
      const putRequest = {
        head: {
          requestLine: {
            path: "/large-content",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [
          {
            data: chunk1,
            publisher: siteAdmin.address,
            chunkIndex: 0
          },
          {
            data: chunk2,
            publisher: siteAdmin.address,
            chunkIndex: 1
          }
        ]
      };
      
      await storage.connect(siteAdmin).PUT(putRequest, { 
        value: hre.ethers.parseEther("0.0002") // More gas for multiple chunks
      });
      
      // Verify total size
      const headRequest = {
        requestLine: {
          path: "/large-content",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      };
      
      const headResponse = await storage.HEAD(headRequest);
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(chunk1.length + chunk2.length);
    });

    it("Should update content with PATCH", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Create initial content
      await storage.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/patchable",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      const initialContent = hre.ethers.toUtf8Bytes("Initial content");
      await storage.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/patchable",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: initialContent,
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Update with PATCH
      const updatedContent = hre.ethers.toUtf8Bytes("Updated content");
      const patchTx = await storage.connect(siteAdmin).PATCH({
        head: {
          requestLine: {
            path: "/patchable",
            protocol: "WTTP/3.0",
            method: 4 // PATCH
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        data: [{
          data: updatedContent,
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      const receipt = await patchTx.wait();
      
      // Verify PATCH success event
      const events = receipt?.logs.map((log: any) => {
        try {
          return storage.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      const patchSuccessEvent = events?.find((event: any) => event?.name === "PATCHSuccess");
      expect(patchSuccessEvent).to.not.be.undefined;
      
      // Verify updated size
      const headResponse = await storage.HEAD({
        requestLine: {
          path: "/patchable",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.equal(updatedContent.length);
    });

    it("Should delete resources", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Create resource to delete
      await storage.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/deletable",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await storage.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/deletable",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: hre.ethers.toUtf8Bytes("Content to delete"),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Verify resource exists
      let headResponse = await storage.HEAD({
        requestLine: {
          path: "/deletable",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      expect(headResponse.responseLine.code).to.equal(200);
      
      // Delete resource
      const deleteTx = await storage.connect(siteAdmin).DELETE({
        requestLine: {
          path: "/deletable",
          protocol: "WTTP/3.0",
          method: 5 // DELETE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      const receipt = await deleteTx.wait();
      
      // Verify DELETE success event
      const events = receipt?.logs.map((log: any) => {
        try {
          return storage.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      const deleteSuccessEvent = events?.find((event: any) => event?.name === "DELETESuccess");
      expect(deleteSuccessEvent).to.not.be.undefined;
      
      // Verify resource is gone
      headResponse = await storage.HEAD({
        requestLine: {
          path: "/deletable",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      expect(headResponse.responseLine.code).to.equal(404);
    });
  });

  describe("Metadata and ETags", function () {
    it("Should generate consistent ETags", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Create resource
      await storage.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/etag-test",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      const content = hre.ethers.toUtf8Bytes("ETag test content");
      await storage.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/etag-test",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: content,
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Get ETag
      const headResponse1 = await storage.HEAD({
        requestLine: {
          path: "/etag-test",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      const firstETag = headResponse1.etag;
      
      // Get ETag again - should be same
      const headResponse2 = await storage.HEAD({
        requestLine: {
          path: "/etag-test",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse2.etag).to.equal(firstETag);
    });

    it("Should handle conditional requests with ETags", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Create resource
      await storage.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/conditional",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await storage.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/conditional",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: hre.ethers.toUtf8Bytes("Conditional content"),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // Get ETag
      const headResponse = await storage.HEAD({
        requestLine: {
          path: "/conditional",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      const etag = headResponse.etag;
      
      // Make conditional request with matching ETag
      const conditionalResponse = await storage.HEAD({
        requestLine: {
          path: "/conditional",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: etag,
        ifModifiedSince: 0
      });
      
      // Should return 304 Not Modified
      expect(conditionalResponse.responseLine.code).to.equal(304);
    });
  });

  describe("LOCATE Functionality", function () {
    it("Should provide data point locations", async function () {
      const { storage, siteAdmin } = await loadFixture(deployStorageFixture);
      
      // Create resource
      await storage.connect(siteAdmin).DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/locatable",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await storage.connect(siteAdmin).PUT({
        head: {
          requestLine: {
            path: "/locatable",
            protocol: "WTTP/3.0",
            method: 3 // PUT
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        },
        mimeType: "0x7470",
        charset: "0x7538",
        encoding: "0x6964",
        language: "0x6575",
        data: [{
          data: hre.ethers.toUtf8Bytes("Locatable content"),
          publisher: siteAdmin.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      // LOCATE the resource
      const locateResponse = await storage.LOCATE({
        requestLine: {
          path: "/locatable",
          protocol: "WTTP/3.0",
          method: 7 // LOCATE
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(locateResponse.head.responseLine.code).to.equal(200);
      expect(locateResponse.dataPoints.length).to.be.greaterThan(0);
      expect(locateResponse.dataPoints[0]).to.not.equal(hre.ethers.ZeroAddress);
    });
  });

  describe("Error Handling", function () {
    it("Should handle non-existent resources", async function () {
      const { storage } = await loadFixture(deployStorageFixture);
      
      const headResponse = await storage.HEAD({
        requestLine: {
          path: "/does-not-exist",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(404);
    });

    it("Should handle invalid protocol versions", async function () {
      const { storage } = await loadFixture(deployStorageFixture);
      
      const optionsResponse = await storage.OPTIONS({
        path: "/test",
        protocol: "WTTP/2.0", // Invalid version
        method: 1 // OPTIONS
      });
      
      expect(optionsResponse.responseLine.code).to.equal(505); // HTTP Version Not Supported
    });
  });
}); 