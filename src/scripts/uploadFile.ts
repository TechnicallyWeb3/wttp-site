import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { 
  encodeCharset,
  encodeMimeType, 
  IBaseWTTPSite, 
  LOCATEResponseStruct, 
  MimeType,
  Charset
} from "@wttp/core";
import mime from "mime-types";
import { fetchResource } from "./fetchResource";
import { normalizePath } from "./pathUtils";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const WTTP_FILE_WARN = 100 * 1024 * 1024; // 100MB warning
const WTTP_FILE_LIMIT = 400 * 1024 * 1024; // 400MB limit

// Helper function to loosely compare two objects
export function looseEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  const values1: any[] = Object.values(obj1);
  const values2: any[] = Object.values(obj2);
  
  if (values1.length !== values2.length) return false;
  
  for (let i = 0; i < values1.length; i++) {
    if (
      typeof values1[i] === 'object' ||
      typeof values2[i] === 'object'
    ) {
      if(!looseEqual(values1[i], values2[i])) return false;
    } else {
      if (values1[i].toString() != values2[i].toString()) return false;
    }
  }
  
  return true;
}

// Helper function to chunk file data
function chunkData(data: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to determine MIME type from file extension
export function getMimeType(filePath: string): string {
  // Special case for directories
  if (path.extname(filePath) === "") {
    return "directory";
  }
  
  // Use mime-types package for lookup
  const mimeType = mime.lookup(filePath);
  return mimeType ? mimeType.toString() : "application/octet-stream";
}

// Helper function to get dynamic gas settings based on current network conditions
export async function getDynamicGasSettings() {
  try {
    // Get current network fee data
    const feeData = await ethers.provider.getFeeData();
    console.log(`🔍 Current network gas prices - Max Fee: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : "N/A"} gwei, Priority Fee: ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : "N/A"} gwei`);
    
    // Apply 25% buffer for faster confirmation
    const bufferMultiplier = 1.25;
    
    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;
    
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      // EIP-1559 network (Ethereum mainnet, etc.)
      maxFeePerGas = BigInt(Math.floor(Number(feeData.maxFeePerGas) * bufferMultiplier));
      maxPriorityFeePerGas = BigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * bufferMultiplier));
    } else if (feeData.gasPrice) {
      // Legacy network pricing
      const bufferedGasPrice = BigInt(Math.floor(Number(feeData.gasPrice) * bufferMultiplier));
      maxFeePerGas = bufferedGasPrice;
      maxPriorityFeePerGas = ethers.parseUnits("2", "gwei"); // Minimum tip
    } else {
      // Fallback to reasonable defaults with buffer
      console.warn("⚠️ Could not fetch network gas prices, using fallback values");
      maxFeePerGas = ethers.parseUnits("62.5", "gwei"); // 50 * 1.25
      maxPriorityFeePerGas = ethers.parseUnits("2.5", "gwei"); // 2 * 1.25
    }
    
    const gasSettings = {
      // Let ethers.js estimate gasLimit automatically for each transaction
      maxFeePerGas,
      maxPriorityFeePerGas
    };
    
    console.log(`⚡ Optimized gas settings - Max Fee: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei, Priority Fee: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei (25% buffer applied)`);
    
    return gasSettings;
  } catch (error) {
    console.error("❌ Error fetching gas prices:", error);
    // Fallback to reasonable defaults
    return {
      // Let ethers.js estimate gasLimit automatically
      maxFeePerGas: ethers.parseUnits("50", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei")
    };
  }
}

