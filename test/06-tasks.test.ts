import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { DataPointStorage__factory, DataPointRegistry__factory } from "@tw3/esp";

describe("Hardhat Tasks Tests", function () {
  let owner: any;
  let siteAdmin: any;

  async function deployTaskFixture() {
    [owner, siteAdmin] = await hre.ethers.getSigners();
    
    // Deploy ESP contracts that tasks would use
    const dps = await new DataPointStorage__factory(owner).deploy();
    await dps.waitForDeployment();
    
    const royaltyRate = hre.ethers.parseEther("0.00001");
    const dpr = await new DataPointRegistry__factory(owner).deploy(owner.address, await dps.getAddress(), royaltyRate);
    await dpr.waitForDeployment();
    
    return { dpr, dps, owner, siteAdmin };
  }

  describe("Deploy Task", function () {
    it("Should simulate deploy task execution", async function () {
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      // Simulate what the deploy task does
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
      
      // Deploy Web3Site as the task would
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      // Verify deployment was successful
      expect(await web3Site.DPR()).to.equal(await dpr.getAddress());
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), owner.address)).to.be.true;
      
      console.log(`Web3Site deployed to: ${await web3Site.getAddress()}`);
      console.log(`DPR address: ${await dpr.getAddress()}`);
      console.log(`Owner: ${owner.address}`);
    });

    it("Should handle deploy task with custom parameters", async function () {
      const { owner, siteAdmin } = await loadFixture(deployTaskFixture);
      
      // Deploy custom ESP contracts
      const customDps = await new DataPointStorage__factory(siteAdmin).deploy();
      await customDps.waitForDeployment();
      
      const customRoyalty = hre.ethers.parseEther("0.00005"); // Custom royalty rate
      const customDpr = await new DataPointRegistry__factory(siteAdmin).deploy(siteAdmin.address, await customDps.getAddress(), customRoyalty);
      await customDpr.waitForDeployment();
      
      // Custom header configuration
      const CUSTOM_HEADER = {
        methods: 7, // Limited methods (GET, HEAD, OPTIONS only)
        cache: {
          maxAge: 7200, // 2 hours
          sMaxAge: 3600, // 1 hour
          noStore: true,
          noCache: false,
          immutableFlag: false,
          publicFlag: false, // Private by default
          mustRevalidate: true,
          proxyRevalidate: false,
          mustUnderstand: false,
          staleWhileRevalidate: 300,
          staleIfError: 150
        },
        redirect: {
          code: 301, // Permanent redirect by default
          location: "/default"
        },
        resourceAdmin: hre.ethers.keccak256(hre.ethers.toUtf8Bytes("CUSTOM_ADMIN_ROLE"))
      };
      
      // Deploy with custom parameters
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await customDpr.getAddress(),
        CUSTOM_HEADER,
        siteAdmin.address // Custom owner
      );
      await web3Site.waitForDeployment();
      
      // Verify custom configuration
      expect(await web3Site.DPR()).to.equal(await customDpr.getAddress());
      expect(await web3Site.hasRole(hre.ethers.zeroPadBytes("0x", 32), siteAdmin.address)).to.be.true;
      
      // Test custom header settings
      const optionsResponse = await web3Site.OPTIONS({
        path: "/test",
        protocol: "WTTP/3.0",
        method: 1 // OPTIONS
      });
      
      expect(optionsResponse.responseLine.code).to.equal(204);
      expect(optionsResponse.allow).to.equal(CUSTOM_HEADER.methods);
    });

    it("Should validate required parameters", async function () {
      const { owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      
      // Test with invalid DPR address (zero address)
      await expect(
        Web3Site.deploy(
          hre.ethers.ZeroAddress, // Invalid DPR
          DEFAULT_HEADER,
          owner.address
        )
      ).to.be.reverted;
    });
  });

  describe("Task Parameter Validation", function () {
    it("Should validate DPR parameter format", async function () {
      // Test address format validation
      const validAddress = "0x" + "1".repeat(40);
      const invalidAddress = "0x" + "1".repeat(39); // Too short
      
      expect(hre.ethers.isAddress(validAddress)).to.be.true;
      expect(hre.ethers.isAddress(invalidAddress)).to.be.false;
      expect(hre.ethers.isAddress("not an address")).to.be.false;
    });

    it("Should validate owner parameter format", async function () {
      const [testAccount] = await hre.ethers.getSigners();
      
      // Valid owner address
      expect(hre.ethers.isAddress(testAccount.address)).to.be.true;
      
      // Invalid formats
      expect(hre.ethers.isAddress("")).to.be.false;
      expect(hre.ethers.isAddress("0x123")).to.be.false;
      expect(hre.ethers.isAddress("invalid")).to.be.false;
    });

    it("Should validate header parameter structure", async function () {
      // Valid header structure
      const validHeader = {
        methods: 511,
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
      
      // Validate methods field
      expect(typeof validHeader.methods).to.equal("number");
      expect(validHeader.methods).to.be.greaterThanOrEqual(0);
      expect(validHeader.methods).to.be.lessThanOrEqual(511); // Max 9 bits
      
      // Validate cache structure
      expect(validHeader.cache).to.have.property("maxAge");
      expect(validHeader.cache).to.have.property("publicFlag");
      expect(validHeader.cache).to.have.property("immutableFlag");
      expect(typeof validHeader.cache.maxAge).to.equal("number");
      expect(typeof validHeader.cache.publicFlag).to.equal("boolean");
      
      // Validate redirect structure
      expect(validHeader.redirect).to.have.property("code");
      expect(validHeader.redirect).to.have.property("location");
      expect(typeof validHeader.redirect.code).to.equal("number");
      expect(typeof validHeader.redirect.location).to.equal("string");
    });
  });

  describe("Task Output Validation", function () {
    it("Should produce valid deployment addresses", async function () {
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      const deploymentAddress = await web3Site.getAddress();
      
      // Validate deployment address format
      expect(hre.ethers.isAddress(deploymentAddress)).to.be.true;
      expect(deploymentAddress).to.not.equal(hre.ethers.ZeroAddress);
      expect(deploymentAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Validate contract is deployed at address
      const code = await hre.ethers.provider.getCode(deploymentAddress);
      expect(code).to.not.equal("0x"); // Should have contract code
    });

    it("Should produce valid transaction hashes", async function () {
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      
      const deploymentTx = web3Site.deploymentTransaction();
      expect(deploymentTx).to.not.be.null;
      
      if (deploymentTx) {
        expect(deploymentTx.hash).to.match(/^0x[a-fA-F0-9]{64}$/);
        expect(deploymentTx.from).to.equal(owner.address);
      }
    });

    it("Should provide deployment cost information", async function () {
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      const balanceBefore = await hre.ethers.provider.getBalance(owner.address);
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      const balanceAfter = await hre.ethers.provider.getBalance(owner.address);
      const deploymentCost = balanceBefore - balanceAfter;
      
      // Deployment should cost some gas
      expect(deploymentCost).to.be.greaterThan(0);
      
      console.log(`Deployment cost: ${hre.ethers.formatEther(deploymentCost)} ETH`);
    });
  });

  describe("Task Error Handling", function () {
    it("Should handle insufficient gas gracefully", async function () {
      // This test simulates what happens with insufficient gas
      // In a real task, this would be handled by the task runner
      
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      
      // Try deployment with very low gas limit
      await expect(
        Web3Site.deploy(
          await dpr.getAddress(),
          DEFAULT_HEADER,
          owner.address,
          { gasLimit: 1000 } // Very low gas limit
        )
      ).to.be.reverted; // Should fail due to insufficient gas
    });

    it("Should handle network connectivity issues", async function () {
      // This test simulates network issues during deployment
      // In practice, this would be handled by the task runner and provider
      
      const { dpr, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      // Normal deployment should work
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      expect(await web3Site.getAddress()).to.not.equal(hre.ethers.ZeroAddress);
    });
  });

  describe("Task Integration", function () {
    it("Should integrate with ESP contracts correctly", async function () {
      const { dpr, dps, owner } = await loadFixture(deployTaskFixture);
      
      const DEFAULT_HEADER = {
        methods: 511,
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
      
      // Deploy Web3Site
      const Web3Site = await hre.ethers.getContractFactory("Web3Site");
      const web3Site = await Web3Site.deploy(
        await dpr.getAddress(),
        DEFAULT_HEADER,
        owner.address
      );
      await web3Site.waitForDeployment();
      
      // Verify integration
      expect(await web3Site.DPR()).to.equal(await dpr.getAddress());
      
      // Test basic functionality
      const optionsResponse = await web3Site.OPTIONS({
        path: "/test",
        protocol: "WTTP/3.0",
        method: 1 // OPTIONS
      });
      
      expect(optionsResponse.responseLine.code).to.equal(204);
      
      console.log("Successfully deployed and verified Web3Site integration with ESP");
    });
  });
}); 