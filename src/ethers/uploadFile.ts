// Standalone version of uploadFile - works with standard ethers.js
import { ethers, Contract, Provider, Signer } from "ethers";
import fs from "fs";
import path from "path";
import { 
  encodeCharset,
  encodeMimeType,
  encodeEncoding,
  encodeLanguage,
  type LOCATEResponseStruct, 
  normalizePath
} from "@wttp/core";
import {
  looseEqual,
  chunkData,
  getMimeTypeWithCharset,
  getChainSymbol,
  waitForGasPriceBelowLimit,
  getDynamicGasSettings
} from "../utils";
import { fetchResource } from "./fetchResource";
import { getWttpSite } from "./utils";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const DEFAULT_FILE_WARN = 100 * 1024 * 1024; // 100MB warning
const DEFAULT_FILE_LIMIT = 400 * 1024 * 1024; // 400MB limit

// ESP contract ABIs
const DPS_ABI = [
  "function calculateAddress(bytes memory) public pure returns (bytes32)",
  "function VERSION() external pure returns (uint8)"
];

const DPR_ABI = [
  "function DPS() external view returns (address)",
  "function getDataPointRoyalty(bytes32) external view returns (uint256)"
];

export interface UploadFileOptions {
  provider: Provider;
  signer: Signer;
  fileLimitBytes?: number;
  gasLimitGwei?: number;
  customPublisher?: string;
}

