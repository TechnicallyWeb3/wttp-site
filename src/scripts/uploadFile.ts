import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { 
  encodeCharset,
  encodeMimeType, 
  IBaseWTTPSite, 
  LOCATEResponseStruct, 
  normalizePath
} from "@wttp/core";
import { fetchResource } from "./fetchResource";
import {
  looseEqual,
  chunkData,
  getMimeType,
  getMimeTypeWithCharset,
  getChainSymbol as getChainSymbolUtil,
  waitForGasPriceBelowLimit as waitForGasPriceBelowLimitUtil,
  getDynamicGasSettings as getDynamicGasSettingsUtil,
  getEstimationGasPrice as getEstimationGasPriceUtil
} from "../utils";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const DEFAULT_FILE_WARN = 100 * 1024 * 1024; // 100MB warning
const DEFAULT_FILE_LIMIT = 400 * 1024 * 1024; // 400MB limit
const DEFAULT_GAS_LIMIT = 300; // Default gas limit in gwei

// Re-export for backward compatibility
export { looseEqual, getMimeType, getMimeTypeWithCharset, chunkData };

// Wrapper functions that use Hardhat's ethers.provider
export async function getChainSymbol(): Promise<string> {
  return getChainSymbolUtil(ethers.provider);
}

export async function waitForGasPriceBelowLimit(gasLimitGwei: number, checkIntervalMs: number = 10000): Promise<void> {
  return waitForGasPriceBelowLimitUtil(ethers.provider, gasLimitGwei, checkIntervalMs);
}

export async function getDynamicGasSettings() {
  return getDynamicGasSettingsUtil(ethers.provider);
}

export async function getEstimationGasPrice(customGasPriceGwei?: number, rate: number = 2, minGasPriceGwei: number = 150): Promise<bigint> {
  return getEstimationGasPriceUtil(ethers.provider, customGasPriceGwei, rate, minGasPriceGwei);
}

