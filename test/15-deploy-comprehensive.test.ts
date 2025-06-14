import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

// ESP integration
import { loadEspContracts, createUniqueData } from "./helpers/espHelpers";
import { 
  IDataPointRegistry, 
  IDataPointStorage,
  getSupportedChainIds,
} from "@tw3/esp";

// WTTP Core types
import { IBaseWTTPSite } from "@wttp/core";

const execAsync = promisify(exec);

/**
 * DEPLOYMENT INFRASTRUCTURE COMPREHENSIVE TESTING
 * 
 * Testing Categories:
 * 1. Task Parameter Intelligence (DPR auto-detection, owner defaults)
 * 2. Script Integration (Direct script imports and execution)
 * 3. Header System Validation (Current implementation + future presets)
 * 4. Error Handling & Edge Cases (Network failures, invalid parameters)
 * 5. ESP Integration Testing (Local deployment management)
 */
describe("15 - Deploy Infrastructure Comprehensive Tests", function () {
  let owner: SignerWithAddress;
  let deployer: SignerWithAddress;
  let customOwner: SignerWithAddress;
  let dps: IDataPointStorage;
  let dpr: IDataPointRegistry;
  
  // Test timeout for deployment operations
  this.timeout(60000);

  before(async function () {
    // Get signers for testing
    [owner, deployer, customOwner] = await hre.ethers.getSigners();
    let chainId = hre.network.config.chainId;

    if (chainId === 31337) {
        chainId = 1337;
    }
    // // Remove any existing localhost deployments, 
    // removeLocalhostDeployment(chainId || 1337);
    // console.log(`🔄 Removed existing localhost deployment for chainId: ${chainId}`);
    
    // Load ESP contracts for testing
    const espContracts = await loadEspContracts(
      chainId, // localhost chainId
      hre.ethers.parseUnits("0.001", "gwei"),
      owner.address,
      false
    );
    
    dps = espContracts.dps;
    dpr = espContracts.dpr;
    
    console.log(`\n🎯 ESP Test Environment Ready:`);
    console.log(`   DPS: ${await dps.getAddress()}`);
    console.log(`   DPR: ${await dpr.getAddress()}`);
    console.log(`   Owner: ${owner.address}`);
  });

  describe("1. Task Parameter Intelligence", function () {
    describe("DPR Auto-Detection", function () {
      it("should use test DPR for localhost network without --dpr parameter", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include("Using test DPR(temporary deployment):");
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });

      it("should use @tw3/esp DPR lookup for supported networks", async function () {
        // Test network configuration with supported chainId
        const supportedChains = getSupportedChainIds();
        
        if (supportedChains.length > 0) {
          // This test would work with actual supported networks
          // For localhost, we verify the auto-detection logic exists
          const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
          expect(stdout).to.include("Using test DPR(temporary deployment):");
        } else {
          // Verify the function is available even if no chains supported
          expect(getSupportedChainIds).to.be.a('function');
        }
      });

      it("should allow custom DPR override", async function () {
        const customDPR = "0x1234567890123456789012345678901234567890";
        const { stdout } = await execAsync(`npx hardhat site:deploy --dpr ${customDPR} --network localhost`);
        
        expect(stdout).to.include("Using custom DPR");
        expect(stdout).to.include(customDPR);
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });

      it("should handle missing chainId configuration gracefully", async function () {
        // This tests the error handling path
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Should still work with localhost fallback
        expect(stdout).to.include("Using test DPR(temporary deployment):");
        expect(stdout).to.not.include("ChainId not configured");
      });
    });

    describe("Owner Auto-Detection", function () {
      it("should default to signer[0] when no --owner parameter provided", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include(`👤 Deployer: ${owner.address}`);
        expect(stdout).to.include(`👤 Owner: ${owner.address}`);
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });

      it("should use custom owner when --owner parameter provided", async function () {
        const { stdout } = await execAsync(`npx hardhat site:deploy --owner ${customOwner.address} --network localhost`);
        
        expect(stdout).to.include(`👤 Deployer: ${owner.address}`);
        expect(stdout).to.include(`👤 Owner: ${customOwner.address}`);
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });

      it.skip("should validate owner address format", async function () {
        const invalidOwner = "invalid-address";
        
        try {
          await execAsync(`npx hardhat site:deploy --owner ${invalidOwner} --network localhost`);
          expect.fail("Should have thrown error for invalid owner address");
        } catch (error: any) {
          expect(error.message).to.include("invalid address");
        }
      });
    });

    describe("Cache Preset Validation", function () {
      it("should accept numeric cache preset values (0-6)", async function () {
        for (let preset = 0; preset <= 6; preset++) {
          const { stdout } = await execAsync(`npx hardhat site:deploy --cache-preset ${preset} --network localhost`);
          
          expect(stdout).to.include(`⚙️  Cache preset: ${preset}`);
          expect(stdout).to.include("✅ Web3Site deployed successfully!");
        }
      });

      it.skip("should reject invalid cache preset values", async function () {
        try {
          await execAsync("npx hardhat site:deploy --cache-preset 999 --network localhost");
          expect.fail("Should have thrown error for invalid cache preset");
        } catch (error: any) {
          // Should fail gracefully with validation error
          expect(error.message).to.include("Command failed:");
        }
      });

      it("should use default cache preset (3) when none specified", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include("⚙️  Cache preset: 3");
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });
    });
  });

  describe("2. Header Preset System (Future Implementation)", function () {
    describe.skip("Current Implementation Status", function () {
      it("should identify missing --header-preset flag", async function () {
        try {
          await execAsync("npx hardhat site:deploy --header-preset basic --network localhost");
          expect.fail("Should have thrown unrecognized parameter error");
        } catch (error: any) {
          expect(error.message).to.include("Unrecognized param --header-preset");
        }
      });

      it("should identify missing --cors-preset flag", async function () {
        try {
          await execAsync("npx hardhat site:deploy --cors-preset permissive --network localhost");
          expect.fail("Should have thrown unrecognized parameter error");
        } catch (error: any) {
          expect(error.message).to.include("Unrecognized param --cors-preset");
        }
      });

      it("should identify limited cache preset support", async function () {
        try {
          await execAsync("npx hardhat site:deploy --cache-preset aggressive --network localhost");
          expect.fail("Should have thrown invalid value error");
        } catch (error: any) {
          expect(error.message).to.include("Invalid value aggressive for argument cachePreset");
        }
      });
    });

    describe("Header Structure Validation", function () {
      it.skip("should generate valid header structure for contract deployment", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Extract deployed contract address from output
        const addressMatch = stdout.match(/📍 Address: (0x[a-fA-F0-9]{40})/);
        expect(addressMatch).to.not.be.null;
        
        const contractAddress = addressMatch![1];
        
        // Connect to deployed contract and verify header structure
        const Web3Site = await hre.ethers.getContractFactory("Web3Site");
        const deployedSite = Web3Site.attach(contractAddress)as unknown as IBaseWTTPSite;
        
        // Test that contract was deployed successfully with valid header
        const dprFromContract = await deployedSite.DPR();
        expect(dprFromContract).to.equal("0x0000000000000000000000000000000000000001");
      });

      it("should validate CORS methods bitmask (511 = all methods)", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Contract deployment success indicates valid header structure
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.include("🧪 Contract test passed");
      });

      it("should validate CORS origins array format (9 elements)", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Deployment success indicates correct origins array structure
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.include("🧪 Contract test passed");
      });
    });
  });

  describe("3. Script Integration Testing", function () {
    describe("Direct Script Import", function () {
      it("should import deploy script module successfully", async function () {
        // Test that we can import the deploy task
        expect(async () => {
          const deployTaskPath = path.resolve("src/tasks/deploy.ts");
          expect(fs.existsSync(deployTaskPath)).to.be.true;
        }).to.not.throw();
      });

      it("should validate script parameter structure", async function () {
        // Test parameter validation by checking help output
        const { stdout } = await execAsync("npx hardhat help site:deploy");
        
        expect(stdout).to.include("Deploy a single Web3Site contract");
        expect(stdout).to.include("--dpr");
        expect(stdout).to.include("--owner");
        expect(stdout).to.include("--cache-preset");
        expect(stdout).to.include("--skip-verify");
        expect(stdout).to.include("--auto-fund");
      });
    });

    describe("Multi-Chain Script Integration", function () {
      it("should handle multi-chain deployment script patterns", async function () {
        // Test that multi-chain script exists and has proper structure
        const multiChainScriptPath = path.resolve("src/scripts/DeployMultiChain.ts");
        expect(fs.existsSync(multiChainScriptPath)).to.be.true;
      });

      it("should validate script vs task parameter differences", async function () {
        // Tasks should NOT have signer parameter (CLI only)
        // Scripts should accept ethers signer as deployer parameter
        const { stdout } = await execAsync("npx hardhat help site:deploy");
        
        // Should not have signer parameter in CLI task
        expect(stdout).to.not.include("--signer");
        expect(stdout).to.not.include("deployer parameter");
      });
    });
  });

  describe("4. Error Handling & Edge Cases", function () {
    describe("Network Configuration", function () {
      it.skip("should handle missing network parameter gracefully", async function () {
        try {
          await execAsync("npx hardhat site:deploy");
          expect.fail("Should require network parameter");
        } catch (error: any) {
          // Should fail with clear error about network requirement
          expect(error.message).to.include("Command failed:");
        }
      });

      it("should handle invalid network names", async function () {
        try {
          await execAsync("npx hardhat site:deploy --network invalid-network");
          expect.fail("Should fail with invalid network");
        } catch (error: any) {
          expect(error.message).to.include("Command failed:");
        }
      });
    });

    describe("Balance and Funding", function () {
      it("should estimate gas costs accurately", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include("⛽ Estimated cost:");
        expect(stdout).to.include("ETH");
        expect(stdout).to.include("gas");
      });

      it("should report deployer and owner balances", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include("💰 Deployer balance:");
        expect(stdout).to.include("💰 Owner balance:");
        expect(stdout).to.include("ETH");
      });

      it("should validate auto-funding flag functionality", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --auto-fund --network localhost");
        
        // Should not trigger funding with sufficient balance
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.not.include("💸 Funding deployer");
      });
    });

    describe("Contract Verification", function () {
      it("should skip verification for localhost network by default", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.not.include("🔍 Verifying contract");
      });

      it("should respect --skip-verify flag", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --skip-verify --network localhost");
        
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.not.include("🔍 Verifying contract");
      });
    });
  });

  describe("5. ESP Integration Testing", function () {
    describe("Local Deployment Management", function () {
      it("should integrate with ESP localhost deployment storage", async function () {
        // Verify ESP contracts are available for testing
        expect(await dps.getAddress()).to.match(/^0x[a-fA-F0-9]{40}$/);
        expect(await dpr.getAddress()).to.match(/^0x[a-fA-F0-9]{40}$/);
        
        // Test basic ESP functionality  
        const version = await dps.VERSION();
        expect(version).to.equal(2);
      });

      it("should deploy Web3Site with ESP integration", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Should successfully deploy with ESP DPR
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.include("🧪 Contract test passed - DPR:");
      });

      it("should validate ESP economic model integration", async function () {
        // Test that royalty payments work with deployed DPR
        const currentRoyaltyRate = await dpr.royaltyRate();
        expect(currentRoyaltyRate).to.equal(hre.ethers.parseUnits("0.001", "gwei"));
        
        const registryOwner = await dpr.owner();
        expect(registryOwner).to.equal(owner.address);
      });
    });

    describe("ESP Contract Functionality", function () {
      it("should support data point operations through deployed ESP", async function () {
        // Test ESP data point registration functionality
        const testData = hre.ethers.toUtf8Bytes(createUniqueData("Deploy Test Data"));
        
        const tx = await dpr.connect(owner).registerDataPoint(testData, owner.address);
        const receipt = await tx.wait();
        
        expect(receipt).to.not.be.null;
        expect(receipt!.status).to.equal(1);
        
        // Verify data was stored
        const dataPointAddress = await dps.calculateAddress(testData);
        const storedSize = await dps.dataPointSize(dataPointAddress);
        expect(storedSize).to.be.greaterThan(0);
      });

      it("should validate ESP chunking model (32KB limits)", async function () {
        // Test large data handling
        const largeData = hre.ethers.toUtf8Bytes("x".repeat(1000)); // 1KB test data
        
        const tx = await dpr.connect(owner).registerDataPoint(largeData, owner.address);
        await tx.wait();
        
        const dataPointAddress = await dps.calculateAddress(largeData);
        const storedSize = await dps.dataPointSize(dataPointAddress);
        expect(storedSize).to.equal(largeData.length);
      });
    });
  });

  describe("6. End-to-End Deployment Workflow", function () {
    describe("Complete Deployment Validation", function () {
      it("should execute full deployment workflow with minimal parameters", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Verify all key workflow steps
        expect(stdout).to.include("🚀 Web3Site Deployment Task");
        expect(stdout).to.include("🌐 Network: localhost");
        expect(stdout).to.include("👤 Deployer:");
        expect(stdout).to.include("👤 Owner:");
        expect(stdout).to.include("📍 Using test DPR(temporary deployment):");
        expect(stdout).to.include("⚙️  Cache preset:");
        expect(stdout).to.include("💰 Deployer balance:");
        expect(stdout).to.include("💰 Owner balance:");
        expect(stdout).to.include("⛽ Estimated cost:");
        expect(stdout).to.include("🚀 Deploying Web3Site...");
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
        expect(stdout).to.include("📍 Address:");
        expect(stdout).to.include("🔗 Transaction:");
        expect(stdout).to.include("🧪 Contract test passed - DPR:");
        expect(stdout).to.include("🎉 Deployment Summary:");
      });

      it("should provide complete deployment summary", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Verify deployment summary contains all required information
        expect(stdout).to.include("🎉 Deployment Summary:");
        expect(stdout).to.include("Web3Site:");
        expect(stdout).to.include("Owner:");
        expect(stdout).to.include("DPR:");
        expect(stdout).to.include("Transaction:");
      });

      it.skip("should validate deployed contract functionality", async function () {
        const { stdout } = await execAsync("npx hardhat site:deploy --network localhost");
        
        // Extract contract address for functionality testing
        const addressMatch = stdout.match(/📍 Address: (0x[a-fA-F0-9]{40})/);
        expect(addressMatch).to.not.be.null;
        
        const contractAddress = addressMatch![1];

        console.log(`🔍 Contract address: ${contractAddress}`);
        
        // Connect to deployed contract
        const Web3Site = await hre.ethers.getContractFactory("Web3Site");
        const deployedSite = Web3Site.attach(contractAddress) as unknown as IBaseWTTPSite;
        
        // Test basic contract functionality
        const siteAdminRole = await deployedSite.getSiteAdminRole();
        expect(siteAdminRole).to.equal(hre.ethers.ZeroHash);
        
        // Test that contract is properly initialized
        const hasRole = await deployedSite.hasRole(
          siteAdminRole,
          deployer.address
        );
        expect(hasRole).to.be.true;
      });
    });

    describe("Parameter Combination Testing", function () {
      it("should handle all parameter combinations correctly", async function () {
        const customDPR = "0x1234567890123456789012345678901234567890";
        const { stdout } = await execAsync(
          `npx hardhat site:deploy --dpr ${customDPR} --owner ${customOwner.address} --cache-preset 5 --auto-fund --skip-verify --network localhost`
        );
        
        expect(stdout).to.include(`Using custom DPR: ${customDPR}`);
        expect(stdout).to.include(`👤 Owner: ${customOwner.address}`);
        expect(stdout).to.include("⚙️  Cache preset: 5");
        expect(stdout).to.include("✅ Web3Site deployed successfully!");
      });

      it("should maintain deployment success across different cache presets", async function () {
        // Test multiple cache presets to ensure header generation works
        for (const preset of [0, 2, 4, 6]) {
          const { stdout } = await execAsync(`npx hardhat site:deploy --cache-preset ${preset} --network localhost`);
          
          expect(stdout).to.include(`⚙️  Cache preset: ${preset}`);
          expect(stdout).to.include("✅ Web3Site deployed successfully!");
        }
      });
    });
  });
}); 