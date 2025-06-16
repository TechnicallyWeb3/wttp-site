import { 
    addLocalhostDeployment,
    removeLocalhostDeployment,
    getSupportedChainIds, 
    loadContract, 
    IDataPointRegistry, 
    IDataPointStorage 
} from "@tw3/esp";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import hre from "hardhat";

// Helper function to create unique data for each test to avoid royalty issues
export function createUniqueData(baseString: string = "Test Data"): string {
    return ethers.solidityPacked(
      ["string", "uint256", "uint256"], 
      [baseString, Date.now(), Math.floor(Math.random() * 1000000)]
    );
  }

  async function checkSupportedChainIds(chainId: number | null = null): Promise<boolean> {
    const supportedChainIds = getSupportedChainIds();
    const currentChainId = chainId ?? Number((await ethers.provider.getNetwork()).chainId);
    if (!supportedChainIds.includes(currentChainId)) {
      return false;
    }
    return true;
  }

  export async function copyEspContracts(force: boolean = false) {
    if (force) {
      deleteEspContracts();
    }

    // console.log("Copying ESP contracts to contracts/test/esp");
    const sourcePath = path.resolve("node_modules/@tw3/esp/contracts");
    const destPath = path.resolve("contracts/test/esp");
    
    // Create directories if they don't exist
    if (!fs.existsSync(destPath) || force) {
      // console.log(`Creating directory ${destPath}`);
      fs.mkdirSync(destPath, { recursive: true });
      
      // console.log(`Copying ESP contracts from ${sourcePath} to ${destPath}`);
      fs.cpSync(sourcePath, destPath, { recursive: true });
      
      // Verify the copy was successful
      const requiredFiles = ["DataPointStorage.sol", "DataPointRegistry.sol"];
      for (const file of requiredFiles) {
        const filePath = path.resolve(destPath, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Failed to copy required file: ${file}`);
        }
        // console.log(`✓ Verified ${file} exists`);
      }
      
      // console.log("✓ ESP contracts copied and verified successfully");
      
      // Small delay to ensure filesystem operations are complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      // console.log("ESP contracts already exist in contracts/test/esp");
      // console.log("ESP contracts path:", fs.realpathSync(destPath));
    }

  }

  export function deleteEspContracts() {
    // console.log("Deleting ESP contracts from contracts/test/esp");
    if (fs.existsSync("contracts/test/esp/interfaces")) {
      // console.log("Deleting directory contracts/test/esp/interfaces");
      fs.rmdirSync("contracts/test/esp/interfaces", { recursive: true });
    }
  }

  export type ESPContracts = {
    dps: IDataPointStorage;
    dpr: IDataPointRegistry;
  }

  export async function compileEspContracts() {      // compile the contracts
    try {
      // console.log("Starting contract compilation...");
      
      // Verify source files exist before compiling
      const requiredFiles = ["DataPointStorage.sol", "DataPointRegistry.sol"];
      const contractsPath = path.resolve("contracts/test/esp");
      
      for (const file of requiredFiles) {
        const filePath = path.resolve(contractsPath, file);
        if (!fs.existsSync(filePath)) {
          throw new Error(`Required contract file not found before compilation: ${file}`);
        }
      }
      
      // compile the contracts with hardhat compile and wait for completion
      await new Promise<void>((resolve, reject) => {
          exec('npx hardhat compile', { timeout: 60000 }, (error, stdout, stderr) => {
              // console.log(`stdout: ${stdout}`);
              if (stderr) {
                  // console.error(`stderr: ${stderr}`);
              }
              if (error) {
                  reject(new Error(`Failed to compile dps and dpr contracts: ${error.message}`));
                  return;
              }
              resolve();
          });
      });
      
      // Verify artifacts were created
      const artifactsPath = path.resolve("artifacts/contracts/test/esp");
      if (!fs.existsSync(artifactsPath)) {
        throw new Error("Contract artifacts were not created after compilation");
      }
      
      // console.log("✓ Contracts compiled successfully");
  } catch (error) {
      // console.error("Error compiling dps and dpr contracts:", error);
      throw error;
  }
}

  export async function loadEspContracts(chainId: number | null = null, royaltyRate: bigint = ethers.parseUnits("0.001", "gwei"), owner: string | null = null, force: boolean = false) : Promise<ESPContracts> {
    let currentChainId = chainId ?? Number((await ethers.provider.getNetwork()).chainId);
    if (hre.network.name === "localhost") {
      currentChainId = 1337; // overrides so localhost instances can be stored
    }

    let dps: IDataPointStorage | undefined;
    let dpr: IDataPointRegistry | undefined;
    if (await checkSupportedChainIds(currentChainId)) {
      // load the contracts using @tw3/esp loadContract function
      dps = loadContract(currentChainId, "dps") as IDataPointStorage;
      dpr = loadContract(currentChainId, "dpr") as IDataPointRegistry;
      try {
        await dps.VERSION();
      } catch (error) {
        removeLocalhostDeployment(currentChainId);
        throw new Error("Failed to load ESP contracts");
      }
    } else {
      // copy the contracts to local storage from @tw3/esp/contracts/interfaces to ../contracts/interfaces
      await copyEspContracts(force);

      // compile the contracts
      await compileEspContracts();
      
      // deploy the contracts using the hardhat ethers contract factory
      const dpsFactory = await ethers.getContractFactory("contracts/test/esp/DataPointStorage.sol:DataPointStorage");
      dps = await dpsFactory.deploy() as unknown as IDataPointStorage;
      await dps.waitForDeployment();

      const dprFactory = await ethers.getContractFactory("contracts/test/esp/DataPointRegistry.sol:DataPointRegistry");
      owner = owner ?? (await ethers.getSigners())[0].address;
      dpr = await dprFactory.deploy(owner, await dps.getAddress(), royaltyRate) as unknown as IDataPointRegistry;
      await dpr.waitForDeployment();

      if (hre.network.name !== "hardhat") {
        if (force) {
          removeLocalhostDeployment(currentChainId);
        }
        // add the contracts to the local deployment
        addLocalhostDeployment({
          chainId: currentChainId,
          dps: { contractAddress: await dps.getAddress(), deployerAddress: owner },
          dpr: { 
            contractAddress: await dpr.getAddress(), 
            deployerAddress: owner, 
            constructors: { 
              ownerAddress: owner, 
              dpsAddress: await dps.getAddress(), 
              royaltyRate: royaltyRate.toString() 
            } 
          }
        });
      }
    }
    return { dps, dpr };
  }
