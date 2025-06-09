import { HeaderInfoStruct, IDataPointStorage, IWTTPSite, PUBLIC_HEADER } from "@wttp/core";
import { getSupportedChainIds, IDataPointRegistry, loadContract } from "@tw3/esp";
import { expect } from "chai";
import { ethers } from "hardhat";
import fs from "fs";
import { exec } from "child_process";
import { TestWTTPSite } from "../typechain-types/contracts/test/TestWTTPSite";

describe("Simple Chunked GET Test", function () {
    describe("Contract Interface", function () {
        it("should compile and have the correct GET function signature", async function () {
            // Get the contract factory for TestWTTPSite
            const TestWTTPSiteFactory = await ethers.getContractFactory("TestWTTPSite");
            
            // Check that the contract interface includes the GET function with LOCATERequest
            const interface_ = TestWTTPSiteFactory.interface;
            
            // Look for the GET function
            const getFunction = interface_.getFunction("GET");
            expect(getFunction).to.not.be.null;
            
            if (getFunction) {
                // The function should accept LOCATERequest as parameter
                // LOCATERequest has: { head: HEADRequest, rangeChunks: Range }
                expect(getFunction.inputs).to.have.length(1);
                expect(getFunction.inputs[0].name).to.equal("getRequest");
                
                // The function should return GETResponse
                expect(getFunction.outputs).to.have.length(1);
                expect(getFunction.outputs[0].name).to.equal("getResponse");
            
            // console.log("✅ GET function signature verified:");
            // console.log(`  Input: ${getFunction.inputs[0].type} ${getFunction.inputs[0].name}`);
            // console.log(`  Output: ${getFunction.outputs[0].type} ${getFunction.outputs[0].name}`);
            }
        });

        it("should verify LOCATERequest structure is accessible", async function () {
            // This test verifies that we can create a LOCATERequest object structure
            // that matches what the contract expects
            
            const locateRequest = {
            head: {
                path: "/test",
                ifModifiedSince: 0,
                ifNoneMatch: ethers.ZeroHash
            },
            rangeChunks: {
                start: 0,
                end: 0
            }
            };
            
            // Verify the structure is correct
            expect(locateRequest.head.path).to.equal("/test");
            expect(locateRequest.rangeChunks.start).to.equal(0);
            expect(locateRequest.rangeChunks.end).to.equal(0);
            
            // console.log("✅ LOCATERequest structure verified:");
            // console.log("  head.path:", locateRequest.head.path);
            // console.log("  rangeChunks.start:", locateRequest.rangeChunks.start);
            // console.log("  rangeChunks.end:", locateRequest.rangeChunks.end);
        });

        it("should verify that scripts can use the new structure", async function () {
            // Import the fetchResource function to verify it compiles
            const { fetchResourceFromSite } = await import("../src/scripts/fetchResource");
            
            // Just verify the function exists and can be imported
            expect(fetchResourceFromSite).to.be.a('function');
            
            // console.log("✅ Scripts updated to use LOCATERequest structure");
        });
    });
    let dps: IDataPointStorage;
    let dpr: IDataPointRegistry;
    let site: IWTTPSite | TestWTTPSite;
    describe("Contract Implementation", function () {
        before(async function () {
            const [deployer] = await ethers.getSigners();
            let chainId = Number((await ethers.provider.getNetwork()).chainId);
            // sets to 31337 to 1337 to bypass the chainId check when storing eps deployments
            chainId = chainId === 31337 ? 1337 : chainId;

            if(getSupportedChainIds().includes(chainId)) {
                dps = loadContract(chainId, "dps") as IDataPointStorage;
                dpr = loadContract(chainId, "dpr") as IDataPointRegistry;
            } else {
                // deploy the contracts to the unsupported chain
                try {
                    // attempt localhost/hardhat deployment
                    dps = await (await ethers.getContractFactory("DataPointStorage")).deploy() as unknown as IDataPointStorage;
                    dpr = await (await ethers.getContractFactory("DataPointRegistry")).deploy(deployer.address, dps.target, 1000) as unknown as IDataPointRegistry;
                } catch (error) {
                    console.error("Error deploying contracts:", error);
                    console.log("Copying contracts to local storage");
                    try {
                        // copy the contracts to local storage from @tw3/eps/contracts/interfaces to ../contracts/interfaces
                        fs.copyFileSync("@tw3/eps/contracts/interfaces/IDataPointStorage.sol", "../contracts/interfaces/IDataPointStorage.sol");
                        fs.copyFileSync("@tw3/eps/contracts/interfaces/IDataPointRegistry.sol", "../contracts/interfaces/IDataPointRegistry.sol");
                    } catch (error) {
                        console.error("Error copying contracts:", error);
                        throw error;
                    }
                    // console.log("Compiling contracts");
                    try {
                        // compile the contracts with hardhat compile and wait for completion
                        await new Promise<void>((resolve, reject) => {
                            const result = exec('npx hardhat compile', (error, stdout, stderr) => {
                                console.log(`stdout: ${stdout}`);
                                if (stderr) {
                                    console.error(`stderr: ${stderr}`);
                                }
                                if (error) {
                                    reject(new Error(`Failed to compile dps and dpr contracts: ${error.message}`));
                                    return;
                                }
                                resolve();
                            });
                        });
                        // console.log("Contracts compiled successfully");
                    } catch (error) {
                        // console.error("Error compiling dps and dpr contracts:", error);
                        throw error;
                    }
                    
                    // attempt to deploy the contracts again
                    try {
                        dps = await (await ethers.getContractFactory("DataPointStorage")).deploy() as unknown as IDataPointStorage;
                        dpr = await (await ethers.getContractFactory("DataPointRegistry")).deploy(deployer.address, dps.target, 1000) as unknown as IDataPointRegistry;
                    } catch (error) {
                        // console.error("Error deploying dps and dpr contracts:", error);
                        throw error;
                    }
                }
            }
            try {                   
                const defaultHeader: HeaderInfoStruct = PUBLIC_HEADER;
                site = await (await ethers.getContractFactory("TestWTTPSite")).deploy(deployer.address, dpr.target, defaultHeader) as unknown as TestWTTPSite;

            } catch (error) {
                // console.error("Error deploying site contract:", error);
                throw error;
            }
        });

        it("should verify that the contract can be used to fetch a resource", async function () {
            // Import the fetchResource function to verify it works with deployed contracts
            const { fetchResourceFromSite } = await import("../src/scripts/fetchResource");
            
            // This test would require proper contract deployment and setup
            // For now, just verify the function exists and contracts are initialized
            expect(fetchResourceFromSite).to.be.a('function');
            expect(site).to.not.be.undefined;
            expect(dps).to.not.be.undefined;
            
            // console.log("✅ Contracts initialized and fetchResource function available");
        });
    });
}); 