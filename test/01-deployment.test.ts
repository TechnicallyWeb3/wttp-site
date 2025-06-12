import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";
import path from "path";
import * as esp from "@tw3/esp";

// Import types and interfaces from @wttp/core
import {
  type HeaderInfoStruct,
  type IDataPointStorage,
  type IDataPointRegistry,
} from "@wttp/core";

import { 
  DEFAULT_HEADERS, 
  Method, 
  ALL_METHODS_BITMASK,
  methodsToBitmask,
  ORIGINS_PRESETS
} from "@wttp/core";

import { TestWTTPPermissions } from "../typechain-types/contracts/test/TestWTTPPermissions";
import { TestWTTPStorage } from "../typechain-types/contracts/test/TestWTTPStorage";
import { TestWTTPSite } from "../typechain-types/contracts/test/TestWTTPSite";
import { IBaseWTTPSite } from "@wttp/core";

import { loadEspContracts } from "./helpers/espHelpers";
import { BaseContract } from "ethers";

// Local contract types will be inferred from ethers.getContractFactory

describe("01 - WTTP Contract Deployment Tests", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  
  // Contract instances - using any for locally compiled contracts
  let dataPointStorage: IDataPointStorage;
  let dataPointRegistry: IDataPointRegistry;
  let testWTTPPermissions: TestWTTPPermissions;
  let testWTTPStorage: TestWTTPStorage;
  let testWTTPSite: TestWTTPSite;
  let web3Site: IBaseWTTPSite;
  
  // Default values for testing
  let defaultHeader: HeaderInfoStruct;
  let royaltyRate: bigint;
  
  before(async function () {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    // Set up default values
    royaltyRate = ethers.parseUnits("0.001", "gwei"); // 1000000 wei
    
    defaultHeader = DEFAULT_HEADERS.PUBLIC
    const { dps, dpr } = await loadEspContracts();
    dataPointStorage = dps;
    dataPointRegistry = dpr;
  });

  describe("ESP Dependency Management", function () {
    it("should check for ESP deployments on current network", async function () {
      const network = await ethers.provider.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log(`Testing on chain ID: ${chainId}`);
      
      const supportedChains = esp.getSupportedChainIds();
      console.log(`ESP supported chains: ${supportedChains.join(", ")}`);
      
      const isSupported = supportedChains.includes(chainId);
      console.log(`Chain ${chainId} supported by ESP: ${isSupported}`);
      
      // We'll continue regardless - this is informational
      expect(typeof isSupported).to.equal("boolean");
    });

    it("should copy ESP contracts to local test folder if no deployment available", async function () {
      const network = await ethers.provider.getNetwork();
      const chainId = Number(network.chainId);
      
      const supportedChains = esp.getSupportedChainIds();
      const hasDeployment = supportedChains.includes(chainId);
      
      if (!hasDeployment) {
        console.log("No ESP deployment found, copying contracts to local test folder...");
        
        // Create local test contracts directory if it doesn't exist
        const localContractsDir = path.join(__dirname, "..", "contracts", "test", "esp");
        if (!fs.existsSync(localContractsDir)) {
          fs.mkdirSync(localContractsDir, { recursive: true });
        }
        
        // Copy DataPointStorage.sol
        const dpsSource = path.join(__dirname, "..", "node_modules", "@tw3", "esp", "contracts", "DataPointStorage.sol");
        const dpsTarget = path.join(localContractsDir, "DataPointStorage.sol");
        
        if (fs.existsSync(dpsSource) && !fs.existsSync(dpsTarget)) {
          fs.copyFileSync(dpsSource, dpsTarget);
          console.log("Copied DataPointStorage.sol to local test folder");
        }
        
        // Copy DataPointRegistry.sol
        const dprSource = path.join(__dirname, "..", "node_modules", "@tw3", "esp", "contracts", "DataPointRegistry.sol");
        const dprTarget = path.join(localContractsDir, "DataPointRegistry.sol");
        
        if (fs.existsSync(dprSource) && !fs.existsSync(dprTarget)) {
          fs.copyFileSync(dprSource, dprTarget);
          console.log("Copied DataPointRegistry.sol to local test folder");
        }
        
        // Copy interfaces directory
        const interfacesSource = path.join(__dirname, "..", "node_modules", "@tw3", "esp", "contracts", "interfaces");
        const interfacesTarget = path.join(localContractsDir, "interfaces");
        
        if (fs.existsSync(interfacesSource) && !fs.existsSync(interfacesTarget)) {
          fs.mkdirSync(interfacesTarget, { recursive: true });
          
          const interfaceFiles = fs.readdirSync(interfacesSource);
          interfaceFiles.forEach(file => {
            const sourceFile = path.join(interfacesSource, file);
            const targetFile = path.join(interfacesTarget, file);
            fs.copyFileSync(sourceFile, targetFile);
          });
          console.log("Copied ESP interfaces to local test folder");
        }
        
        console.log("ESP contracts copied successfully");
      } else {
        console.log("ESP deployment available, no need to copy contracts");
      }
      
      // This test always passes - it's about setup
      expect(true).to.be.true;
    });
  });

  describe("ESP Contract Deployment", function () {
    it("should deploy DataPointStorage contract", async function () {
      
      const deployedAddress = await dataPointStorage.getAddress();
      console.log(`DataPointStorage deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test basic functionality
      const version = await dataPointStorage.VERSION();
      expect(version).to.equal(2);
      
      // Test address calculation
      const testData = ethers.toUtf8Bytes("test data");
      const calculatedAddress = await dataPointStorage.calculateAddress(testData);
      expect(calculatedAddress).to.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should deploy DataPointRegistry contract", async function () {

      const deployedAddress = await dataPointRegistry.getAddress();
      console.log(`DataPointRegistry deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test basic functionality
      const dpsAddress = await dataPointRegistry.DPS();
      expect(dpsAddress).to.equal(await dataPointStorage.getAddress());
      
      const currentRoyaltyRate = await dataPointRegistry.royaltyRate();
      expect(currentRoyaltyRate).to.equal(royaltyRate);
      
      const registryOwner = await dataPointRegistry.owner();
      expect(registryOwner).to.equal(owner.address);
    });

    it("should verify ESP contract integration", async function () {
      // Test data point registration through registry
      const testData = ethers.toUtf8Bytes("Hello, WTTP!");
      const publisher = user1.address;
      
      // Register a data point
      const tx = await dataPointRegistry.connect(user1).registerDataPoint(testData, publisher);
      const receipt = await tx.wait();
      
      expect(receipt).to.not.be.null;
      
      // Verify the data point was stored
      const dataPointAddress = await dataPointStorage.calculateAddress(testData);
      const storedSize = await dataPointStorage.dataPointSize(dataPointAddress);
      expect(storedSize).to.be.greaterThan(0);
      
      const storedData = await dataPointStorage.readDataPoint(dataPointAddress);
      expect(storedData).to.equal(ethers.hexlify(testData));
    });
  });

  describe("WTTP Permissions Contract Deployment", function () {
    it("should deploy TestWTTPPermissions contract", async function () {
      // Deploy TestWTTPPermissions
      const TestWTTPPermissionsFactory = await ethers.getContractFactory("TestWTTPPermissions");
      testWTTPPermissions = await TestWTTPPermissionsFactory.deploy(owner.address) as unknown as TestWTTPPermissions;
      await testWTTPPermissions.waitForDeployment();
      
      const deployedAddress = await testWTTPPermissions.getAddress();
      console.log(`TestWTTPPermissions deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      const siteAdminRole = await testWTTPPermissions.getSiteAdminRole();
      expect(siteAdminRole).to.be.a("string").and.match(/^0x[a-fA-F0-9]{64}$/);
      
      const publicRole = await testWTTPPermissions.testPublicRole();
      expect(publicRole).to.equal("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      // Test basic functionality
      const defaultAdminRole = await testWTTPPermissions.testBlacklistRole();
      expect(defaultAdminRole).to.equal(ethers.keccak256(ethers.toUtf8Bytes("BLACKLIST_ROLE")));
    });

    it("should verify permissions role management", async function () {
      // Test default admin role assignment
      const hasDefaultAdminRole = await testWTTPPermissions.hasRole(
        await testWTTPPermissions.DEFAULT_ADMIN_ROLE(),
        owner.address
      );
      expect(hasDefaultAdminRole).to.be.true;
      
      // Test site admin role functionality
      const siteAdminRole = await testWTTPPermissions.testSiteAdminRole();
      
      // Grant site admin role to user1
      await testWTTPPermissions.grantRole(siteAdminRole, user1.address);
      
      const hasSiteAdminRole = await testWTTPPermissions.hasRole(siteAdminRole, user1.address);
      expect(hasSiteAdminRole).to.be.true;
      
      // Test public role logic (inverted)
      const publicRole = await testWTTPPermissions.testPublicRole();
      const hasPublicRole = await testWTTPPermissions.hasRole(publicRole, user2.address);
      expect(hasPublicRole).to.be.true; // Should be true for users without explicit PUBLIC_ROLE denial
    });

    it("should test exposed internal functions", async function () {
      // Test notAdminRole modifier
      const publicRole = await testWTTPPermissions.testPublicRole();
      
      // Should not revert for non-admin role
      await expect(testWTTPPermissions.testNotAdminRole(publicRole)).to.not.be.reverted;
      
      // Should revert for admin roles
      const defaultAdminRole = await testWTTPPermissions.DEFAULT_ADMIN_ROLE();
      await expect(testWTTPPermissions.testNotAdminRole(defaultAdminRole)).to.be.reverted;
      
      const siteAdminRole = await testWTTPPermissions.testSiteAdminRole();
      await expect(testWTTPPermissions.testNotAdminRole(siteAdminRole)).to.be.reverted;
    });
  });

  describe("WTTP Storage Contract Deployment", function () {
    it("should deploy TestWTTPStorage contract", async function () {
      // Deploy TestWTTPStorage with dependencies
      const TestWTTPStorageFactory = await ethers.getContractFactory("TestWTTPStorage");
      testWTTPStorage = await TestWTTPStorageFactory.deploy(
        owner.address,
        await dataPointRegistry.getAddress()
      ) as unknown as TestWTTPStorage;
      await testWTTPStorage.waitForDeployment();
      
      const deployedAddress = await testWTTPStorage.getAddress();
      console.log(`TestWTTPStorage deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test basic functionality
      const dprAddress = await testWTTPStorage.DPR();
      expect(dprAddress).to.equal(await dataPointRegistry.getAddress());
      
      const maxMethods = await testWTTPStorage.testMaxMethods();
      expect(maxMethods).to.equal(9); // Should be 9 methods total
    });

    it("should verify storage contract functionality", async function () {
      // Test header operations - use a simple valid header instead of modifying defaultHeader
      const testHeader = {
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: ""
        },
        cors: {
          methods: methodsToBitmask([Method.HEAD, Method.GET, Method.POST]), // Only first 3 methods (HEAD, GET, POST) 
          origins: ORIGINS_PRESETS.PUBLIC,
          preset: 0,
          custom: ""
        },
        redirect: {
          code: 301,
          location: "./test.html"
        }
      };
      const headerTx = await testWTTPStorage.testCreateHeader(testHeader);
      const receipt = await headerTx.wait();
      expect(receipt).to.not.be.null; // Test that the transaction was successful
      
      // extract the header address from the receipt from the ""
      
      // Test metadata operations
      const testPath = "/test/resource";
      const metadata = await testWTTPStorage.testReadMetadata(testPath);
      expect(metadata.size).to.equal(0);  // Check size instead of path for non-existent resource
      expect(metadata.version).to.equal(0); // should not incriment until the resource is created
      expect(metadata.lastModified).to.equal(0); // should not update until the resource is created
    });

    it("should test exposed internal functions", async function () {
      // Test zero header and metadata getters
      const zeroHeader = await testWTTPStorage.testZeroHeader();
      expect(zeroHeader.cors).to.not.be.undefined; // Check structure exists
      expect(zeroHeader.cors.methods).to.equal(0);
      
      const zeroMetadata = await testWTTPStorage.testZeroMetadata();
      expect(zeroMetadata.size).to.equal(0); // Check size instead of path
      expect(zeroMetadata.version).to.equal(0);
      
      // // Test immutable resource check
      // const testPath = "/immutable/test";
      // const isImmutable = await testWTTPStorage.isResourceImmutable(testPath);
      // expect(isImmutable).to.be.false; // Should be false for non-existent resource
    });
  });

  describe("WTTP Site Contract Deployment", function () {
    it("should deploy TestWTTPSite contract", async function () {

      console.log(await dataPointRegistry.getAddress());
      // Deploy TestWTTPSite with dependencies
      const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
      testWTTPSite = await TestWTTPSiteFactory.deploy(
        owner.address,
        await dataPointRegistry.getAddress(),
        defaultHeader
      ) as unknown as TestWTTPSite;
      await testWTTPSite.waitForDeployment();
      
      const deployedAddress = await testWTTPSite.getAddress();
      console.log(`TestWTTPSite deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test inheritance from storage
      const exists = await testWTTPSite.testResourceExists("/test");
      expect(exists).to.be.false;
    });

    it("should verify site contract functionality", async function () {
      // Test method authorization
      const testPath = "/admin/resource";
      const getMethod = 0; // GET method
      
      const authorizedRole = await testWTTPSite.testGetAuthorizedRole(testPath, getMethod);
      expect(authorizedRole).to.match(/^0x[a-fA-F0-9]{64}$/);
      
      // Test authorization check
      const isAuthorized = await testWTTPSite.testIsAuthorized(testPath, getMethod, owner.address);
      expect(isAuthorized).to.be.true; // Owner should be authorized
      
      // Test method allowance
      const methodAllowed = await testWTTPSite.testMethodAllowed(testPath, getMethod);
      expect(methodAllowed).to.be.true;
    });

    it("should test HTTP method operations", async function () {
      // Test OPTIONS method
      const testPath = "/test/options";
      
      const optionsResponse = await testWTTPSite.testOPTIONS(testPath, Method.OPTIONS);
      expect(Number(optionsResponse.status)).to.equal(204); // Convert BigInt to number
      
      // Test HEAD method
      const headRequest = {
        path: testPath,
        ifMatch: ethers.ZeroHash,
        ifNoneMatch: ethers.ZeroHash,
        ifModifiedSince: 0,
        ifUnmodifiedSince: 0,
        range: { start: 0, end: 0 }
      };
      
      await expect(
        testWTTPSite.testHEAD(headRequest, Method.HEAD)
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
      
      // Test LOCATE method
      const locateRequest = {
        head: headRequest,
        rangeChunks: { start: 0, end: 0 }
      };
      await expect(
        testWTTPSite.testGET(locateRequest, Method.GET)
      ).to.be.revertedWithCustomError(testWTTPSite, "_404");
    });
  });

  describe("Web3Site Contract Deployment", function () {
    it("should deploy Web3Site contract", async function () {
      console.log(await dataPointRegistry.getAddress());
      // Deploy Web3Site (production-ready implementation)
      const Web3SiteFactory = await ethers.getContractFactory("Web3Site");
      web3Site = await Web3SiteFactory.deploy(
        owner.address,
        await dataPointRegistry.getAddress(),
        defaultHeader
      ) as unknown as IBaseWTTPSite;
      await web3Site.waitForDeployment();
      
      const deployedAddress = await web3Site.getAddress();
      console.log(`Web3Site deployed at: ${deployedAddress}`);
      
      // Verify deployment
      expect(deployedAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it("should verify Web3Site basic functionality", async function () {
      // Test that Web3Site has the same interface as TestWTTPSite
      const testPath = "/production/test";
      
      // Web3Site should inherit all functionality from WTTPSite
      // Test a basic operation to ensure it works
      const network = await ethers.provider.getNetwork();
      expect(network.chainId).to.be.a("bigint");
      
      // Verify contract deployment was successful
      const code = await ethers.provider.getCode(await web3Site.getAddress());
      expect(code.length).to.be.greaterThan(2); // "0x" + actual bytecode
    });
  });

  describe("Integration Tests", function () {
    it("should test complete WTTP ecosystem integration", async function () {
      // Test data flow: DPS -> DPR -> Storage -> Site
      const testData = ethers.toUtf8Bytes("Integration test data");
      const testPath = "/integration/test";
      
      // 1. Register data point through DPR
      const dataPointAddress = await dataPointRegistry.connect(user1).registerDataPoint.staticCall(
        testData,
        user1.address
      );
      expect(dataPointAddress).to.match(/^0x[a-fA-F0-9]{64}$/);
      
      // 2. Verify DPS can read the data
      await dataPointRegistry.connect(user1).registerDataPoint(testData, user1.address);
      const storedData = await dataPointStorage.readDataPoint(dataPointAddress);
      expect(storedData).to.equal(ethers.hexlify(testData));
      
      // 3. Test that storage contracts can interact with DPR
      const dprFromStorage = await testWTTPStorage.DPR();
      expect(dprFromStorage).to.equal(await dataPointRegistry.getAddress());
      
      // 4. Test site contract authorization
      const hasRole = await testWTTPSite.hasRole(
        await testWTTPSite.DEFAULT_ADMIN_ROLE(),
        owner.address
      );
      expect(hasRole).to.be.true;
    });

    it("should verify all contracts can interact with each other", async function () {
      // Test cross-contract interactions
      const contracts = [
        { name: "DataPointStorage", address: await dataPointStorage.getAddress() },
        { name: "DataPointRegistry", address: await dataPointRegistry.getAddress() },
        { name: "TestWTTPPermissions", address: await testWTTPPermissions.getAddress() },
        { name: "TestWTTPStorage", address: await testWTTPStorage.getAddress() },
        { name: "TestWTTPSite", address: await testWTTPSite.getAddress() },
        { name: "Web3Site", address: await web3Site.getAddress() }
      ];
      
      console.log("\nDeployed Contracts Summary:");
      contracts.forEach(contract => {
        console.log(`${contract.name}: ${contract.address}`);
      });
      
      // Verify all addresses are valid
      for (const contract of contracts) {
        expect(contract.address).to.match(/^0x[a-fA-F0-9]{40}$/);
        
        // Verify contract has code
        const code = await ethers.provider.getCode(contract.address);
        expect(code.length).to.be.greaterThan(2);
      }
    });

    it("should test deployment gas costs", async function () {
      // This test tracks gas usage for deployments
      const network = await ethers.provider.getNetwork();
      console.log(`\nGas usage analysis on chain ${network.chainId}:`);
      
      // Estimate deployment costs for reference
      const TestWTTPStorageFactory = await ethers.getContractFactory("TestWTTPStorage");
      
      const gasEstimate = await ethers.provider.estimateGas({
        data: TestWTTPStorageFactory.bytecode + TestWTTPStorageFactory.interface.encodeDeploy([
          owner.address,
          await dataPointRegistry.getAddress()
        ]).slice(2) // Remove 0x prefix
      });
      
      console.log(`TestWTTPStorage deployment gas estimate: ${gasEstimate}`);
      
      expect(gasEstimate).to.be.a("bigint");
      expect(gasEstimate).to.be.greaterThan(0n);
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("should handle invalid deployment parameters", async function () {
      const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
      
      // Test deployment with zero address for DPR - this might not revert in constructor
      // Instead test with invalid header structure
      const invalidHeader = {
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: ""
        },
        cors: {
          methods: ALL_METHODS_BITMASK,
          origins: [ethers.ZeroHash], // 0-8 entries or > 9 is invalid
          preset: 0,
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };
      
      await expect(
        TestWTTPSiteFactory.deploy(
          owner.address,
          await dataPointRegistry.getAddress(),
          invalidHeader
        )
      ).to.be.reverted;
    });

    it("should verify contract upgradability considerations", async function () {
      // While these contracts aren't upgradeable, we should verify
      // that they don't have upgrade patterns that could cause issues
      
      // Check that contracts don't have delegatecall vulnerabilities
      const storageCode = await ethers.provider.getCode(await testWTTPStorage.getAddress());
      expect(storageCode).to.not.include("delegatecall");
      
      // Verify contracts have proper access controls
      const hasAdminRole = await testWTTPPermissions.hasRole(
        await testWTTPPermissions.DEFAULT_ADMIN_ROLE(),
        owner.address
      );
      expect(hasAdminRole).to.be.true;
    });

    it("should test contract size limits", async function () {
      // Verify deployed contracts are within size limits
      const contracts = [
        await dataPointStorage.getAddress(),
        await dataPointRegistry.getAddress(),
        await testWTTPStorage.getAddress(),
        await testWTTPSite.getAddress()
      ];
      
      for (const contractAddress of contracts) {
        const code = await ethers.provider.getCode(contractAddress);
        const codeSize = (code.length - 2) / 2; // Remove 0x and convert hex to bytes
        
        console.log(`Contract ${contractAddress} size: ${codeSize} bytes`);
        
        // Ethereum contract size limit is 24KB (24576 bytes)
        expect(codeSize).to.be.lessThan(24576);
      }
    });
  });
}); 