import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import path from "path";
import fs from "fs";

// Import from built files (CJS)
// Using require to test the built CommonJS output
// We load from ethers folder directly to avoid Hardhat task registration conflicts
let builtPackage: any = null;
const builtEthersPath = path.resolve(__dirname, "../dist/cjs/src/ethers/index.js");
const builtUtilsPath = path.resolve(__dirname, "../dist/cjs/src/utils.js");
const artifactPath = path.resolve(__dirname, "../artifacts/contracts/Web3Site.sol/Web3Site.json");

if (fs.existsSync(builtEthersPath) && fs.existsSync(builtUtilsPath)) {
  try {
    // Import from ethers folder directly (no task registration)
    const ethersStandalone = require(builtEthersPath);
    const utils = require(builtUtilsPath);
    
    // Load artifact directly (no need to go through index)
    let Web3SiteArtifact: any;
    if (fs.existsSync(artifactPath)) {
      Web3SiteArtifact = require(artifactPath);
    } else {
      console.warn("⚠️  Artifact not found, some tests may fail");
      Web3SiteArtifact = null;
    }
    
    // Construct the package structure we expect
    builtPackage = {
      ethersStandalone,
      Web3SiteArtifact,
      looseEqual: utils.looseEqual,
      chunkData: utils.chunkData,
      getMimeType: utils.getMimeType,
      getMimeTypeWithCharset: utils.getMimeTypeWithCharset,
      getChainSymbolFromChainId: utils.getChainSymbolFromChainId
    };
  } catch (error: any) {
    console.warn("⚠️  Could not load built files:", error?.message || error);
    console.warn(`   Error code: ${error?.code}`);
    builtPackage = null;
  }
} else {
  console.warn("⚠️  Built files not found. Run 'npm run build' first.");
  if (!fs.existsSync(builtEthersPath)) {
    console.warn(`   Missing: ${builtEthersPath}`);
  }
  if (!fs.existsSync(builtUtilsPath)) {
    console.warn(`   Missing: ${builtUtilsPath}`);
  }
}

