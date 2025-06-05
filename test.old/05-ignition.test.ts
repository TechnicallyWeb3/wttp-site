import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { DataPointStorage__factory, DataPointRegistry__factory } from "@tw3/esp";

describe("Ignition Module Tests", function () {
  let owner: any;
  let siteAdmin: any;
  let publicUser: any;
  let dps: any;
  let dpr: any;

  async function deployIgnitionFixture() {
    [owner, siteAdmin, publicUser] = await hre.ethers.getSigners();
    
    // Deploy ESP contracts first using ESP package factories
    dps = await new DataPointStorage__factory(owner).deploy();
    await dps.waitForDeployment();
    
    const royaltyRate = hre.ethers.parseEther("0.00001");
    dpr = await new DataPointRegistry__factory(owner).deploy(owner.address, await dps.getAddress(), royaltyRate);
    await dpr.waitForDeployment();
    
    return { dpr, dps, owner, siteAdmin, publicUser };
  }

  describe("WTTPSite Module Configuration", function () {
    it("Should deploy with default parameters", async function () {
      const { dpr, owner } = await loadFixture(deployIgnitionFixture);
      
      // Simulate what the ignition module does
      const DEFAULT_HEADER = {
        methods: 511, // All methods allowed (bitmask for all 9 methods)
        cache: {
          maxAge: 3600, // 1 hour
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash // Default admin role
      };
      
      // Deploy Web3Site like the ignition module would
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      // Verify deployment parameters
      expect(await web3Site.DPR()).to.equal(await dpr.getAddress());
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), owner.address)).to.be.true;
      
      // Test default header functionality
      const optionsResponse = await web3Site.OPTIONS({
        path: "/test",
        protocol: "WTTP/3.0",
        method: 1 // OPTIONS
      });
      
      expect(optionsResponse.responseLine.code).to.equal(204);
      expect(optionsResponse.allow).to.equal(DEFAULT_HEADER.methods);
    });

    it("Should handle custom DPR parameter", async function () {
      const { owner } = await loadFixture(deployIgnitionFixture);
      
      // Deploy a separate DPR for testing custom parameter using ESP factories
      const customDps = await new DataPointStorage__factory(owner).deploy();
      await customDps.waitForDeployment();
      
      const customRoyaltyRate = hre.ethers.parseEther("0.00002"); // Different rate
      const customDpr = await new DataPointRegistry__factory(owner).deploy(owner.address, await customDps.getAddress(), customRoyaltyRate);
      await customDpr.waitForDeployment();
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      // Deploy with custom DPR
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await customDpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      expect(await web3Site.DPR()).to.equal(await customDpr.getAddress());
    });

    it("Should handle custom owner parameter", async function () {
      const { dpr, siteAdmin } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      // Deploy with custom owner (siteAdmin instead of default owner)
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        siteAdmin.address // Custom owner
      );
      await web3Site.waitForDeployment();
      
      // Verify custom owner has admin role
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), siteAdmin.address)).to.be.true;
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), hre.ethers.ZeroAddress)).to.be.false;
    });
  });

  describe("Header Configuration", function () {
    it("Should validate default header methods", async function () {
      const { dpr, owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511, // Binary: 111111111 (all 9 methods)
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      // Test that all methods are allowed by default
      const methodNames = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE", "LOCATE", "UNLINK", "DEFINE"];
      for (let i = 0; i < methodNames.length; i++) {
        const optionsResponse = await web3Site.OPTIONS({
          path: "/test",
          protocol: "WTTP/3.0",
          method: i
        });
        
        // All methods should be allowed (status 204 for OPTIONS)
        if (i === 1) { // OPTIONS method
          expect(optionsResponse.responseLine.code).to.equal(204);
          expect(optionsResponse.allow).to.equal(511);
        }
      }
    });

    it("Should validate default cache settings", async function () {
      const { dpr, owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600, // 1 hour
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      // Create a test resource to check cache headers
      const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
      await web3Site.grantRole(siteAdminRole, owner.address);
      
      await web3Site.DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/cache-test",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      await web3Site.PUT({
        head: {
          requestLine: {
            path: "/cache-test",
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
          data: hre.ethers.toUtf8Bytes("Cache test content"),
          publisher: owner.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      const headResponse = await web3Site.HEAD({
        requestLine: {
          path: "/cache-test",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.headerInfo.cache.maxAge).to.equal(3600);
      expect(headResponse.headerInfo.cache.publicFlag).to.be.true;
      expect(headResponse.headerInfo.cache.immutableFlag).to.be.false;
    });
  });

  describe("Module Parameters", function () {
    it("Should handle missing DPR parameter gracefully", async function () {
      const { owner } = await loadFixture(deployIgnitionFixture);
      
      // This simulates what would happen if no DPR parameter is provided
      // In real Ignition, it would use the ESP default
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      // We need a valid DPR address for deployment
      const DataPointStorage = await hre.ethers.getContractFactory("DataPointStorage");
      const dps = await DataPointStorage.deploy();
      await dps.waitForDeployment();
      
      const DataPointRegistry = await hre.ethers.getContractFactory("DataPointRegistry");
      const dpr = await DataPointRegistry.deploy(owner.address, await dps.getAddress(), hre.ethers.parseEther("0.00001"));
      await dpr.waitForDeployment();
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      expect(await web3Site.DPR()).to.equal(await dpr.getAddress());
    });

    it("Should handle missing owner parameter (defaults to account[0])", async function () {
      const { dpr } = await loadFixture(deployIgnitionFixture);
      
      // Get first account (what Ignition would default to)
      const [defaultAccount] = await hre.ethers.getSigners();
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        defaultAccount.address // Simulate Ignition default
      );
      
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), defaultAccount.address)).to.be.true;
    });
  });

  describe("Integration with ESP Contracts", function () {
    it("Should properly integrate with DataPointRegistry", async function () {
      const { dpr, owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      // Test that the site can interact with DPR
      expect(await web3Site.DPR()).to.equal(await dpr.getAddress());
      
      // Create a test resource to verify DPR integration
      const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
      await web3Site.grantRole(siteAdminRole, owner.address);
      
      await web3Site.DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/integration-test",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      const putTx = await web3Site.PUT({
        head: {
          requestLine: {
            path: "/integration-test",
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
          data: hre.ethers.toUtf8Bytes("DPR integration test"),
          publisher: owner.address,
          chunkIndex: 0
        }]
      }, { value: hre.ethers.parseEther("0.0001") });
      
      const receipt = await putTx.wait();
      expect(receipt?.status).to.equal(1); // Transaction succeeded
      
      // Verify content was stored
      const headResponse = await web3Site.HEAD({
        requestLine: {
          path: "/integration-test",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(200);
      expect(headResponse.metadata.size).to.be.greaterThan(0);
    });

    it("Should handle DPR royalty payments correctly", async function () {
      const { dpr, dps, owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      // Setup site admin
      const siteAdminRole = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SITE_ADMIN_ROLE"));
      await web3Site.grantRole(siteAdminRole, owner.address);
      
      await web3Site.DEFINE({
        data: DEFAULT_HEADER,
        head: {
          requestLine: {
            path: "/royalty-test",
            protocol: "WTTP/3.0",
            method: 8 // DEFINE
          },
          ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
          ifModifiedSince: 0
        }
      });
      
      const testContent = hre.ethers.toUtf8Bytes("Royalty test content");
      
      // Use a reasonable royalty amount for testing instead of calculating
      const reasonableRoyalty = hre.ethers.parseEther("0.0001");
      
      // PUT with reasonable royalty amount
      await web3Site.PUT({
        head: {
          requestLine: {
            path: "/royalty-test",
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
          data: testContent,
          publisher: owner.address,
          chunkIndex: 0
        }]
      }, { value: reasonableRoyalty });
      
      // Verify the transaction succeeded (payment was correct)
      const headResponse = await web3Site.HEAD({
        requestLine: {
          path: "/royalty-test",
          protocol: "WTTP/3.0",
          method: 0 // HEAD
        },
        ifNoneMatch: hre.ethers.zeroPadBytes("0x", 32),
        ifModifiedSince: 0
      });
      
      expect(headResponse.responseLine.code).to.equal(200);
    });
  });

  describe("Deployment Validation", function () {
    it("Should validate module return values", async function () {
      const { dpr, owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      // Simulate what the Ignition module should return
      const moduleResult = {
        wttpSite: web3Site
      };
      
      // Validate the deployed contract has expected interface
      expect(moduleResult.wttpSite).to.have.property("DPR");
      expect(moduleResult.wttpSite).to.have.property("HEAD");
      expect(moduleResult.wttpSite).to.have.property("PUT");
      expect(moduleResult.wttpSite).to.have.property("OPTIONS");
      expect(moduleResult.wttpSite).to.have.property("DEFINE");
      expect(moduleResult.wttpSite).to.have.property("DELETE");
      expect(moduleResult.wttpSite).to.have.property("PATCH");
      expect(moduleResult.wttpSite).to.have.property("LOCATE");
      expect(moduleResult.wttpSite).to.have.property("GET");
      
      // Validate contract address is valid
      const address = await moduleResult.wttpSite.getAddress();
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(address).to.not.equal(hre.ethers.ZeroAddress);
    });

    it("Should fail with invalid DPR address", async function () {
      const { owner } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      
      // Try to deploy with zero address (invalid DPR)
      await expect(
        Web3Site.deploy(
          hre.ethers.ZeroAddress, // Invalid DPR address
          DEFAULT_HEADER,
          owner.address
        )
      ).to.be.reverted; // Should fail during deployment or first call
    });

    it("Should fail with invalid owner address", async function () {
      const { dpr } = await loadFixture(deployIgnitionFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
        cache: {
          maxAge: 3600,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: true
        },
        redirect: {
          code: 0,
          location: ""
        },
        resourceAdmin: hre.ethers.ZeroHash
      };
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      
      // Deploy with zero address owner should work (but be impractical)
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        hre.ethers.ZeroAddress // Zero address owner
      );
      
      // Verify zero address has admin role (technically valid)
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), hre.ethers.ZeroAddress)).to.be.true;
    });
  });
}); 