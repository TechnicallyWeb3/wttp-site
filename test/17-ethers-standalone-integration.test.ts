import { expect } from "chai";
import hre from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { JsonRpcProvider, Wallet, Contract, HDNodeWallet, formatEther, ContractFactory } from "ethers";
// import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { loadEspContracts } from "./helpers/espHelpers";
import { DEFAULT_HEADER } from "@wttp/core";
// import { getContractAddress } from "@tw3/esp";

// Import standalone ethers functions from built files
const builtEthersPath = path.resolve(__dirname, "../dist/cjs/src/ethers/index.js");
const builtUtilsPath = path.resolve(__dirname, "../dist/cjs/src/utils.js");
const artifactPath = path.resolve(__dirname, "../dist/cjs/artifacts/contracts/Web3Site.sol/Web3Site.json");

import { DataPointRegistry__factory, DataPointStorage__factory } from "@tw3/esp";

let ethersStandalone: any;
let Web3SiteArtifact: any;

// Load built files
if (fs.existsSync(builtEthersPath) && fs.existsSync(builtUtilsPath)) {
  ethersStandalone = require(builtEthersPath);
  Web3SiteArtifact = require(artifactPath);
} else {
  console.warn("⚠️  Built files not found. Run 'npm run build' first.");
}

describe("17 - Ethers Standalone Integration Tests", function () {
  // Hardhat signers (for setup only)
  let hardhatOwner: SignerWithAddress;
  let hardhatDeployer: SignerWithAddress;
  
  // Standalone ethers instances
  let provider: JsonRpcProvider;
  let signer: HDNodeWallet;
  let ownerWallet: HDNodeWallet;
  
  // ESP contracts (deployed via Hardhat for setup)
  let dprAddress: string;
  let dpsAddress: string;
  
  // Test site contract
  let wttpSiteAddress: string;
  
  // Test data
  const testDir = path.join(__dirname, "../test-ethers-data");
  const testFile = path.join(testDir, "test.html");
  const testContent = "<html><body>Test Content</body></html>";
  
  this.timeout(120000); // 2 minutes for integration tests

  before(async function () {
    if (!ethersStandalone || !Web3SiteArtifact) {
      console.warn("⚠️  Built files not found. Run 'npm run build' first.");
      this.skip();
    }

    // Get Hardhat signers for setup
    [hardhatOwner, hardhatDeployer] = await hre.ethers.getSigners();
    
    // Debug: Log Hardhat signer addresses
    console.log(`\n🔍 Hardhat Signers:`);
    console.log(`   Owner (index 0): ${hardhatOwner.address}`);
    console.log(`   Deployer (index 1): ${hardhatDeployer.address}`);
    
    // Create standalone ethers provider connected to local Hardhat node
    // Hardhat's default network runs on localhost:8545
    const rpcUrl = process.env.HARDHAT_NETWORK_RPC_URL || "http://localhost:8545";
    provider = new JsonRpcProvider(rpcUrl);
    
    // Verify connection by getting network info
    const providerNetwork = await provider.getNetwork();
    const hardhatNetwork = hre.network.config;
    expect(Number(providerNetwork.chainId)).to.equal(Number(hardhatNetwork.chainId));
    
    // Create standalone wallets - use Hardhat's mnemonic to derive keys
    // Hardhat uses a default mnemonic, we'll use the same accounts
    const mnemonic = process.env.OWNER_MNEMONIC || "test test test test test test test test test test test junk";
    
    // Derive accounts using the same path Hardhat uses
    // Hardhat uses standard BIP44 derivation: m/44'/60'/0'/0/{index}
    // Account 0: m/44'/60'/0'/0/0
    // Account 1: m/44'/60'/0'/0/1
    // HDNodeWallet.fromPhrase creates a node at m/44'/60'/0'/0, so we derive relative paths
    const hdNode = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0");
    ownerWallet = hdNode.derivePath("0").connect(provider);
    signer = hdNode.derivePath("1").connect(provider);
    
    // Debug: Log derived addresses
    console.log(`\n🔍 Derived Wallets:`);
    console.log(`   Owner (index 0): ${ownerWallet.address}`);
    console.log(`   Deployer (index 1): ${signer.address}`);
    
    // Verify addresses match
    const ownerMatch = ownerWallet.address.toLowerCase() === hardhatOwner.address.toLowerCase();
    const deployerMatch = signer.address.toLowerCase() === hardhatDeployer.address.toLowerCase();
    
    if (!ownerMatch || !deployerMatch) {
      console.warn(`⚠️  Ethers owner address: ${ownerWallet.address} | Hardhat owner address: ${hardhatOwner.address}`);
      console.warn(`⚠️  Ethers deployer address: ${signer.address} | Hardhat deployer address: ${hardhatDeployer.address}`);
      console.warn("⚠️  Wallet addresses don't match Hardhat signers, using Hardhat provider directly");
      // If addresses don't match, we can still proceed but transactions might fail
      // The issue is likely with derivation path - Hardhat might use a different path
    } else {
      console.log(`✅ Wallet addresses match Hardhat signers`);
    }
    
    console.log(`\n🔧 Test Setup:`);
    console.log(`   Provider: ${rpcUrl}`);
    console.log(`   Owner: ${ownerWallet.address}`);
    console.log(`   Deployer: ${signer.address}`);
    
    // Deploy ESP contracts using Hardhat (setup only)
    console.log(`\n📦 Deploying ESP contracts (Hardhat setup)...`);

    // Deploy DPS contract and wait for full confirmation
    const dpsFactory = new ContractFactory(DataPointStorage__factory.abi, DataPointStorage__factory.bytecode, signer);
    const dps = await dpsFactory.deploy() as Contract;
    
    // Get the deployment transaction and wait for it to be confirmed
    const dpsDeployTx = dps.deploymentTransaction();
    if (dpsDeployTx) {
      await dpsDeployTx.wait(1); // Wait for 1 confirmation
    }
    await dps.waitForDeployment();
    dpsAddress = await dps.getAddress();
    console.log(`   DPS: ${dpsAddress}`);
    
    // Additional wait to ensure nonce is updated in provider (critical for Hardhat automining)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Deploy DPR contract and wait for full confirmation
    const dprFactory = new ContractFactory(DataPointRegistry__factory.abi, DataPointRegistry__factory.bytecode, signer);
    const dpr = await dprFactory.deploy(ownerWallet.address, dpsAddress, 1000) as Contract;
    
    // Get the deployment transaction and wait for it to be confirmed
    const dprDeployTx = dpr.deploymentTransaction();
    if (dprDeployTx) {
      await dprDeployTx.wait(1); // Wait for 1 confirmation
    }
    await dpr.waitForDeployment();
    dprAddress = await dpr.getAddress();
    console.log(`   DPR: ${dprAddress}`);
    
    // Additional wait to ensure nonce is updated in provider
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Verify DPR can return DPS address
    try {
      const dpsFromDpr = await dpr.DPS();
      console.log(`   DPS from DPR: ${dpsFromDpr}`);
      if (dpsFromDpr.toLowerCase() !== dpsAddress.toLowerCase()) {
        console.warn(`   ⚠️  DPS address mismatch: expected ${dpsAddress}, got ${dpsFromDpr}`);
      } else {
        console.log(`   ✅ DPR.DPS() works correctly`);
      }
    } catch (error: any) {
      console.error(`   ❌ DPR.DPS() failed: ${error.message}`);
      throw Error(`DPR.DPS() failed: ${error.message}`);
    }
    
    // Create test directory and file
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFile, testContent);
    console.log(`\n📁 Created test file: ${testFile}`);
  });

  after(async function () {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("1. Deploy Web3Site (Standalone Ethers)", function () {
    it("should deploy Web3Site contract using standalone ethers", async function () {
      const deployResult = await ethersStandalone.deployWeb3Site({
        provider,
        signer,
        ownerAddress: ownerWallet.address,
        dprAddress,
        defaultHeader: DEFAULT_HEADER
      });

      expect(deployResult).to.not.be.undefined;
      expect(deployResult.address).to.be.a("string");
      expect(deployResult.address).to.match(/^0x[a-fA-F0-9]{40}$/);
      expect(deployResult.txHash).to.be.a("string");
      expect(deployResult.contract).to.not.be.undefined;

      wttpSiteAddress = deployResult.address;
      console.log(`\n✅ Deployed Web3Site: ${wttpSiteAddress}`);
      console.log(`   Transaction: ${deployResult.txHash}`);
      console.log(`   Cost: ${formatEther(deployResult.actualCost)} ETH`);

      // Verify contract is functional
      const wttpSite = new Contract(wttpSiteAddress, Web3SiteArtifact.abi, provider);
      const dprFromSite = await wttpSite.DPR();
      expect(dprFromSite.toLowerCase()).to.equal(dprAddress.toLowerCase());
      
      // Also verify DPS can be accessed (it calls DPR.DPS())
      try {
        const dpsFromSite = await wttpSite.DPS();
        console.log(`   DPS from site: ${dpsFromSite}`);
        expect(dpsFromSite.toLowerCase()).to.equal(dpsAddress.toLowerCase());
        console.log(`   ✅ DPS access works`);
      } catch (error: any) {
        console.error(`   ❌ DPS access failed: ${error.message}`);
        throw error;
      }
    });
  });

  describe("2. Estimate Operations (Standalone Ethers)", function () {
    it("should estimate file upload costs", async function () {
      // Ensure wttpSiteAddress is set
      if (!wttpSiteAddress) {
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
      }
      
      const estimate = await ethersStandalone.estimateFile(
        wttpSiteAddress,
        testFile,
        "/test.html",
        {
          provider,
          gasPriceGwei: 20
        }
      );

      expect(estimate).to.not.be.undefined;
      expect(estimate.totalGas).to.be.a("bigint");
      expect(estimate.totalCost).to.be.a("bigint");
      expect(estimate.royaltyCost).to.be.a("bigint");
      expect(estimate.transactionCount).to.be.greaterThan(0);
      expect(estimate.chunksToUpload).to.be.greaterThan(0);

      console.log(`\n📊 File Upload Estimate:`);
      console.log(`   Total gas: ${estimate.totalGas.toString()}`);
      console.log(`   Total cost: ${formatEther(estimate.totalCost)} ETH`);
      console.log(`   Royalty cost: ${formatEther(estimate.royaltyCost)} ETH`);
      console.log(`   Transactions: ${estimate.transactionCount}`);
    });

    it("should estimate directory upload costs", async function () {
      const estimate = await ethersStandalone.estimateDirectory(
        wttpSiteAddress,
        testDir,
        "/test",
        {
          provider,
          gasPriceGwei: 20
        }
      );

      expect(estimate).to.not.be.undefined;
      expect(estimate.totalGas).to.be.a("bigint");
      expect(estimate.totalCost).to.be.a("bigint");
      expect(estimate.totalTransactions).to.be.greaterThan(0);

      console.log(`\n📊 Directory Upload Estimate:`);
      console.log(`   Total gas: ${estimate.totalGas.toString()}`);
      console.log(`   Total cost: ${formatEther(estimate.totalCost)} ETH`);
      console.log(`   Transactions: ${estimate.totalTransactions}`);
    });
  });

  describe("3. Generate Manifest (Standalone Ethers)", function () {
    it("should generate manifest without site address (planning mode)", async function () {
      const manifest = await ethersStandalone.generateManifestStandalone(
        testDir,
        "/test",
        {
          gasLimit: 300,
          fileLimit: 50
        }
      );

      expect(manifest).to.not.be.undefined;
      expect(manifest.siteData).to.not.be.undefined;
      expect(manifest.siteData.files).to.be.an("array");
      expect(manifest.siteData.files.length).to.be.greaterThan(0);
      
      const testFileEntry = manifest.siteData.files.find((f: any) => f.path.includes("test.html"));
      expect(testFileEntry).to.not.be.undefined;
      expect(testFileEntry.chunks).to.be.an("array");
      expect(testFileEntry.chunks.length).to.be.greaterThan(0);
      expect(testFileEntry.chunks[0].address).to.match(/^0x[a-fA-F0-9]{64}$/); // 32 bytes

      console.log(`\n📋 Generated Manifest (planning mode):`);
      console.log(`   Files: ${manifest.siteData.files.length}`);
      console.log(`   Chunks: ${manifest.siteData.files.reduce((sum: number, f: any) => sum + f.chunks.length, 0)}`);
    });

    it("should generate manifest with site address (estimation mode)", async function () {
      // Ensure wttpSiteAddress is set
      if (!wttpSiteAddress) {
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
      }
      
      const manifest = await ethersStandalone.generateManifestStandalone(
        testDir,
        "/test",
        {
          gasLimit: 300,
          fileLimit: 50
        },
        undefined,
        {
          provider,
          wttpSiteAddress
        }
      );

      expect(manifest).to.not.be.undefined;
      expect(manifest.chainData).to.not.be.undefined;
      expect(manifest.chainData?.contractAddress).to.equal(wttpSiteAddress);
      
      const testFileEntry = manifest.siteData.files.find((f: any) => f.path.includes("test.html"));
      expect(testFileEntry).to.not.be.undefined;
      
      // In estimation mode, chunks should have estimates
      if (testFileEntry.chunks && testFileEntry.chunks.length > 0) {
        const firstChunk = testFileEntry.chunks[0];
        // Estimates may or may not be present depending on whether royalties are 0
        if (firstChunk.estimate !== undefined) {
          expect(firstChunk.estimate).to.be.a("number");
        }
      }

      console.log(`\n📋 Generated Manifest (estimation mode):`);
      console.log(`   Contract: ${manifest.chainData?.contractAddress}`);
      console.log(`   Chain ID: ${manifest.chainData?.chainId}`);
    });
  });

  describe("4. Upload File (Standalone Ethers)", function () {
    it("should upload a file using standalone ethers", async function () {
      // Ensure wttpSiteAddress is set from deployment test
      if (!wttpSiteAddress) {
        // Deploy a site if not already deployed
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
      }
      const result = await ethersStandalone.uploadFile(
        wttpSiteAddress,
        testFile,
        "/test.html",
        {
          provider,
          signer: ownerWallet // Use owner wallet which has DEFAULT_ADMIN_ROLE
        }
      );

      expect(result).to.not.be.undefined;
      expect(result.response).to.not.be.undefined;
      expect(result.response.head.status).to.equal(200n);
      
      // uploadFile returns fetchResult which includes content if fetched
      // Content may be undefined if it wasn't fetched (HEAD request)
      if (result.content) {
        const contentString = Buffer.from(result.content).toString("utf-8");
        expect(contentString).to.equal(testContent);
        console.log(`\n✅ File uploaded successfully:`);
        console.log(`   Path: /test.html`);
        console.log(`   Status: ${result.response.head.status}`);
        console.log(`   Size: ${result.content.length} bytes`);
      } else {
        // If content wasn't returned, verify the upload by fetching it
        const fetchResult = await ethersStandalone.fetchResource(
          provider,
          wttpSiteAddress,
          "/test.html"
        );
        expect(fetchResult.response.head.status).to.equal(200n);
        expect(fetchResult.content).to.not.be.undefined;
        const contentString = Buffer.from(fetchResult.content!).toString("utf-8");
        expect(contentString).to.equal(testContent);
        console.log(`\n✅ File uploaded and verified successfully:`);
        console.log(`   Path: /test.html`);
        console.log(`   Status: ${fetchResult.response.head.status}`);
        console.log(`   Size: ${fetchResult.content!.length} bytes`);
      }
    });
  });

  describe("5. Upload Directory (Standalone Ethers)", function () {
    // Note: This test is skipped due to nonce management issues with rapid transactions
    // The uploadDirectory function sends multiple transactions quickly, and Hardhat's
    // automining can't keep up, causing nonce conflicts. In production, transactions
    // should be properly sequenced or use manual nonce management.
    it("should upload a directory using standalone ethers", async function () {
      // Ensure wttpSiteAddress is set
      if (!wttpSiteAddress) {
        // Deploy a site if not already deployed
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
      }
      
      // Create a subdirectory with another file
      const subDir = path.join(testDir, "subdir");
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
      const subFile = path.join(subDir, "sub.html");
      fs.writeFileSync(subFile, "<html><body>Sub Content</body></html>");

      // Add a longer delay to avoid nonce issues with directory uploads
      await new Promise(resolve => setTimeout(resolve, 2000));

      await ethersStandalone.uploadDirectory(
        wttpSiteAddress,
        testDir,
        "/test-dir",
        {
          provider,
          signer: ownerWallet // Use owner wallet which has DEFAULT_ADMIN_ROLE
        }
      );

      console.log(`\n✅ Directory uploaded successfully`);
      
      // Add delay before fetching
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify files were uploaded by fetching them
      const mainFile = await ethersStandalone.fetchResource(
        provider,
        wttpSiteAddress,
        "/test-dir/test.html"
      );
      expect(mainFile.response.head.status).to.equal(200n);

      const subFileResult = await ethersStandalone.fetchResource(
        provider,
        wttpSiteAddress,
        "/test-dir/subdir/sub.html"
      );
      expect(subFileResult.response.head.status).to.equal(200n);
    });
  });

  describe("6. Fetch Resource (Standalone Ethers)", function () {
    it("should fetch resource using HEAD request", async function () {
      // Ensure wttpSiteAddress is set and file was uploaded
      if (!wttpSiteAddress) {
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
        
        // Upload the file first
        await ethersStandalone.uploadFile(
          wttpSiteAddress,
          testFile,
          "/test.html",
          { provider, signer: ownerWallet } // Use owner wallet which has DEFAULT_ADMIN_ROLE
        );
      }
      
      const result = await ethersStandalone.fetchResource(
        provider,
        wttpSiteAddress,
        "/test.html",
        { headRequest: true }
      );

      expect(result).to.not.be.undefined;
      expect(result.response.head.status).to.equal(200n);
      expect(result.response.head.metadata).to.not.be.undefined;
      expect(result.content).to.be.undefined; // HEAD should not return content

      console.log(`\n✅ HEAD request successful:`);
      console.log(`   Status: ${result.response.head.status}`);
      console.log(`   MIME type: ${result.response.head.metadata.properties.mimeType}`);
      console.log(`   Size: ${result.response.head.metadata.size.toString()} bytes`);
    });

    it("should fetch resource with full content using GET", async function () {
      // Ensure wttpSiteAddress is set and file was uploaded
      if (!wttpSiteAddress) {
        const deployResult = await ethersStandalone.deployWeb3Site({
          provider,
          signer,
          ownerAddress: ownerWallet.address,
          dprAddress,
          defaultHeader: DEFAULT_HEADER
        });
        wttpSiteAddress = deployResult.address;
        
        // Upload the file first
        await ethersStandalone.uploadFile(
          wttpSiteAddress,
          testFile,
          "/test.html",
          { provider, signer: ownerWallet } // Use owner wallet which has DEFAULT_ADMIN_ROLE
        );
      }
      
      const result = await ethersStandalone.fetchResource(
        provider,
        wttpSiteAddress,
        "/test.html",
        { datapoints: false } // Ensure we fetch content, not just datapoints
      );

      expect(result).to.not.be.undefined;
      expect(result.response.head.status).to.equal(200n);
      expect(result.content).to.not.be.undefined;
      
      // Content is returned as Uint8Array, convert to string
      const contentString = Buffer.from(result.content!).toString("utf-8");
      expect(contentString).to.equal(testContent);

      console.log(`\n✅ GET request successful:`);
      console.log(`   Status: ${result.response.head.status}`);
      console.log(`   Content length: ${result.content!.length} bytes`);
    });

    it("should return 404 for non-existent resource", async function () {
      const result = await ethersStandalone.fetchResource(
        provider,
        wttpSiteAddress,
        "/nonexistent.html"
      );
      
      // fetchResource doesn't throw on 404, it returns status 404
      expect(result.response.head.status).to.equal(404n);
      expect(result.content).to.be.undefined;
      console.log(`\n✅ 404 handling works correctly`);
    });
  });

  describe("7. End-to-End Workflow", function () {
    it("should complete full workflow: deploy -> estimate -> upload -> fetch", async function () {
      // 1. Deploy a new site
      const deployResult = await ethersStandalone.deployWeb3Site({
        provider,
        signer,
        ownerAddress: ownerWallet.address,
        dprAddress,
        defaultHeader: DEFAULT_HEADER
      });
      const newSiteAddress = deployResult.address;
      console.log(`\n1️⃣ Deployed new site: ${newSiteAddress}`);

      // 2. Estimate upload
      const estimate = await ethersStandalone.estimateFile(
        newSiteAddress,
        testFile,
        "/workflow-test.html",
        { provider }
      );
      console.log(`2️⃣ Estimated upload: ${estimate.transactionCount} transactions, ${formatEther(estimate.totalCost)} ETH`);

      // 3. Upload file
      const uploadResult = await ethersStandalone.uploadFile(
        newSiteAddress,
        testFile,
        "/workflow-test.html",
        { provider, signer: ownerWallet } // Use owner wallet which has DEFAULT_ADMIN_ROLE
      );
      expect(uploadResult.response.head.status).to.equal(200n);
      console.log(`3️⃣ Uploaded file successfully`);

      // 4. Fetch resource
      const fetchResult = await ethersStandalone.fetchResource(
        provider,
        newSiteAddress,
        "/workflow-test.html",
        { datapoints: false } // Ensure we fetch content
      );
      expect(fetchResult.response.head.status).to.equal(200n);
      expect(fetchResult.content).to.not.be.undefined;
      const fetchedContent = Buffer.from(fetchResult.content!).toString("utf-8");
      expect(fetchedContent).to.equal(testContent);
      console.log(`4️⃣ Fetched resource successfully`);

      console.log(`\n✅ End-to-end workflow completed successfully!`);
    });
  });
});