// Main upload function with enhanced error handling and validation
export async function uploadFile(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string
) {
  console.log(`🚀 Starting upload: ${sourcePath} → ${destinationPath}`);
  
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
  
  // Validate file size
  if (fileData.length === 0) {
    throw new Error("Cannot upload empty file");
  }
  if (fileData.length > WTTP_FILE_WARN) { // 100MB limit
    if (fileData.length > WTTP_FILE_LIMIT) {
      throw new Error("❌  File size exceeds 400MB limit. Upload aborted.");
    }
    console.warn("⚠️  Large file detected (>100MB). Upload may take significant time and gas.");
  }

  let resourceExists = false;
  try{
    let existingResource = await fetchResource(await wttpSite.getAddress(), destinationPath);
    let existingData = existingResource.content;
    if (existingData && Buffer.from(existingData).equals(fileData)) {
      return existingResource;
    }
    resourceExists = true;
  } catch (error) {
    console.log(`No resource found at ${destinationPath}, uploading...`);
  }
  
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
  
  // Check royalties for each chunk before uploading
  console.log(`📊 Calculating royalties for ${dataRegistrations.length} chunks...`);
  for (let i = 0; i < dataRegistrations.length; i++) {
    const chunk = dataRegistrations[i];
    
    // Calculate the data point address
    const dataPointAddress = await dps.calculateAddress(chunk.data);
    
    // Get the royalty
    royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
    totalRoyalty += royalty[i];
    
    console.log(`Chunk ${i + 1}/${dataRegistrations.length}: ${ethers.formatEther(royalty[i])} ETH`);
  }
  
  console.log(`💰 Total royalty required: ${ethers.formatEther(totalRoyalty)} ETH`);
  
  // Check if user has sufficient balance
  const balance = await ethers.provider.getBalance(signerAddress);
  if (balance < totalRoyalty) {
    throw new Error(`Insufficient balance. Required: ${ethers.formatEther(totalRoyalty)} ETH, Available: ${ethers.formatEther(balance)} ETH`);
  }

    
  // Get MIME type
  const mimeType = getMimeType(sourcePath).split("; charset=");
  // const charset = mimeType.split("; charset=")[1] || "utf-8";
  const mimeTypeBytes2 = encodeMimeType(mimeType[0]);
  const charsetBytes2 = encodeCharset(mimeType[1]);

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

  // compare properties against head.metadata.properties
  const response = await fetchResource(await wttpSite.getAddress(), destinationPath);
  if (looseEqual(response.response.head.metadata.properties, putRequest.properties)) {
    // check if data is the same
    if (Buffer.compare(ethers.getBytes(response.content || "0x"), fileData) === 0) {
      console.log("File data is the same, skipping upload");
      return response;
    }
  }
  // if (head.response.head.metadata.properties.mimeType !== mimeTypeBytes2) {
  //   throw new Error(`Mime type mismatch: ${head.response.head.metadata.properties.mimeType} !== ${mimeTypeBytes2}`);
  // }
  // if (head.response.head.metadata.properties.charset !== "0x7508") {
    
  console.log(`🚀 Sending PUT transaction with optimized gas settings...`);
  const tx = await wttpSite.PUT(putRequest, { 
    value: royalty[0],
    ...gasSettings // TODO: Uncomment this when gas settings are working
  });
  await tx.wait();
  console.log("File created successfully!");

  // Upload remaining chunks with progress reporting
  for (let i = 1; i < dataRegistrations.length; i++) {
    console.log(`📤 Uploading chunk ${i + 1}/${dataRegistrations.length} (${Math.round((i + 1) / dataRegistrations.length * 100)}%)`);
    
    try {
      // Get fresh gas settings for each chunk to adapt to network conditions
      const currentGasSettings = await getDynamicGasSettings();
      
      const patchRequest = {
        head: headRequest,
        data: [dataRegistrations[i]]
      };
    
      console.log(`🚀 Sending PATCH transaction ${i + 1} with updated gas settings...`);
      const tx = await wttpSite.PATCH(patchRequest, { 
        value: royalty[i],
        ...currentGasSettings // TODO: Uncomment this when gas settings are working
      });
      await tx.wait();
      console.log(`✅ Chunk ${i + 1} uploaded successfully (${ethers.formatEther(royalty[i])} ETH)`);
    } catch (error) {
      console.error(`❌ Failed to upload chunk ${i + 1}:`, error);
      throw new Error(`Upload failed at chunk ${i + 1}: ${error}`);
    }
  }

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
  return fetchResult;
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