// Main upload function with enhanced error handling and validation
export async function uploadFile(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string,
  fileLimitBytes?: number,
  gasLimitGwei?: number
) {
  console.log(`🚀 Starting upload: ${sourcePath} → ${destinationPath}`);
  
  // Get currency symbol early
  const currencySymbol = await getChainSymbol();
  
  // Parameter validation
  if (!wttpSite) {
    throw new Error("Web3Site contract instance is required");
  }
  if (!sourcePath || !destinationPath) {
    throw new Error("Both source and destination paths are required");
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }
  if (!fs.statSync(sourcePath).isFile()) {
    throw new Error(`Source path is not a file: ${sourcePath}`);
  }
  
  // Normalize the destination path
  try {
    destinationPath = normalizePath(destinationPath);
  } catch (error) {
    throw new Error(`Invalid destination path format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Read file with error handling
  let fileData: Buffer;
  try {
    fileData = fs.readFileSync(sourcePath);
  } catch (error) {
    throw new Error(`Failed to read file ${sourcePath}: ${error}`);
  }
  
  console.log(`📁 File size: ${fileData.length} bytes`);
  
  // Use provided file limits or defaults
  const fileWarn = fileLimitBytes ? fileLimitBytes * 0.25 : DEFAULT_FILE_WARN; // 25% of limit as warning
  const fileLimit = fileLimitBytes || DEFAULT_FILE_LIMIT;
  
  // Validate file size
  if (fileData.length === 0) {
    throw new Error("Cannot upload empty file");
  }
  if (fileData.length > fileWarn) {
    if (fileData.length > fileLimit) {
      throw new Error(`❌  File size exceeds ${fileLimit / (1024 * 1024)}MB limit. Upload aborted.`);
    }
    console.warn(`⚠️  Large file detected (>${fileWarn / (1024 * 1024)}MB). Upload may take significant time and gas.`);
  }

  // let resourceExists = false;
  // try{
  //   let existingResource = await fetchResource(await wttpSite.getAddress(), destinationPath, { datapoints: false });
  //   let existingData = existingResource.content;
  //   if (existingData && Buffer.from(existingData).equals(fileData)) {
  //     console.log("✅ File already exists with identical content");
  //     resourceExists = true;
  //     // return existingResource; // We need to either check properties also or remove this return since properties may need to be updated. 
  //   }
  // } catch (error) {
  //   console.log(`No resource found at ${destinationPath}, uploading...`);
  // }
  
  // Chunk the data
  const chunks = chunkData(fileData, CHUNK_SIZE);
  console.log(`Split into ${chunks.length} chunks of ${CHUNK_SIZE} bytes`);
  
  // Prepare for upload
  const signer = await ethers.provider.getSigner();
  const signerAddress = await signer.getAddress();
  
  // Prepare data registrations
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: signerAddress
  }));

  // FIXED: Initialize royalty array with correct size to prevent index errors
  let royalty = new Array(dataRegistrations.length).fill(0n);
  
  // Get the DPS and DPR contracts once for efficiency
  const dpsAddress = await wttpSite.DPS();
  const dps = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointStorage.sol:IDataPointStorage", dpsAddress);
  const dprAddress = await wttpSite.DPR();
  const dpr = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointRegistry.sol:IDataPointRegistry", dprAddress);
  
  let totalRoyalty = 0n;
  let dataPointAddresses = new Array(dataRegistrations.length).fill("");
  const resourceResponse = await fetchResource(await wttpSite.getAddress(), destinationPath);
  const resourceDataPointAddresses = resourceResponse.response.resource.dataPoints;
  const resourceExists = resourceDataPointAddresses.length > 0;
  
  let chunksToUpload: number[] = []; // Array of chunk indices that need uploading
  
  // Check royalties for each chunk before uploading
  console.log(`📊 Calculating royalties for ${dataRegistrations.length} chunks...`);
  for (let i = 0; i < dataRegistrations.length; i++) {
    const chunk = dataRegistrations[i];
    
    // Calculate the data point address
    const dataPointAddress = await dps.calculateAddress(chunk.data);
    dataPointAddresses[i] = dataPointAddress;
    
    if(resourceDataPointAddresses.length > i) {
      // Check if this chunk already exists in the resource
      const existingAddress = resourceDataPointAddresses[i]?.toString() || "";
      if (existingAddress === dataPointAddress) {
        console.log(`✅ Chunk ${i + 1}/${dataRegistrations.length} already exists, skipping`);
        royalty[i] = 0n; // No cost for existing chunks
      } else {
        // Chunk needs to be uploaded
        chunksToUpload.push(i);
        
        // Get the royalty for this chunk
        royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
        totalRoyalty += royalty[i];
        
        console.log(`📤 Chunk ${i + 1}/${dataRegistrations.length}: ${ethers.formatEther(royalty[i])} ${currencySymbol}`);
      }
    
    } else {
      // Chunk needs to be uploaded
      chunksToUpload.push(i);
      
      // Get the royalty for this chunk
      royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
      totalRoyalty += royalty[i];
      
      console.log(`📤 Chunk ${i + 1}/${dataRegistrations.length}: ${ethers.formatEther(royalty[i])} ${currencySymbol}`);
    }
  }
  
  console.log(`💰 Total royalty required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}`);
  console.log(`📋 Chunks to upload: ${chunksToUpload.length}/${dataRegistrations.length}`);
  
  // Check if user has sufficient balance
  const balance = await ethers.provider.getBalance(signerAddress);
  if (balance < totalRoyalty) {
    throw new Error(`Insufficient balance. Required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}, Available: ${ethers.formatEther(balance)} ${currencySymbol}`);
  }
  
  // Track gas and royalties for summary
  let totalGasUsed = 0n;
  let totalRoyaltiesSpent = 0n;

    
  // Get MIME type and charset
  const { mimeType, charset } = getMimeTypeWithCharset(sourcePath);
  console.log(`Mime type: ${mimeType}, charset: ${charset || 'none'}`);
  const mimeTypeBytes2 = encodeMimeType(mimeType);
  const charsetBytes2 = charset ? encodeCharset(charset) : encodeCharset("");

  // Wait for gas price to be below limit if specified
  if (gasLimitGwei !== undefined) {
    console.log(`⏳ Waiting for gas price to drop below ${gasLimitGwei} gwei...`);
    await waitForGasPriceBelowLimit(gasLimitGwei);
  }
  
  // Gas optimization settings for faster transactions
  const gasSettings = await getDynamicGasSettings();

  const headRequest = {
    path: destinationPath,
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };

  // Use PUT to create new resource/update existing resource
  console.log(`${resourceExists ? "Updating" : "Creating"} resource at ${destinationPath}`);
  const putRequest = {
    head: headRequest,
    properties: {
      mimeType: mimeTypeBytes2,
      charset: charsetBytes2,
      encoding: "0x6964", // id = identity
      language: "0x6575" // eu = english-US
    },
    data: [dataRegistrations[0]]
  };

  // Early exit if no chunks need uploading and properties match
  if (chunksToUpload.length === 0 && looseEqual(resourceResponse.response.head.metadata.properties, putRequest.properties)) {
    console.log("✅ File is identical (properties and data), skipping upload");
    return resourceResponse;
  }

  let needsPUT = false;
  let patchChunks = [...chunksToUpload]; // Copy of chunks to upload

  // Check if properties are different (requires PUT)
  if (!looseEqual(resourceResponse.response.head.metadata.properties, putRequest.properties)) {
    console.log("❌ File properties are different, requires PUT");
    // console.log("Response properties:", resourceResponse.response.head.metadata.properties);
    // console.log("Put request properties:", putRequest.properties);
    needsPUT = true;
  } else {
    console.log("✅ File properties are identical, using PATCH only");
  }

  // If we need PUT and chunk 0 is in the upload list, PUT handles chunk 0
  if (needsPUT) {
    // If chunk 0 data is unchanged but we need PUT, we still need to pay royalty for chunk 0
    if (!chunksToUpload.includes(0)) {
      console.log("📊 Calculating royalty for chunk 0 (needed for PUT with unchanged data)...");
      royalty[0] = await dpr.getDataPointRoyalty(dataPointAddresses[0]);
      totalRoyalty += royalty[0];
      console.log(`💰 Additional royalty for PUT: ${ethers.formatEther(royalty[0])} ${currencySymbol}`);
      
      // Re-check balance with updated royalty
      const balance = await ethers.provider.getBalance(signerAddress);
      if (balance < totalRoyalty) {
        throw new Error(`Insufficient balance after adding PUT royalty. Required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}, Available: ${ethers.formatEther(balance)} ${currencySymbol}`);
      }
    }
    
    // Wait for gas price to be below limit if specified (before PUT)
    if (gasLimitGwei !== undefined) {
      await waitForGasPriceBelowLimit(gasLimitGwei);
    }
    
    console.log(`🚀 Sending PUT transaction with optimized gas settings...`);
    const tx = await wttpSite.PUT(putRequest, { 
      value: royalty[0],
      ...gasSettings // TODO: Uncomment this when gas settings are working
    });
    const receipt = await tx.wait();
    if (receipt) {
      totalGasUsed += receipt.gasUsed;
      totalRoyaltiesSpent += royalty[0];
    }
    console.log("✅ PUT transaction completed - file properties and first chunk updated");
    
    // Remove chunk 0 from PATCH list if it was there
    patchChunks = patchChunks.filter(i => i !== 0);
  }

  // Upload remaining chunks with progress reporting
  for (let i = 0; i < patchChunks.length; i++) {
    const chunkIndex = patchChunks[i];
    const progress = Math.round(((i + 1) / patchChunks.length) * 100);
    console.log(`📤 Uploading chunk ${chunkIndex + 1}/${dataRegistrations.length} (${i + 1}/${patchChunks.length}, ${progress}%)`);
    
    try {
      // Get fresh gas settings for each chunk to adapt to network conditions
      const currentGasSettings = await getDynamicGasSettings();
      
      const patchRequest = {
        head: headRequest,
        data: [dataRegistrations[chunkIndex]]
      };
    
      console.log(`🚀 Sending PATCH transaction ${i + 1} with updated gas settings...`);
      const tx = await wttpSite.PATCH(patchRequest, { 
        value: royalty[chunkIndex],
        ...currentGasSettings
      });
      const receipt = await tx.wait(2);
      if (receipt) {
        totalGasUsed += receipt.gasUsed;
        totalRoyaltiesSpent += royalty[chunkIndex];
      }
      console.log(`✅ Chunk ${chunkIndex + 1} uploaded successfully (${ethers.formatEther(royalty[chunkIndex])} ${currencySymbol})`);
    } catch (error) {
      console.error(`❌ Failed to upload chunk ${chunkIndex + 1}:`, error);
      throw new Error(`Upload failed at chunk ${chunkIndex + 1}: ${error}`);
    }
  }

  console.log(`🎉 Upload completed! ${chunksToUpload.length} chunks uploaded successfully.`);

  let fetchResult;
  try{
    fetchResult = await fetchResource(
      await wttpSite.getAddress(), 
      destinationPath, 
      {headRequest: true}
    );

  } catch (error) {
    throw new Error(`Upload failed: ${error}`);
  }

  const fetchSize = fetchResult.response.head.metadata.size;

  if (
    fetchResult.response.head.status !== 200n && 
    fetchSize === BigInt(fileData.length)
  ) {
  
    console.log(`Uploaded file has ${dataRegistrations.length} chunks`);
    console.log(`File size: ${fetchSize} bytes`);
    
  }
  
  // Calculate summary statistics
  const fileSizeMB = fileData.length / (1024 * 1024);
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
  const totalGasCost = totalGasUsed * effectiveGasPrice;
  const costPerMBWei = fileSizeMB > 0 ? (totalGasCost * BigInt(1e18)) / BigInt(Math.floor(fileSizeMB * 1e18)) : 0n;
  
  // Build options string
  const options: string[] = [];
  if (fileLimitBytes !== undefined) {
    options.push(`filelimit=${Math.floor(fileLimitBytes / (1024 * 1024))}MB`);
  }
  if (gasLimitGwei !== undefined) {
    options.push(`gaslimit=${gasLimitGwei}gwei`);
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Total gas used: ${totalGasUsed.toString()}`);
  console.log(`   Total royalties spent: ${ethers.formatEther(totalRoyaltiesSpent)} ${currencySymbol}`);
  console.log(`   Total gas cost: ${ethers.formatEther(totalGasCost)} ${currencySymbol}`);
  console.log(`   Total cost: ${ethers.formatEther(totalGasCost + totalRoyaltiesSpent)} ${currencySymbol}`);
  console.log(`   Cost per MB: ${fileSizeMB > 0 ? ethers.formatEther(costPerMBWei) : "0"} ${currencySymbol}/MB`);
  if (options.length > 0) {
    console.log(`   Options: ${options.join(", ")}`);
  }
  
  return fetchResult;
}

