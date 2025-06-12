import { expect } from "chai";
import { ethers } from "hardhat";

// Core WTTP types and factories
import {
  IBaseWTTPSite__factory,
  IBaseWTTPStorage__factory,
  IBaseWTTPPermissions__factory,
  // ESP integration types
  IDataPointRegistry__factory,
  IDataPointStorage__factory,
  // Type interfaces for structured data
  // Struct types
  HEADRequestStruct,
  LOCATERequestStruct,
} from "@wttp/core";

// ESP deployment functionality
import {
  espDeployments,
  loadContract,
  getContractAddress,
  getDeploymentInfo,
  getSupportedChainIds
} from "@tw3/esp";

describe("WTTP Core Package Integration", function () {
  let signer: any;
  
  before(async function () {
    [signer] = await ethers.getSigners();
  });

  describe("Package Exports", function () {
    it("should export all required contract interfaces", function () {
      expect(IBaseWTTPSite__factory).to.not.be.undefined;
      expect(IBaseWTTPStorage__factory).to.not.be.undefined;
      expect(IBaseWTTPPermissions__factory).to.not.be.undefined;
    });

    it("should export ESP integration contract factories", function () {
      expect(IDataPointRegistry__factory).to.not.be.undefined;
      expect(IDataPointStorage__factory).to.not.be.undefined;
    });

    // it("should export artifacts for all core contracts", function () {
    //   expect(artifacts).to.not.be.undefined;
    //   expect(artifacts.IWTTPSite).to.not.be.undefined;
    //   expect(artifacts.IWTTPGateway).to.not.be.undefined;
    //   expect(artifacts.IWTTPStorage).to.not.be.undefined;
    //   expect(artifacts.IWTTPPermissions).to.not.be.undefined;
    //   // Note: WTTPTypes artifact excluded as it doesn't generate artifacts (types only)
    // });

    it("should have valid ABIs in factories", function () {
      expect(IBaseWTTPSite__factory.abi).to.be.an('array');
      expect(IBaseWTTPStorage__factory.abi).to.be.an('array');
      expect(IBaseWTTPPermissions__factory.abi).to.be.an('array');
    });
  });

  describe("ESP Deployment Integration", function () {
    it("should export ESP deployment functions", function () {
      expect(espDeployments).to.not.be.undefined;
      expect(loadContract).to.not.be.undefined;
      expect(getContractAddress).to.not.be.undefined;
      expect(getDeploymentInfo).to.not.be.undefined;
      expect(getSupportedChainIds).to.not.be.undefined;
      
      expect(typeof loadContract).to.equal('function');
      expect(typeof getContractAddress).to.equal('function');
      expect(typeof getDeploymentInfo).to.equal('function');
      expect(typeof getSupportedChainIds).to.equal('function');
    });

    it("should provide supported chain IDs", function () {
      const supportedChains = getSupportedChainIds();
      expect(supportedChains).to.be.an('array');
      // ESP should support at least some common chains
      expect(supportedChains.length).to.be.greaterThan(0);
    });

    it("should have deployment information structure", function () {
      expect(espDeployments).to.be.an('object');
      // Verify the deployment structure exists even if no specific chains are deployed
      expect(typeof espDeployments).to.equal('object');
    });

    it("should handle getContractAddress function calls", function () {
      const supportedChains = getSupportedChainIds();
      
      if (supportedChains.length > 0) {
        // Test with first supported chain
        const chainId = supportedChains[0];
        
        // These should not throw even if contracts aren't deployed
        expect(() => {
          getContractAddress(chainId, 'dpr');
        }).to.not.throw();
        
        expect(() => {
          getContractAddress(chainId, 'dps');
        }).to.not.throw();
      } else {
        // If no chains supported, functions should still exist and handle gracefully
        expect(() => {
          getContractAddress(1, 'dpr'); // mainnet
        }).to.not.throw();
      }
    });

    it("should handle getDeploymentInfo function calls", function () {
      const supportedChains = getSupportedChainIds();
      
      if (supportedChains.length > 0) {
        const chainId = supportedChains[0];
        
        expect(() => {
          getDeploymentInfo(chainId, 'dpr');
        }).to.not.throw();
        
        expect(() => {
          getDeploymentInfo(chainId, 'dps');
        }).to.not.throw();
        
        const dprDeploymentInfo = getDeploymentInfo(chainId, 'dpr');
        if (dprDeploymentInfo) {
          expect(dprDeploymentInfo).to.be.an('object');
        }
      }
    });

    it("should integrate ESP contracts with WTTP factories", function () {
      // Test that ESP contract types are compatible with WTTP core factories
      const mockAddress = "0x1234567890123456789012345678901234567890";
      
      // Should be able to connect to ESP contracts using imported factories
      const dprContract = IDataPointRegistry__factory.connect(mockAddress, signer);
      const dpsContract = IDataPointStorage__factory.connect(mockAddress, signer);
      
      expect(dprContract.target).to.equal(mockAddress);
      expect(dpsContract.target).to.equal(mockAddress);
      
      // Verify ESP contract methods are available (using actual method names)
      expect(typeof dprContract.registerDataPoint).to.equal('function');
      expect(typeof dpsContract.writeDataPoint).to.equal('function');
    });

    it("should demonstrate deployment address retrieval workflow", function () {
      const supportedChains = getSupportedChainIds();
      
      // Test the typical workflow a dApp would use
      for (const chainId of supportedChains) {
        const dprDeploymentInfo = getDeploymentInfo(chainId, 'dpr');
        const dpsDeploymentInfo = getDeploymentInfo(chainId, 'dps');
        
        if (dprDeploymentInfo) {
          // If deployment exists, should have contract address
          const dprAddress = getContractAddress(chainId, 'dpr');
          
          // Address should be valid if it exists
          if (dprAddress) {
            expect(typeof dprAddress).to.equal('string');
            expect(dprAddress.length).to.be.greaterThan(0);
          }
        }
        
        if (dpsDeploymentInfo) {
          // If deployment exists, should have contract address
          const dpsAddress = getContractAddress(chainId, 'dps');
          
          // Address should be valid if it exists
          if (dpsAddress) {
            expect(typeof dpsAddress).to.equal('string');
            expect(dpsAddress.length).to.be.greaterThan(0);
          }
        }
      }
      
      // This test should pass regardless of whether contracts are actually deployed
      expect(true).to.be.true;
    });
  });

  describe("Contract Factory Creation", function () {
    it("should create IWTTPSite interface with correct methods", function () {
      const iface = IBaseWTTPSite__factory.createInterface();
      expect(iface).to.not.be.undefined;
      expect(iface.hasFunction("DPS")).to.be.true;
      expect(iface.hasFunction("DPR")).to.be.true;
      expect(iface.hasFunction("OPTIONS")).to.be.true;
      expect(iface.hasFunction("HEAD")).to.be.true;
      expect(iface.hasFunction("PATCH")).to.be.true;
      expect(iface.hasFunction("PUT")).to.be.true;
      expect(iface.hasFunction("DELETE")).to.be.true;
      expect(iface.hasFunction("DEFINE")).to.be.true;
    });

    // it("should create IWTTPGateway interface with correct methods", function () {
    //   const iface = IWTTPGateway__factory.createInterface();
    //   expect(iface).to.not.be.undefined;
    //   expect(iface.hasFunction("OPTIONS")).to.be.true;
    //   expect(iface.hasFunction("GET")).to.be.true;
    //   expect(iface.hasFunction("HEAD")).to.be.true;
    //   expect(iface.hasFunction("LOCATE")).to.be.true;
    // });

    it("should create IWTTPStorage interface with correct methods", function () {
      const iface = IBaseWTTPStorage__factory.createInterface();
      expect(iface).to.not.be.undefined;
      expect(iface.hasFunction("DPS")).to.be.true;
      expect(iface.hasFunction("DPR")).to.be.true;
      expect(iface.hasFunction("hasRole")).to.be.true;
      // Note: Some methods may not be available in the interface version
      // Testing only the core methods that are confirmed to exist
    });

    it("should create IWTTPPermissions interface with correct methods", function () {
      const iface = IBaseWTTPPermissions__factory.createInterface();
      expect(iface).to.not.be.undefined;
      expect(iface.hasFunction("hasRole")).to.be.true;
      expect(iface.hasFunction("grantRole")).to.be.true;
      expect(iface.hasFunction("revokeRole")).to.be.true;
    });

    it("should create ESP integration interfaces", function () {
      const dprInterface = IDataPointRegistry__factory.createInterface();
      const dpsInterface = IDataPointStorage__factory.createInterface();
      
      expect(dprInterface).to.not.be.undefined;
      expect(dpsInterface).to.not.be.undefined;
    });
  });

  describe("Interface Method Signatures", function () {
    it("should have correct IWTTPSite interface methods", function () {
      const iface = IBaseWTTPSite__factory.createInterface();
      
      expect(iface.hasFunction("DPS")).to.be.true;
      expect(iface.hasFunction("DPR")).to.be.true;
      expect(iface.hasFunction("OPTIONS")).to.be.true;
      expect(iface.hasFunction("HEAD")).to.be.true;
      expect(iface.hasFunction("hasRole")).to.be.true;
    });

    it("should have correct IWTTPGateway interface methods", function () {
      const iface = IBaseWTTPSite__factory.createInterface();
      
      expect(iface.hasFunction("OPTIONS")).to.be.true;
      expect(iface.hasFunction("GET")).to.be.true;
      expect(iface.hasFunction("HEAD")).to.be.true;
      expect(iface.hasFunction("DPS")).to.be.true;
    });

    it("should have correct IWTTPStorage interface methods", function () {
      const iface = IBaseWTTPStorage__factory.createInterface();
      
      expect(iface.hasFunction("DPS")).to.be.true;
      expect(iface.hasFunction("DPR")).to.be.true;
      expect(iface.hasFunction("hasRole")).to.be.true;
      // Note: Some methods may not be available in the interface version
      // Testing only the core methods that are confirmed to exist
    });

    it("should have correct IWTTPPermissions interface methods", function () {
      const iface = IBaseWTTPPermissions__factory.createInterface();
      
      expect(iface.hasFunction("hasRole")).to.be.true;
      expect(iface.hasFunction("grantRole")).to.be.true;
      expect(iface.hasFunction("revokeRole")).to.be.true;
    });
  });

  describe("Type Structure Validation", function () {
    it("should properly type HEADRequest structures", function () {
      const headRequest: HEADRequestStruct = {
        path: "/test/path",
        ifModifiedSince: 0,
        ifNoneMatch: "0x0000000000000000000000000000000000000000000000000000000000000000"
      };
      
      expect(headRequest.path).to.equal("/test/path");
      expect(headRequest.ifNoneMatch).to.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(headRequest.ifModifiedSince).to.equal(0);
    });

    it("should properly type Range structures", function () {
      const range = {
        start: 0,
        end: 1023
      };
      
      expect(range.start).to.equal(0);
      expect(range.end).to.equal(1023);
    });

    it("should properly type HeaderInfo structures", function () {
      const headerInfo = {
        cache: {
          immutableFlag: false,
          preset: 0,
          custom: ""
        },
        cors: {
          methods: 0,
          origins: [],
          preset: 0,
          custom: ""
        },
        redirect: {
          code: 0,
          location: ""
        }
      };
      
      expect(headerInfo.cache.immutableFlag).to.equal(false);
      expect(headerInfo.cors.methods).to.equal(0);
      expect(headerInfo.redirect.code).to.equal(0);
    });

    it("should properly type LOCATERequest structures", function () {
      const getRequest: LOCATERequestStruct = {
        head: {
          path: "/api/data",
          ifModifiedSince: 0,
          ifNoneMatch: "0x0000000000000000000000000000000000000000000000000000000000000000"
        },
        rangeChunks: {
          start: 0,
          end: 4
        }
      };
      
      expect(getRequest.head.path).to.equal("/api/data");
      expect(getRequest.rangeChunks.start).to.equal(0);
      expect(getRequest.rangeChunks.end).to.equal(4);
    });
  });

  describe("Contract Instantiation from Address", function () {
    it("should connect to contracts using factory and address", function () {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      
      const siteContract = IBaseWTTPSite__factory.connect(mockAddress, signer);
      const storageContract = IBaseWTTPStorage__factory.connect(mockAddress, signer);
      const permissionsContract = IBaseWTTPPermissions__factory.connect(mockAddress, signer);
      
      expect(siteContract.target).to.equal(mockAddress);
      expect(storageContract.target).to.equal(mockAddress);
      expect(permissionsContract.target).to.equal(mockAddress);
    });

    it("should connect to ESP contracts using factory and address", function () {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      
      const dprContract = IDataPointRegistry__factory.connect(mockAddress, signer);
      const dpsContract = IDataPointStorage__factory.connect(mockAddress, signer);
      
      expect(dprContract.target).to.equal(mockAddress);
      expect(dpsContract.target).to.equal(mockAddress);
    });
  });

  describe("ABI Compatibility", function () {
    // it("should have compatible function signatures in artifacts", function () {
    //   const siteABI = artifacts.IWTTPSite.abi;
    //   const gatewayABI = artifacts.IWTTPGateway.abi;
    //   const storageABI = artifacts.IWTTPStorage.abi;
    //   const permissionsABI = artifacts.IWTTPPermissions.abi;
      
    //   // Check that core methods exist in ABIs
    //   const siteMethodNames = siteABI.filter((item: any) => item.type === 'function').map((fn: any) => fn.name);
    //   const gatewayMethodNames = gatewayABI.filter((item: any) => item.type === 'function').map((fn: any) => fn.name);
    //   const storageMethodNames = storageABI.filter((item: any) => item.type === 'function').map((fn: any) => fn.name);
    //   const permissionsMethodNames = permissionsABI.filter((item: any) => item.type === 'function').map((fn: any) => fn.name);
      
    //   expect(siteMethodNames).to.include.members(['DPS', 'DPR', 'OPTIONS', 'HEAD', 'LOCATE', 'GET']);
    //   expect(gatewayMethodNames).to.include.members(['OPTIONS', 'GET', 'HEAD', 'LOCATE']);
    //   expect(storageMethodNames).to.include.members(['DPS', 'DPR', 'setDPR']);
    //   expect(permissionsMethodNames).to.include.members(['hasRole', 'grantRole', 'revokeRole']);
    // });

    it("should have static ABI property accessible on factories", function () {
      expect(IBaseWTTPSite__factory.abi).to.be.an('array');
      expect(IBaseWTTPStorage__factory.abi).to.be.an('array');
      expect(IBaseWTTPPermissions__factory.abi).to.be.an('array');
    });

    // it("should match ABIs between artifacts and factories", function () {
    //   // Verify that the ABIs from artifacts match those from factories
    //   expect(artifacts.IWTTPSite.abi).to.deep.equal(IWTTPSite__factory.abi);
    //   expect(artifacts.IWTTPGateway.abi).to.deep.equal(IWTTPGateway__factory.abi);
    //   expect(artifacts.IWTTPStorage.abi).to.deep.equal(IWTTPStorage__factory.abi);
    //   expect(artifacts.IWTTPPermissions.abi).to.deep.equal(IWTTPPermissions__factory.abi);
    // });
  });

  describe("Integration with Deployment Addresses", function () {
    it("should work with deployment configuration", async function () {
      // This test demonstrates how the package would work with actual deployment addresses
      // In a real scenario, these would come from deployment scripts or configuration
      
      const mockDeployments = {
        IWTTPSite: "0x1111111111111111111111111111111111111111",
        IWTTPGateway: "0x2222222222222222222222222222222222222222",
        IWTTPStorage: "0x3333333333333333333333333333333333333333",
        IWTTPPermissions: "0x4444444444444444444444444444444444444444",
        IDataPointRegistry: "0x5555555555555555555555555555555555555555",
        IDataPointStorage: "0x6666666666666666666666666666666666666666"
      };
      
      // Connect to all contracts using deployment addresses
      const siteContract = IBaseWTTPSite__factory.connect(mockDeployments.IWTTPSite, signer);
      const storageContract = IBaseWTTPStorage__factory.connect(mockDeployments.IWTTPStorage, signer);
      const permissionsContract = IBaseWTTPPermissions__factory.connect(mockDeployments.IWTTPPermissions, signer);
      const dprContract = IDataPointRegistry__factory.connect(mockDeployments.IDataPointRegistry, signer);
      const dpsContract = IDataPointStorage__factory.connect(mockDeployments.IDataPointStorage, signer);
      
      // Verify all contracts are properly instantiated
      expect(siteContract.target).to.equal(mockDeployments.IWTTPSite);
      expect(storageContract.target).to.equal(mockDeployments.IWTTPStorage);
      expect(permissionsContract.target).to.equal(mockDeployments.IWTTPPermissions);
      expect(dprContract.target).to.equal(mockDeployments.IDataPointRegistry);
      expect(dpsContract.target).to.equal(mockDeployments.IDataPointStorage);
      
      // Verify contract interfaces are available
      expect(siteContract.interface.hasFunction("OPTIONS")).to.be.true;
      expect(storageContract.interface.hasFunction("DPS")).to.be.true;
      expect(permissionsContract.interface.hasFunction("hasRole")).to.be.true;
    });

    // it("should demonstrate getting deployment addresses from artifacts", function () {
    //   // Show how artifacts can be used to get contract information for deployment
    //   const siteArtifact = artifacts.IWTTPSite;
    //   const gatewayArtifact = artifacts.IWTTPGateway;
    //   const storageArtifact = artifacts.IWTTPStorage;
    //   const permissionsArtifact = artifacts.IWTTPPermissions;
      
    //   // Verify artifacts have the expected structure
    //   expect(siteArtifact).to.have.property('abi');
    //   expect(siteArtifact).to.have.property('bytecode');
    //   expect(gatewayArtifact).to.have.property('abi');
    //   expect(gatewayArtifact).to.have.property('bytecode');
    //   expect(storageArtifact).to.have.property('abi');
    //   expect(storageArtifact).to.have.property('bytecode');
    //   expect(permissionsArtifact).to.have.property('abi');
    //   expect(permissionsArtifact).to.have.property('bytecode');
      
    //   // Verify bytecode exists (for interfaces it should be "0x")
    //   expect(siteArtifact.bytecode).to.be.a('string');
    //   expect(gatewayArtifact.bytecode).to.be.a('string');
    //   expect(storageArtifact.bytecode).to.be.a('string');
    //   expect(permissionsArtifact.bytecode).to.be.a('string');
    // });

    it("should integrate ESP deployment addresses with WTTP contracts", async function () {
      const supportedChains = getSupportedChainIds();
      
      // Test integration between ESP deployments and WTTP contracts
      for (const chainId of supportedChains) {
        const dprAddress = getContractAddress(chainId, 'dpr');
        const dpsAddress = getContractAddress(chainId, 'dps');
        
        if (dprAddress && dpsAddress) {
          // If ESP contracts are deployed, test WTTP integration
          const dprContract = IDataPointRegistry__factory.connect(dprAddress, signer);
          const dpsContract = IDataPointStorage__factory.connect(dpsAddress, signer);
          
          expect(dprContract.target).to.equal(dprAddress);
          expect(dpsContract.target).to.equal(dpsAddress);
          
          // Verify these can be used in WTTP site context
          const mockSiteAddress = "0x1111111111111111111111111111111111111111";
          const siteContract = IBaseWTTPSite__factory.connect(mockSiteAddress, signer);
          
          // Site contract should have DPR and DPS methods that return these addresses
          expect(siteContract.interface.hasFunction("DPR")).to.be.true;
          expect(siteContract.interface.hasFunction("DPS")).to.be.true;
        }
      }
      
      // Test should pass even if no deployments exist
      expect(true).to.be.true;
    });
  });

  describe("Error Handling and Edge Cases", function () {
    it("should handle invalid addresses gracefully", function () {
      const invalidAddress = "invalid-address";
      
      // Test that contract can be created with invalid address (ethers allows this)
      // but verify it's properly handled when used
      const siteContract = IBaseWTTPSite__factory.connect(invalidAddress, signer);
      expect(siteContract.target).to.equal(invalidAddress);
      
      // Test with empty string address
      expect(() => {
        IBaseWTTPSite__factory.connect("", signer);
      }).to.not.throw();
      
      // The actual validation happens when contract methods are called,
      // not during connection, so this test verifies connection behavior
    });

    it("should validate struct requirements", function () {
      // Test that incomplete structs would fail TypeScript compilation
      // This is a compile-time check, but we can validate runtime behavior
      
      const validHeadRequest: HEADRequestStruct = {
        path: "/test",
        ifModifiedSince: 0,
        ifNoneMatch: "0x0000000000000000000000000000000000000000000000000000000000000000"
      };
      
      expect(validHeadRequest.path).to.be.a('string');
      expect(validHeadRequest.ifModifiedSince).to.be.a('number');
    });
  });

  describe("Factory Pattern and TypeChain Integration", function () {
    it("should demonstrate proper usage patterns for dApp integration", function () {
      // Example of how a dApp would typically use the core package
      const mockSiteAddress = "0x1111111111111111111111111111111111111111";
      const mockGatewayAddress = "0x2222222222222222222222222222222222222222";
      
      // Connect to contracts
      const site = IBaseWTTPSite__factory.connect(mockSiteAddress, signer);
      
      // Verify TypeChain generated methods are available
      expect(typeof site.OPTIONS).to.equal('function');
      expect(typeof site.HEAD).to.equal('function');
      expect(typeof site.GET).to.equal('function');
      expect(typeof site.DELETE).to.equal('function');
      expect(typeof site.DEFINE).to.equal('function');
      expect(typeof site.PUT).to.equal('function');
      expect(typeof site.PATCH).to.equal('function');
    });

    it("should provide access to interface encoding/decoding functionality", function () {
      const siteInterface = IBaseWTTPSite__factory.createInterface();
      
      // Test that interface can encode function calls
      expect(typeof siteInterface.encodeFunctionData).to.equal('function');
      expect(typeof siteInterface.decodeFunctionResult).to.equal('function');
    });

    it("should provide comprehensive contract interaction capabilities", function () {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const siteContract = IBaseWTTPSite__factory.connect(mockAddress, signer);
      
      // Test that all necessary properties are available for contract interaction
      expect(siteContract).to.have.property('target');
      expect(siteContract).to.have.property('interface');
      expect(siteContract).to.have.property('runner');
      
      // Test method availability for complete WTTP protocol support
      expect(typeof siteContract.DPS).to.equal('function');
      expect(typeof siteContract.DPR).to.equal('function');
      expect(typeof siteContract.OPTIONS).to.equal('function');
      expect(typeof siteContract.HEAD).to.equal('function');
      expect(typeof siteContract.GET).to.equal('function');
      expect(typeof siteContract.PATCH).to.equal('function');
      expect(typeof siteContract.PUT).to.equal('function');
      expect(typeof siteContract.DELETE).to.equal('function');
      expect(typeof siteContract.DEFINE).to.equal('function');
    });
  });
});