// Main upload function with enhanced error handling and validation
export async function uploadFile(
  wttpSiteAddress: string,
  sourcePath: string,
  destinationPath: string,
  options: UploadFileOptions
): Promise<{
  response: LOCATEResponseStruct,
  content?: Uint8Array,
}> {
  const { provider, signer, fileLimitBytes, gasLimitGwei, customPublisher } = options;
  
  console.log(`🚀 Starting upload: ${sourcePath} → ${destinationPath}`);
  
  // Get currency symbol early
  const currencySymbol = await getChainSymbol(provider);
  
  // Create contract instance with proper ABI typing
  const wttpSite = getWttpSite(wttpSiteAddress, provider, signer);
  
  // Parameter validation
  if (!wttpSiteAddress) {
    throw new Error("Web3Site contract address is required");
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
  const fileWarn = fileLimitBytes ? fileLimitBytes * 0.25 : DEFAULT_FILE_WARN;
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
  
  // Chunk the data
  const chunks = chunkData(fileData, CHUNK_SIZE);
  console.log(`Split into ${chunks.length} chunks of ${CHUNK_SIZE} bytes`);
  
  // Prepare for upload
  const signerAddress = await signer.getAddress();
  
  // Use custom publisher if provided, otherwise use signer address
  const publisherAddress = customPublisher || signerAddress;
  
  // Prepare data registrations
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: publisherAddress
  }));

  // Initialize royalty array
  let royalty = new Array(dataRegistrations.length).fill(0n);
  
  // Get the DPR contract first, then get DPS from it
  const dprAddress = await wttpSite.DPR();
  const dpr = new Contract(dprAddress, DPR_ABI, provider);
  
  // Get DPS address from DPR contract (avoiding issue with wttpSite.DPS())
  let dpsAddress: string;
  try {
    dpsAddress = await wttpSite.DPS();
  } catch (error) {
    // Fallback: get DPS from DPR contract directly
    dpsAddress = await dpr.DPS();
  }
  const dps = new Contract(dpsAddress, DPS_ABI, provider);
  
  let totalRoyalty = 0n;
  let dataPointAddresses = new Array(dataRegistrations.length).fill("");
  const siteAddress = await wttpSite.getAddress();
  const resourceResponse = await fetchResource(provider, siteAddress, destinationPath);
  const resourceDataPointAddresses = resourceResponse.response.resource.dataPoints;
  const resourceExists = resourceDataPointAddresses.length > 0;
  
  let chunksToUpload: number[] = [];
  
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
        royalty[i] = 0n;
      } else {
        chunksToUpload.push(i);
        royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
        totalRoyalty += royalty[i];
        console.log(`📤 Chunk ${i + 1}/${dataRegistrations.length}: ${ethers.formatEther(royalty[i])} ${currencySymbol}`);
      }
    } else {
      chunksToUpload.push(i);
      royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
      totalRoyalty += royalty[i];
      console.log(`📤 Chunk ${i + 1}/${dataRegistrations.length}: ${ethers.formatEther(royalty[i])} ${currencySymbol}`);
    }
  }
  
  console.log(`💰 Total royalty required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}`);
  console.log(`📋 Chunks to upload: ${chunksToUpload.length}/${dataRegistrations.length}`);
  
  // Check if user has sufficient balance
  const balance = await provider.getBalance(signerAddress);
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
  const charsetBytes2 = encodeCharset(charset || "");

  // Wait for gas price to be below limit if specified
  if (gasLimitGwei !== undefined) {
    console.log(`⏳ Waiting for gas price to drop below ${gasLimitGwei} gwei...`);
    await waitForGasPriceBelowLimit(provider, gasLimitGwei);
  }
  
  // Gas optimization settings for faster transactions
  const gasSettings = await getDynamicGasSettings(provider);

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
      encoding: encodeEncoding("identity"),
      language: encodeLanguage("en-US")
    },
    data: [dataRegistrations[0]]
  };

  // Early exit if no chunks need uploading and properties match
  if (chunksToUpload.length === 0 && looseEqual(resourceResponse.response.head.metadata.properties, putRequest.properties)) {
    console.log("✅ File is identical (properties and data), skipping upload");
    return resourceResponse;
  }

  let needsPUT = false;
  let patchChunks = [...chunksToUpload];

  // Check if properties are different (requires PUT)
  if (!looseEqual(resourceResponse.response.head.metadata.properties, putRequest.properties)) {
    console.log("❌ File properties are different, requires PUT");
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
      const balance = await provider.getBalance(signerAddress);
      if (balance < totalRoyalty) {
        throw new Error(`Insufficient balance after adding PUT royalty. Required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}, Available: ${ethers.formatEther(balance)} ${currencySymbol}`);
      }
    }
    
    // Wait for gas price to be below limit if specified (before PUT)
    if (gasLimitGwei !== undefined) {
      await waitForGasPriceBelowLimit(provider, gasLimitGwei);
    }
    
    console.log(`🚀 Sending PUT transaction with optimized gas settings...`);
    const tx = await wttpSite.PUT(putRequest, { 
      value: royalty[0],
      ...gasSettings
    });
    // Wait for transaction to be fully confirmed and nonce to update
    const receipt = await tx.wait(1);
    if (receipt) {
      totalGasUsed += receipt.gasUsed;
      totalRoyaltiesSpent += royalty[0];
    }
    // Small delay to ensure nonce is updated in provider (critical for Hardhat automining)
    // Hardhat automining can cause nonce conflicts if transactions are sent too rapidly
    await new Promise(resolve => setTimeout(resolve, 200));
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
      // Get fresh gas settings for each chunk
      const currentGasSettings = await getDynamicGasSettings(provider);
      
      const patchRequest = {
        head: headRequest,
        data: [dataRegistrations[chunkIndex]]
      };
    
      console.log(`🚀 Sending PATCH transaction ${i + 1} with updated gas settings...`);
      const tx = await wttpSite.PATCH(patchRequest, { 
        value: royalty[chunkIndex],
        ...currentGasSettings
      });
      // Wait for transaction to be fully confirmed (1 confirmation is enough for local testing)
      const receipt = await tx.wait(1);
      if (receipt) {
        totalGasUsed += receipt.gasUsed;
        totalRoyaltiesSpent += royalty[chunkIndex];
      }
      // Small delay to ensure nonce is updated in provider (critical for Hardhat automining)
      // Hardhat automining can cause nonce conflicts if transactions are sent too rapidly
      await new Promise(resolve => setTimeout(resolve, 200));
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
      provider,
      siteAddress, 
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
  const feeData = await provider.getFeeData();
  const effectiveGasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
  const totalGasCost = totalGasUsed * effectiveGasPrice;
  const costPerMBWei = fileSizeMB > 0 ? (totalGasCost * BigInt(1e18)) / BigInt(Math.floor(fileSizeMB * 1e18)) : 0n;
  
  // Build options string
  const optionsList: string[] = [];
  if (fileLimitBytes !== undefined) {
    optionsList.push(`filelimit=${Math.floor(fileLimitBytes / (1024 * 1024))}MB`);
  }
  if (gasLimitGwei !== undefined) {
    optionsList.push(`gaslimit=${gasLimitGwei}gwei`);
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Total gas used: ${totalGasUsed.toString()}`);
  console.log(`   Total royalties spent: ${ethers.formatEther(totalRoyaltiesSpent)} ${currencySymbol}`);
  console.log(`   Total gas cost: ${ethers.formatEther(totalGasCost)} ${currencySymbol}`);
  console.log(`   Total cost: ${ethers.formatEther(totalGasCost + totalRoyaltiesSpent)} ${currencySymbol}`);
  console.log(`   Cost per MB: ${fileSizeMB > 0 ? ethers.formatEther(costPerMBWei) : "0"} ${currencySymbol}/MB`);
  if (optionsList.length > 0) {
    console.log(`   Options: ${optionsList.join(", ")}`);
  }
  
  return fetchResult;
}
