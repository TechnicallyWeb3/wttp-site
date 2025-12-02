import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { 
  IBaseWTTPSite, 
  DEFAULT_HEADER, 
  DEFINERequestStruct, 
  HEADRequestStruct, 
  normalizePath 
} from "@wttp/core";
import { getMimeType, uploadFile, getDynamicGasSettings, looseEqual, estimateFile, FileEstimateResult, getEstimationGasPrice } from "./uploadFile";
import { fetchResource } from "./fetchResource";
import { createWTTPIgnore, WTTPIgnoreOptions } from "./wttpIgnore";

const MAX_CHUNK_SIZE = 32 * 1024;

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

// Helper function to get all files in a directory recursively with ignore filtering
function getAllFiles(dirPath: string, wttpIgnore: any, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    // Check if this file/directory should be ignored
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
      console.log(`🚫 Ignoring: ${path.relative(wttpIgnore.baseDir, fullPath)}`);
      return;
    }
    
    if (isDirectory(fullPath)) {
      arrayOfFiles = getAllFiles(fullPath, wttpIgnore, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// Helper function to get all directories in a directory recursively with ignore filtering
function getAllDirectories(dirPath: string, basePath: string, wttpIgnore: any, arrayOfDirs: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  const relativeDirPath = path.relative(basePath, dirPath);
  
  if (relativeDirPath) {
    arrayOfDirs.push(relativeDirPath);
  }

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    // Check if this directory should be ignored
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
      console.log(`🚫 Ignoring directory: ${path.relative(wttpIgnore.baseDir, fullPath)}`);
      return;
    }
    
    if (isDirectory(fullPath)) {
      arrayOfDirs = getAllDirectories(fullPath, basePath, wttpIgnore, arrayOfDirs);
    }
  });

  return arrayOfDirs;
}

// Helper function to determine the index file for a directory
function findIndexFiles(dirPath: string): string[] {
  const files = fs.readdirSync(dirPath);
  
  // Priority order for index files
  const indexPriority = [
    "index.html",
    "index.htm",
    "index.js",
    "index.json",
    "index.md",
    "index.txt"
  ];

  let indexFiles = [];
  
  for (const indexFile of indexPriority) {
    if (files.includes(indexFile)) {
      indexFiles.push(indexFile);
    }
  }

  if (indexFiles.length < 1) {
    indexFiles.push("index.html");
  }
  
  return indexFiles;
}

// Helper function to create directory metadata with ignore filtering
function createDirectoryMetadata(dirPath: string, basePath: string, wttpIgnore: any): Record<string, any> {
  const files = fs.readdirSync(dirPath);
  const directoryMetadata: Record<string, any> = {};
  
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    // Check if this file/directory should be ignored
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
      return; // Skip ignored files
    }
    
    if (isDirectory(fullPath)) {
      directoryMetadata[file] = { "directory": true };
    } else {
      const mimeType = getMimeType(fullPath);
      directoryMetadata[file] = {
        "mimeType": mimeType,
        "charset": "utf-8",
        "encoding": "identity",
        "language": "en-US"
      };
    }
  });
  
  return { "directory": directoryMetadata };
}

