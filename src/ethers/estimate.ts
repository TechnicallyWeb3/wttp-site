// Standalone version of estimate - works with standard ethers.js
import { ethers, Contract, Provider } from "ethers";
import fs from "fs";
import path from "path";
import { 
  encodeCharset,
  encodeMimeType, 
  normalizePath
} from "@wttp/core";
// Import artifact directly to avoid loading tasks
import {
  chunkData,
  getMimeTypeWithCharset,
  getChainSymbol,
  getEstimationGasPrice
} from "../utils";
import { fetchResource } from "./fetchResource";
// Import artifact directly to avoid loading tasks
import Web3SiteArtifact from "../../artifacts/contracts/Web3Site.sol/Web3Site.json";
import { getWttpSite } from "./utils";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks

// ESP contract ABIs
const DPS_ABI = [
  "function calculateAddress(bytes memory) public pure returns (bytes32)"
];

const DPR_ABI = [
  "function DPS() external view returns (address)",
  "function getDataPointRoyalty(bytes32) external view returns (uint256)"
];

export interface EstimateOptions {
  provider: Provider;
  gasPriceGwei?: number;
  rate?: number;
  minGasPriceGwei?: number;
}

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
  wttpSiteAddress: string,
  sourcePath: string,
  destinationPath: string,
  options: EstimateOptions
): Promise<FileEstimateResult> {
  const { provider, gasPriceGwei, rate = 2, minGasPriceGwei = 150 } = options;
  
  console.log(`📊 Estimating gas for: ${sourcePath} → ${destinationPath}`);
  
  // Get gas price for estimation
  const gasPrice = await getEstimationGasPrice(provider, gasPriceGwei, rate, minGasPriceGwei);
  console.log(`⛽ Using gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  
  // Create contract instance with proper ABI typing
  const wttpSite = getWttpSite(wttpSiteAddress, provider);
  
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
  const signerAddress = wttpSiteAddress; // Use site address as publisher for estimation
  
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: signerAddress
  }));
  
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
  let chunksToUpload: number[] = [];
  
  // Check existing resource
  let resourceResponse;
  let resourceDataPointAddresses: string[] = [];
  try {
    resourceResponse = await fetchResource(provider, wttpSiteAddress, destinationPath);
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
  
  const currencySymbol = await getChainSymbol(provider);
  console.log(`💰 Total royalty required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}`);
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
  for (let i = 0; i < chunksToUpload.length; i++) {
    const chunkIndex = chunksToUpload[i];
    const chunkRoyalty = await dpr.getDataPointRoyalty(dataPointAddresses[chunkIndex]);
    
    // PUT always expects chunkIndex: 0 in the DataRegistration
    const putRequestForChunk = {
      head: headRequest,
      properties: {
        mimeType: mimeTypeBytes2,
        charset: charsetBytes2,
        encoding: "0x6964",
        language: "0x6575"
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
      // Use conservative default
      totalGas += 200000n;
    }
  }
  
  const totalCost = totalGas * gasPrice;
  const transactionCount = chunksToUpload.length;
  const averageGas = transactionCount > 0 ? totalGas / BigInt(transactionCount) : 0n;
  
  // Calculate cost per MB
  const fileSizeMB = fileData.length / (1024 * 1024);
  const costPerMBWei = fileSizeMB > 0 ? (totalCost * BigInt(1e18)) / BigInt(Math.floor(fileSizeMB * 1e18)) : 0n;
  
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
    needsPUT: true,
    gasPrice
  };
}

// Directory estimation - simplified version
export interface DirectoryEstimateResult {
  totalGas: bigint;
  totalCost: bigint;
  totalRoyaltyCost: bigint;
  totalTransactions: number;
  fileCount: number;
  directoryCount: number;
  gasPrice: bigint;
}

export async function estimateDirectory(
  wttpSiteAddress: string,
  sourcePath: string,
  destinationPath: string,
  options: EstimateOptions
): Promise<DirectoryEstimateResult> {
  const { provider, gasPriceGwei, rate = 2, minGasPriceGwei = 150 } = options;
  
  console.log(`📊 Estimating gas for directory: ${sourcePath} → ${destinationPath}`);
  
  // Get gas price for estimation
  const gasPrice = await getEstimationGasPrice(provider, gasPriceGwei, rate, minGasPriceGwei);
  console.log(`⛽ Using gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
  
  // Create contract instance with proper ABI typing
  const wttpSite = getWttpSite(wttpSiteAddress, provider);
  
  // This is a simplified version - for full implementation, see src/scripts/uploadDirectory.ts
  // For now, estimate each file individually
  const { createWTTPIgnore } = await import("../scripts/wttpIgnore");
  
  // Helper to get all files recursively
  const getAllFiles = (dirPath: string, wttpIgnore: any, arrayOfFiles: string[] = []): string[] => {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
        return;
      }
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, wttpIgnore, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });
    return arrayOfFiles;
  };
  
  const wttpIgnore = createWTTPIgnore(sourcePath, { includeDefaults: true });
  const allFiles = getAllFiles(sourcePath, wttpIgnore);
  
  let totalGas = 0n;
  let totalRoyaltyCost = 0n;
  let totalTransactions = 0;
  let fileCount = 0;
  
  // Estimate DEFINE for root directory (conservative)
  totalGas += 50000n;
  totalTransactions += 1;
  
  // Estimate each file
  for (const filePath of allFiles) {
    const relativePath = path.relative(sourcePath, filePath);
    const fullDestPath = path.join(destinationPath, relativePath).replace(/\\/g, '/');
    
    try {
      const fileEstimate = await estimateFile(wttpSiteAddress, filePath, fullDestPath, {
        provider,
        gasPriceGwei,
        rate,
        minGasPriceGwei
      });
      totalGas += fileEstimate.totalGas;
      totalRoyaltyCost += fileEstimate.royaltyCost;
      totalTransactions += fileEstimate.transactionCount;
      fileCount++;
    } catch (error) {
      console.error(`❌ Failed to estimate file ${relativePath}:`, error);
    }
  }
  
  const totalCost = totalGas * gasPrice;
  const currencySymbol = await getChainSymbol(provider);
  
  console.log(`\n📊 Directory Estimation Summary:`);
  console.log(`   Total gas: ${totalGas.toString()}`);
  console.log(`   Total cost: ${ethers.formatEther(totalCost)} ${currencySymbol}`);
  console.log(`   Total royalty cost: ${ethers.formatEther(totalRoyaltyCost)} ${currencySymbol}`);
  console.log(`   Total transactions: ${totalTransactions}`);
  console.log(`   Files: ${fileCount}`);
  
  return {
    totalGas,
    totalCost,
    totalRoyaltyCost,
    totalTransactions,
    fileCount,
    directoryCount: 1, // Simplified
    gasPrice
  };
}