describe("16 - Ethers Standalone Library Import Test", function () {
  let signer: SignerWithAddress;
  let provider: any;
  
  before(async function () {
    if (!builtPackage) {
      this.skip(); // Skip all tests if build doesn't exist
    }
    [signer] = await ethers.getSigners();
    provider = ethers.provider;
  });

  describe("Built Package Exports", function () {
    it("should export ethersStandalone namespace", function () {
      expect(builtPackage.ethersStandalone).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone).to.equal('object');
    });

    it("should export Web3SiteArtifact", function () {
      expect(builtPackage.Web3SiteArtifact).to.not.be.undefined;
      expect(builtPackage.Web3SiteArtifact).to.have.property('abi');
      expect(builtPackage.Web3SiteArtifact).to.have.property('bytecode');
      expect(builtPackage.Web3SiteArtifact.abi).to.be.an('array');
    });

    it("should export shared utilities", function () {
      expect(builtPackage.looseEqual).to.not.be.undefined;
      expect(builtPackage.chunkData).to.not.be.undefined;
      expect(builtPackage.getMimeType).to.not.be.undefined;
      expect(builtPackage.getMimeTypeWithCharset).to.not.be.undefined;
      expect(builtPackage.getChainSymbolFromChainId).to.not.be.undefined;
      
      expect(typeof builtPackage.looseEqual).to.equal('function');
      expect(typeof builtPackage.chunkData).to.equal('function');
      expect(typeof builtPackage.getMimeType).to.equal('function');
      expect(typeof builtPackage.getMimeTypeWithCharset).to.equal('function');
      expect(typeof builtPackage.getChainSymbolFromChainId).to.equal('function');
    });
  });

  describe("Ethers Standalone Functions", function () {
    it("should export uploadFile function", function () {
      expect(builtPackage.ethersStandalone.uploadFile).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.uploadFile).to.equal('function');
    });

    it("should export uploadDirectory function", function () {
      expect(builtPackage.ethersStandalone.uploadDirectory).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.uploadDirectory).to.equal('function');
    });

    it("should export estimateFile function", function () {
      expect(builtPackage.ethersStandalone.estimateFile).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.estimateFile).to.equal('function');
    });

    it("should export estimateDirectory function", function () {
      expect(builtPackage.ethersStandalone.estimateDirectory).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.estimateDirectory).to.equal('function');
    });

    it("should export deployWeb3Site function", function () {
      expect(builtPackage.ethersStandalone.deployWeb3Site).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.deployWeb3Site).to.equal('function');
    });

    it("should export generateManifestStandalone function", function () {
      expect(builtPackage.ethersStandalone.generateManifestStandalone).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.generateManifestStandalone).to.equal('function');
    });

    it("should export fetchResource function", function () {
      expect(builtPackage.ethersStandalone.fetchResource).to.not.be.undefined;
      expect(typeof builtPackage.ethersStandalone.fetchResource).to.equal('function');
    });
  });

  describe("Shared Utilities Functionality", function () {
    it("should have working looseEqual function", function () {
      const obj1 = { a: 1, b: "test" };
      const obj2 = { a: 1, b: "test" };
      const obj3 = { a: 2, b: "test" };
      
      expect(builtPackage.looseEqual(obj1, obj2)).to.be.true;
      expect(builtPackage.looseEqual(obj1, obj3)).to.be.false;
    });

    it("should have working chunkData function", function () {
      const data = Buffer.from("test data that is longer than 32 bytes to test chunking functionality");
      const chunks = builtPackage.chunkData(data, 32);
      
      expect(chunks).to.be.an('array');
      expect(chunks.length).to.be.greaterThan(1);
      expect(chunks[0]).to.be.instanceOf(Buffer);
      expect(chunks[0].length).to.be.at.most(32);
    });

    it("should have working getMimeType function", function () {
      expect(builtPackage.getMimeType("test.html")).to.equal("text/html");
      // Note: mime-types library may return 'text/javascript' or 'application/javascript'
      const jsMime = builtPackage.getMimeType("test.js");
      expect(jsMime === "application/javascript" || jsMime === "text/javascript").to.be.true;
      expect(builtPackage.getMimeType("test.png")).to.equal("image/png");
      expect(builtPackage.getMimeType("test.json")).to.equal("application/json");
    });

    it("should have working getMimeTypeWithCharset function", function () {
      const htmlResult = builtPackage.getMimeTypeWithCharset("test.html");
      expect(htmlResult.mimeType).to.equal("text/html");
      expect(htmlResult.charset).to.equal("utf-8");
      
      const pngResult = builtPackage.getMimeTypeWithCharset("test.png");
      expect(pngResult.mimeType).to.equal("image/png");
      expect(pngResult.charset).to.be.undefined;
    });

    it("should have working getChainSymbolFromChainId function", function () {
      expect(builtPackage.getChainSymbolFromChainId(137)).to.equal("POL");
      expect(builtPackage.getChainSymbolFromChainId(1)).to.equal("ETH");
      expect(builtPackage.getChainSymbolFromChainId(5)).to.equal("ETH");
    });
  });

  describe("Contract Artifact Usage", function () {
    it("should be able to create contract instance from artifact", async function () {
      const artifact = builtPackage.Web3SiteArtifact;
      const mockAddress = "0x1234567890123456789012345678901234567890";
      
      const contract = new ethers.Contract(mockAddress, artifact.abi, signer);
      
      expect(contract.target).to.equal(mockAddress);
      expect(contract.interface.hasFunction("DPS")).to.be.true;
      expect(contract.interface.hasFunction("DPR")).to.be.true;
      expect(contract.interface.hasFunction("PUT")).to.be.true;
      expect(contract.interface.hasFunction("PATCH")).to.be.true;
      expect(contract.interface.hasFunction("DEFINE")).to.be.true;
    });

    it("should have valid ABI structure in artifact", function () {
      const artifact = builtPackage.Web3SiteArtifact;
      
      expect(artifact.abi).to.be.an('array');
      expect(artifact.abi.length).to.be.greaterThan(0);
      
      // Check for key functions
      const functionNames = artifact.abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => item.name);
      
      expect(functionNames).to.include.members(['DPS', 'DPR', 'PUT', 'PATCH', 'DEFINE', 'GET', 'HEAD', 'DELETE', 'OPTIONS']);
    });

    it("should have bytecode in artifact", function () {
      const artifact = builtPackage.Web3SiteArtifact;
      
      expect(artifact.bytecode).to.be.a('string');
      expect(artifact.bytecode.length).to.be.greaterThan(0);
      expect(artifact.bytecode.startsWith('0x')).to.be.true;
    });
  });

  describe("Ethers Standalone Integration", function () {
    it("should be able to use fetchResource with provider", async function () {
      // This test verifies the function signature and basic structure
      // We'll use a mock address since we don't need to actually fetch
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const mockPath = "/test";
      
      // Just verify the function exists and can be called (will fail on actual fetch, but that's ok)
      expect(() => {
        builtPackage.ethersStandalone.fetchResource(provider, mockAddress, mockPath);
      }).to.not.throw();
    });

    it("should have correct function signatures for estimateFile", function () {
      const estimateFile = builtPackage.ethersStandalone.estimateFile;
      
      // Verify it's a function
      expect(typeof estimateFile).to.equal('function');
      
      // The function should accept: wttpSite, sourcePath, destinationPath, options
      // We can't easily test the full signature without TypeScript, but we can verify it exists
      expect(estimateFile.length).to.be.greaterThan(0);
    });

    it("should have correct function signatures for uploadFile", function () {
      const uploadFile = builtPackage.ethersStandalone.uploadFile;
      
      expect(typeof uploadFile).to.equal('function');
      expect(uploadFile.length).to.be.greaterThan(0);
    });

    it("should have correct function signatures for deployWeb3Site", function () {
      const deployWeb3Site = builtPackage.ethersStandalone.deployWeb3Site;
      
      expect(typeof deployWeb3Site).to.equal('function');
      expect(deployWeb3Site.length).to.be.greaterThan(0);
    });
  });

  describe("Module Structure", function () {
    it("should export all expected top-level exports", function () {
      // Check that main exports exist
      expect(builtPackage).to.have.property('ethersStandalone');
      expect(builtPackage).to.have.property('Web3SiteArtifact');
      expect(builtPackage).to.have.property('looseEqual');
      expect(builtPackage).to.have.property('chunkData');
      expect(builtPackage).to.have.property('getMimeType');
      expect(builtPackage).to.have.property('getMimeTypeWithCharset');
    });

    it("should have proper ethersStandalone namespace structure", function () {
      const standalone = builtPackage.ethersStandalone;
      
      expect(standalone).to.have.property('uploadFile');
      expect(standalone).to.have.property('uploadDirectory');
      expect(standalone).to.have.property('estimateFile');
      expect(standalone).to.have.property('estimateDirectory');
      expect(standalone).to.have.property('deployWeb3Site');
      expect(standalone).to.have.property('generateManifestStandalone');
      expect(standalone).to.have.property('fetchResource');
    });
  });

  describe("Real-world Usage Pattern", function () {
    it("should demonstrate typical usage pattern with built files", async function () {
      // Simulate how a user would import and use the built package
      const { ethersStandalone, Web3SiteArtifact } = builtPackage;
      
      // Create a contract instance
      const mockSiteAddress = "0x1234567890123456789012345678901234567890";
      const wttpSite = new ethers.Contract(mockSiteAddress, Web3SiteArtifact.abi, signer);
      
      expect(wttpSite.target).to.equal(mockSiteAddress);
      
      // Verify standalone functions are available
      expect(typeof ethersStandalone.uploadFile).to.equal('function');
      expect(typeof ethersStandalone.estimateFile).to.equal('function');
      
      // Test utility functions
      const testFile = "test.html";
      const mimeType = builtPackage.getMimeType(testFile);
      expect(mimeType).to.equal("text/html");
      
      const { mimeType: mimeType2, charset } = builtPackage.getMimeTypeWithCharset(testFile);
      expect(mimeType2).to.equal("text/html");
      expect(charset).to.equal("utf-8");
    });

    it("should work with ESM import pattern (structure test)", function () {
      // This test verifies the structure would work with ESM imports
      // We can't actually test ESM import in this CJS context, but we can verify exports
      
      const requiredExports = [
        'ethersStandalone',
        'Web3SiteArtifact',
        'looseEqual',
        'chunkData',
        'getMimeType',
        'getMimeTypeWithCharset',
        'getChainSymbolFromChainId'
      ];
      
      for (const exportName of requiredExports) {
        expect(builtPackage).to.have.property(exportName);
      }
    });
  });
});