// Main upload directory function with enhanced error handling and validation
export async function uploadDirectory(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string,
  ignoreOptions?: WTTPIgnoreOptions
) {
  console.log(`🚀 Starting directory upload: ${sourcePath} → ${destinationPath}`);
  
  // Parameter validation
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }
  if (!isDirectory(sourcePath)) {
    throw new Error(`Source path ${sourcePath} is not a directory`);
  }
  
  destinationPath = normalizePath(destinationPath, true);
  
  // Initialize WTTP ignore system
  const wttpIgnore = createWTTPIgnore(sourcePath, ignoreOptions);
  console.log(`📋 Using ${wttpIgnore.getPatterns().length} ignore patterns`);
  
  // Find the index files for the directory
  const indexFiles = findIndexFiles(sourcePath);
  let indexLocation = `./${indexFiles[0]}`; // Defaults to index.html even if it doesn't exist
  
  // single index file
  let redirectCode = 301;
  let tempMetadataPath: string | null = null;

  if (indexFiles.length > 1) {
    // Multiple choices
    redirectCode = 300;

    // First, we need to create a json object with the directory metadata
    const directoryMetadata = createDirectoryMetadata(sourcePath, sourcePath, wttpIgnore);
    const directoryMetadataJson = JSON.stringify(directoryMetadata, null, 2);

    if (directoryMetadataJson.length < MAX_CHUNK_SIZE) {
      // the directory listing can fit in the location header
      indexLocation = directoryMetadataJson;
    } else {
      // Next, we need to create a temporary file with the directory metadata
      tempMetadataPath = path.join(process.cwd(), "temp_directory_metadata.json");
      fs.writeFileSync(tempMetadataPath, directoryMetadataJson);
      // the directory listing is too large, so we need to upload it as a file
      // can be done async in background
      await uploadFile(wttpSite, tempMetadataPath, destinationPath);
    }
  }
  
  // Check if the directory already has a header and if it's different from what we want to set
  const newHeaderData = {
    ...DEFAULT_HEADER,
    redirect: {
      code: redirectCode,
      location: indexLocation
    }
  };

  let shouldDefine = true;
  try {
    const siteAddress = await wttpSite.getAddress();
    const existingResource = await fetchResource(siteAddress, destinationPath, { headRequest: true });
    
    if (existingResource.response.head.status !== 404n) {
      // Resource exists, compare headers
      // const existingHeaderData = existingResource.response.head.headerInfo;
      
      // // Convert BigInt values to numbers for comparison
      // const normalizedExisting = {
      //   cache: {
      //     immutableFlag: existingHeaderData.cache.immutableFlag,
      //     preset: Number(existingHeaderData.cache.preset),
      //     custom: existingHeaderData.cache.custom
      //   },
      //   cors: {
      //     methods: Number(existingHeaderData.cors.methods),
      //     origins: existingHeaderData.cors.origins,
      //     preset: Number(existingHeaderData.cors.preset),
      //     custom: existingHeaderData.cors.custom
      //   },
      //   redirect: {
      //     code: Number(existingHeaderData.redirect.code),
      //     location: existingHeaderData.redirect.location
      //   }
      // };

      // const normalizedNew = {
      //   cache: {
      //     immutableFlag: newHeaderData.cache.immutableFlag,
      //     preset: Number(newHeaderData.cache.preset),
      //     custom: newHeaderData.cache.custom
      //   },
      //   cors: {
      //     methods: Number(newHeaderData.cors.methods),
      //     origins: newHeaderData.cors.origins,
      //     preset: Number(newHeaderData.cors.preset),
      //     custom: newHeaderData.cors.custom
      //   },
      //   redirect: {
      //     code: Number(newHeaderData.redirect.code),
      //     location: newHeaderData.redirect.location
      //   }
      // };

      if (looseEqual(existingResource.response.head.headerInfo, newHeaderData)) {
        console.log(`📋 Directory header at ${destinationPath} is already up to date, skipping DEFINE`);
        shouldDefine = false;
      } else {
        console.log(`📋 Directory header at ${destinationPath} is different, will update with DEFINE`);
      }
    } else {
      console.log(`📋 Directory ${destinationPath} does not exist, will create with DEFINE`);
    }
  } catch (error) {
    console.log(`📋 Could not check existing header for ${destinationPath}, proceeding with DEFINE: ${error}`);
  }

  if (shouldDefine) {
    // Upload the directory metadata with redirect header
    console.log("Uploading directory metadata with redirect header...");
    
    // Get dynamic gas settings for optimized transaction speed
    const gasSettings = await getDynamicGasSettings();
    
    let requestHead: HEADRequestStruct = {
      path: destinationPath,
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const defineRequest: DEFINERequestStruct = {
      head: requestHead,
      data: newHeaderData
    };
      
    console.log(`🚀 Sending DEFINE transaction with optimized gas settings...`);
    const defineTx = await wttpSite.DEFINE(defineRequest, gasSettings);
    await defineTx.wait();
    console.log(`Directory ${destinationPath} created successfully!`);
  }
  
  // Clean up the temporary file
  if (tempMetadataPath) {
    fs.unlinkSync(tempMetadataPath);
  }
  
  // Process all items in the directory
  const items = fs.readdirSync(sourcePath);

  for (const item of items) {
    const fullSourcePath = path.join(sourcePath, item);
    const fullDestPath = path.join(destinationPath, item).replace(/\\/g, '/');
    
    // Check if this item should be ignored
    if (wttpIgnore.shouldIgnore(fullSourcePath)) {
      console.log(`🚫 Skipping ignored item: ${item}`);
      continue;
    }
    
    try {
      if (isDirectory(fullSourcePath)) {
        // Recursively handle subdirectories
        await uploadDirectory(wttpSite, fullSourcePath, fullDestPath, ignoreOptions);
      } else {
        // Upload files
        console.log(`📤 Uploading file: ${item}`);
        await uploadFile(wttpSite, fullSourcePath, fullDestPath);
        console.log(`✅ File uploaded successfully: ${item}`);
      }
    } catch (error) {
      console.error(`❌ Failed to upload resource ${item}:`, error);
      throw new Error(`Failed to upload resource ${item}: ${error}`);
    }
  }
    
  console.log(`Directory ${sourcePath} uploaded successfully to ${destinationPath}`);
  return true;
}