// Gas estimation function for file uploads
export interface FileEstimateResult {
  totalGas: bigint;
  totalCost: bigint;
  royaltyCost: bigint;
  transactionCount: number;
  chunksToUpload: number;
  needsPUT: boolean;
  gasPrice: bigint;
}

export async function estimateFile(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string,
  gasPriceGwei?: number,
  rate: number = 2,
  minGasPriceGwei: number = 150
): Promise<FileEstimateResult> {
  console.log(`📊 Estimating gas for: ${sourcePath} → ${destinationPath}`);
  
  // Get gas price for estimation
  const gasPrice = await getEstimationGasPrice(gasPriceGwei, rate, minGasPriceGwei);
  console.log(`⛽ Using gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  
  // Parameter validation
  if (!wttpSite) {
    throw new Error("Web3Site contract instance is required");
  }
  
  if (!sourcePath || !destinationPath) {
    throw new Error("Both source and destination paths are required");
  }
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }
  if (!fs.statSync(sourcePath).isFile()) {
    throw new Error(`Source path is not a file: ${sourcePath}`);
  }
  
  // Normalize the destination path
  try {
    destinationPath = normalizePath(destinationPath);
  } catch (error) {
    throw new Error(`Invalid destination path format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Read file
  let fileData: Buffer;
  try {
    fileData = fs.readFileSync(sourcePath);
  } catch (error) {
    throw new Error(`Failed to read file ${sourcePath}: ${error}`);
  }
  
  console.log(`📁 File size: ${fileData.length} bytes`);
  
  // Validate file size
  if (fileData.length === 0) {
    throw new Error("Cannot estimate empty file");
  }
  
  // Chunk the data
  const chunks = chunkData(fileData, CHUNK_SIZE);
  console.log(`Split into ${chunks.length} chunks of ${CHUNK_SIZE} bytes`);
  
  // Prepare data registrations
  const signer = await ethers.provider.getSigner();
  const signerAddress = await signer.getAddress();
  
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: signerAddress
  }));
  
  // Get the DPS and DPR contracts
  const dpsAddress = await wttpSite.DPS();
  const dps = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointStorage.sol:IDataPointStorage", dpsAddress);
  const dprAddress = await wttpSite.DPR();
  const dpr = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointRegistry.sol:IDataPointRegistry", dprAddress);
  
  let totalRoyalty = 0n;
  let dataPointAddresses = new Array(dataRegistrations.length).fill("");
  let chunksToUpload: number[] = [];
  
  // Check existing resource
  let resourceResponse;
  let resourceDataPointAddresses: string[] = [];
  try {
    resourceResponse = await fetchResource(await wttpSite.getAddress(), destinationPath);
    resourceDataPointAddresses = resourceResponse.response.resource.dataPoints.map(dp => dp.toString());
  } catch (error) {
    // Resource doesn't exist yet
    resourceResponse = null;
  }
  
  // Calculate royalties and determine which chunks need uploading
  console.log(`📊 Calculating royalties for ${dataRegistrations.length} chunks...`);
  for (let i = 0; i < dataRegistrations.length; i++) {
    const chunk = dataRegistrations[i];
    
    // Calculate the data point address
    const dataPointAddress = await dps.calculateAddress(chunk.data);
    dataPointAddresses[i] = dataPointAddress;
    
    if (resourceDataPointAddresses.length > i) {
      // Check if this chunk already exists in the resource
      const existingAddress = resourceDataPointAddresses[i] || "";
      if (existingAddress === dataPointAddress) {
        console.log(`✅ Chunk ${i + 1}/${dataRegistrations.length} already exists, skipping`);
      } else {
        chunksToUpload.push(i);
        const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
        totalRoyalty += royalty;
      }
    } else {
      chunksToUpload.push(i);
      const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
      totalRoyalty += royalty;
    }
  }
  
  console.log(`💰 Total royalty required: ${ethers.formatEther(totalRoyalty)} ETH`);
  console.log(`📋 Chunks to upload: ${chunksToUpload.length}/${dataRegistrations.length}`);
  
  // Get MIME type and charset
  const { mimeType, charset } = getMimeTypeWithCharset(sourcePath);
  const mimeTypeBytes2 = encodeMimeType(mimeType);
  const charsetBytes2 = charset ? encodeCharset(charset) : encodeCharset("");
  
  const headRequest = {
    path: destinationPath,
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };
  
  const putRequest = {
    head: headRequest,
    properties: {
      mimeType: mimeTypeBytes2,
      charset: charsetBytes2,
      encoding: "0x6964", // id = identity
      language: "0x6575" // eu = english-US
    },
    data: [dataRegistrations[0]]
  };
  
  // Use PUT for all chunks (overestimates but works without existing resources)
  console.log(`📝 Using PUT for all chunks (conservative overestimation)`);
  
  let totalGas = 0n;
  
  // Estimate PUT for all chunks
  // For PUT, all chunks need chunkIndex: 0 since PUT creates/replaces the resource starting from 0
  for (let i = 0; i < chunksToUpload.length; i++) {
    const chunkIndex = chunksToUpload[i];
    const chunkRoyalty = await dpr.getDataPointRoyalty(dataPointAddresses[chunkIndex]);
    
    // PUT always expects chunkIndex: 0 in the DataRegistration
    // Create a PUT request with this chunk's data but chunkIndex set to 0
    const putRequestForChunk = {
      head: headRequest,
      properties: {
        mimeType: mimeTypeBytes2,
        charset: charsetBytes2,
        encoding: "0x6964", // id = identity
        language: "0x6575" // eu = english-US
      },
      data: [{
        data: dataRegistrations[chunkIndex].data,
        chunkIndex: 0, // PUT always uses chunkIndex 0
        publisher: dataRegistrations[chunkIndex].publisher
      }]
    };
    
    try {
      const putGasEstimate = await wttpSite.PUT.estimateGas(putRequestForChunk, {
        value: chunkRoyalty
      });
      totalGas += putGasEstimate;
      if ((i + 1) % 10 === 0 || i === chunksToUpload.length - 1) {
        console.log(`⛽ Estimated ${i + 1}/${chunksToUpload.length} PUT transactions...`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not estimate PUT gas for chunk ${chunkIndex}: ${error}`);
      // Use a conservative estimate based on chunk 0 if available, otherwise default
      if (i === 0) {
        // If chunk 0 fails, use a default conservative estimate
        totalGas += 200000n;
      } else {
        // For subsequent chunks, use the same estimate as chunk 0 if available
        // This is a conservative overestimate
        totalGas += 200000n; // Conservative estimate per chunk
      }
    }
  }
  
  const totalCost = totalGas * gasPrice;
  const transactionCount = chunksToUpload.length;
  const averageGas = transactionCount > 0 ? totalGas / BigInt(transactionCount) : 0n;
  
  // Calculate cost per MB
  const fileSizeMB = fileData.length / (1024 * 1024);
  const costPerMBWei = fileSizeMB > 0 ? (totalCost * BigInt(1e18)) / BigInt(Math.floor(fileSizeMB * 1e18)) : 0n;
  
  // Get currency symbol
  const currencySymbol = await getChainSymbol();
  
  console.log(`\n📊 Estimation Summary:`);
  console.log(`   Total gas: ${totalGas.toString()}`);
  console.log(`   Average gas per transaction: ${averageGas.toString()}`);
  console.log(`   Total cost: ${ethers.formatEther(totalCost)} ${currencySymbol}`);
  console.log(`   Royalty cost: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}`);
  console.log(`   Cost per MB: ${fileSizeMB > 0 ? ethers.formatEther(costPerMBWei) : "0"} ${currencySymbol}/MB`);
  console.log(`   Transactions: ${transactionCount} PUT (conservative overestimation)`);
  console.log(`   Gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  console.log(`   Settings: ${gasPriceGwei ? `gasprice=${gasPriceGwei}` : `rate=${rate}, min=${minGasPriceGwei}`}`);
  
  return {
    totalGas,
    totalCost,
    royaltyCost: totalRoyalty,
    transactionCount,
    chunksToUpload: chunksToUpload.length,
    needsPUT: true, // Always true since we're using PUT for all
    gasPrice
  };
}

// Command-line interface
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: npx hardhat upload --site <site-address> --source <source-path> --destination <destination-path> --network <network>");
    process.exit(1);
  }
  
  const [siteAddress, sourcePath, destinationPath] = args;
  
  // Connect to the WTTP site
  const wtppSite = await ethers.getContractAt("Web3Site", siteAddress);
  
  // Upload the file
  await uploadFile(wtppSite, sourcePath, destinationPath);
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