// Gas estimation function for directory uploads
export interface DirectoryEstimateResult {
  totalGas: bigint;
  totalCost: bigint;
  totalRoyaltyCost: bigint;
  totalTransactions: number;
  fileCount: number;
  directoryCount: number;
  fileEstimates: Map<string, FileEstimateResult>;
  gasPrice: bigint;
}

export async function estimateDirectory(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string,
  gasPriceGwei?: number,
  ignoreOptions?: WTTPIgnoreOptions,
  rate: number = 2.0,
  minGasPriceGwei: number = 150
): Promise<DirectoryEstimateResult> {
  console.log(`📊 Estimating gas for directory: ${sourcePath} → ${destinationPath}`);
  
  // Get network info for currency symbol
  const network = await ethers.provider.getNetwork();
  const isPolygon = network.chainId === 137n;
  const currencySymbol = isPolygon ? "POL" : "ETH";
  
  // Parameter validation
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }
  if (!isDirectory(sourcePath)) {
    throw new Error(`Source path ${sourcePath} is not a directory`);
  }
  
  destinationPath = normalizePath(destinationPath, true);
  
  // Initialize WTTP ignore system
  const wttpIgnore = createWTTPIgnore(sourcePath, ignoreOptions);
  console.log(`📋 Using ${wttpIgnore.getPatterns().length} ignore patterns`);
  
  // Get gas price once for consistency
  const gasPrice = await getEstimationGasPrice(gasPriceGwei, rate, minGasPriceGwei);
  console.log(`⛽ Using gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  
  let totalGas = 0n;
  let totalRoyaltyCost = 0n;
  let totalTransactions = 0;
  let fileCount = 0;
  let directoryCount = 0;
  const fileEstimates = new Map<string, FileEstimateResult>();
  
  // Estimate DEFINE transaction for directory
  // Find the index files for the directory to determine redirect
  const indexFiles = findIndexFiles(sourcePath);
  let indexLocation = `./${indexFiles[0]}`; // Defaults to index.html even if it doesn't exist
  let redirectCode = 301;
  
  if (indexFiles.length > 1) {
    redirectCode = 300; // Multiple choices
  }
  
  // Create header data for DEFINE
  const newHeaderData = {
    ...DEFAULT_HEADER,
    redirect: {
      code: redirectCode,
      location: indexLocation
    }
  };
  
  // Construct DEFINE request
  let requestHead: HEADRequestStruct = {
    path: destinationPath,
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };
  
  const defineRequest: DEFINERequestStruct = {
    head: requestHead,
    data: newHeaderData
  };
  
  try {
    console.log(`⛽ Estimating DEFINE transaction...`);
    const defineGasEstimate = await wttpSite.DEFINE.estimateGas(defineRequest);
    totalGas += defineGasEstimate;
    totalTransactions += 1;
    console.log(`   DEFINE gas: ${defineGasEstimate.toString()}`);
  } catch (error) {
    console.warn(`⚠️ Could not estimate DEFINE gas, using conservative estimate: ${error}`);
    // Use a conservative estimate if actual estimation fails
    const defineGasEstimate = 50000n;
    totalGas += defineGasEstimate;
    totalTransactions += 1;
    console.log(`   Using conservative DEFINE gas estimate: ${defineGasEstimate.toString()}`);
  }
  
  // Get all files recursively
  const allFiles = getAllFiles(sourcePath, wttpIgnore);
  
  console.log(`📁 Found ${allFiles.length} files to estimate`);
  
  // Estimate each file
  for (const filePath of allFiles) {
    const relativePath = path.relative(sourcePath, filePath);
    const fullDestPath = path.join(destinationPath, relativePath).replace(/\\/g, '/');
    
    try {
      console.log(`\n📊 Estimating: ${relativePath}`);
      const fileEstimate = await estimateFile(wttpSite, filePath, fullDestPath, gasPriceGwei, rate, minGasPriceGwei);
      
      totalGas += fileEstimate.totalGas;
      totalRoyaltyCost += fileEstimate.royaltyCost;
      totalTransactions += fileEstimate.transactionCount;
      fileCount++;
      fileEstimates.set(relativePath, fileEstimate);
      
      // Get network info for currency symbol
      const fileNetwork = await ethers.provider.getNetwork();
      const fileIsPolygon = fileNetwork.chainId === 137n;
      const fileCurrencySymbol = fileIsPolygon ? "POL" : "ETH";
      console.log(`   ✅ Estimated: ${fileEstimate.transactionCount} transactions, ${ethers.formatEther(fileEstimate.totalCost)} ${fileCurrencySymbol}`);
    } catch (error) {
      console.error(`❌ Failed to estimate file ${relativePath}:`, error);
      // Continue with other files
    }
  }
  
  // Count directories
  const allDirs = getAllDirectories(sourcePath, sourcePath, wttpIgnore);
  directoryCount = allDirs.length;
  
  // Calculate total file size
  let totalFileSize = 0;
  for (const filePath of allFiles) {
    try {
      const stats = fs.statSync(filePath);
      totalFileSize += stats.size;
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  // Calculate total cost
  const totalCost = totalGas * gasPrice;
  const averageGas = totalTransactions > 0 ? totalGas / BigInt(totalTransactions) : 0n;
  
  // Calculate cost per MB
  const totalSizeMB = totalFileSize / (1024 * 1024);
  const costPerMBWei = totalSizeMB > 0 ? (totalCost * BigInt(1e18)) / BigInt(Math.floor(totalSizeMB * 1e18)) : 0n;
  
  console.log(`\n📊 Directory Estimation Summary:`);
  console.log(`   Total gas: ${totalGas.toString()}`);
  console.log(`   Average gas per transaction: ${averageGas.toString()}`);
  console.log(`   Total cost: ${ethers.formatEther(totalCost)} ${currencySymbol}`);
  console.log(`   Total royalty cost: ${ethers.formatEther(totalRoyaltyCost)} ${currencySymbol}`);
  console.log(`   Cost per MB: ${totalSizeMB > 0 ? ethers.formatEther(costPerMBWei) : "0"} ${currencySymbol}/MB`);
  console.log(`   Total transactions: ${totalTransactions}`);
  console.log(`   Files: ${fileCount}`);
  console.log(`   Directories: ${directoryCount}`);
  console.log(`   Total size: ${totalSizeMB.toFixed(2)} MB`);
  console.log(`   Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`   Settings: ${gasPriceGwei ? `gasprice=${gasPriceGwei}` : `rate=${rate}, min=${minGasPriceGwei}`}`);
  
  return {
    totalGas,
    totalCost,
    totalRoyaltyCost,
    totalTransactions,
    fileCount,
    directoryCount,
    fileEstimates,
    gasPrice
  };
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: npx hardhat run scripts/uploadDirectory.ts <site-address> <source-directory> <destination-path>");
    process.exit(1);
  }
  
  const [siteAddress, sourcePath, destinationPath] = args;
  
  // Connect to the WTTP site
  const wttpSite = await ethers.getContractAt("Web3Site", siteAddress);
  
  // Upload the directory with default ignore options
  await uploadDirectory(wttpSite, sourcePath, destinationPath);
}

// Only execute the script if it's being run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}