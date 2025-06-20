import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { IBaseWTTPSite, LOCATEResponseStruct } from "@wttp/core";
import mime from "mime-types";
import { fetchResource } from "./fetchResource";
import { normalizePath } from "./pathUtils";

// Constants
const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const WTTP_FILE_WARN = 100 * 1024 * 1024; // 100MB warning
const WTTP_FILE_LIMIT = 400 * 1024 * 1024; // 400MB limit

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

// Helper function to convert MIME type to bytes2
export function mimeTypeToBytes2(mimeType: string): string {
  // Map MIME types to 2-byte identifiers using 1-letter codes
  const mimeTypeMap: Record<string, string> = {
    'text/html': '0x7468', // th
    'text/javascript': '0x616a', // aj (defaults to application/javascript)
    'text/css': '0x7463', // tc 
    'text/markdown': '0x746d', // tm
    'text/plain': '0x7470', // tp
    'application/javascript': '0x616a', // aj
    'application/xml': '0x6178', // ax
    'application/pdf': '0x6170', // ap
    'application/json': '0x616f', // ao (object)
    'image/png': '0x6970', // ip
    'image/jpeg': '0x696a', // ij
    'image/gif': '0x6967', // ig
    'image/svg+xml': '0x6973', // is
    'image/webp': '0x6977', // iw
    'image/x-icon': '0x6969', // ii
    'font/ttf': '0x6674', // ft
    'font/otf': '0x666f', // fo
    'font/woff': '0x6677', // fw
    'font/woff2': '0x6632', // f2
    'application/octet-stream': '0x6273' // bs (binary stream)
  };
  return mimeTypeMap[mimeType] || '0x6273'; // Default to binary stream
}

export function bytes2ToMimeType(bytes2Value: string): string {
  // Map 2-byte identifiers back to MIME types
  const bytes2ToMimeMap: Record<string, string> = {
    '0x7468': 'text/html',                // th
    '0x616a': 'application/javascript',   // aj
    '0x7463': 'text/css',                 // tc
    '0x746d': 'text/markdown',            // tm
    '0x7470': 'text/plain',               // tp
    '0x6178': 'application/xml',          // ax
    '0x6170': 'application/pdf',          // ap
    '0x616f': 'application/json',         // ao
    '0x6970': 'image/png',                // ip
    '0x696a': 'image/jpeg',               // ij
    '0x6967': 'image/gif',                // ig
    '0x6973': 'image/svg+xml',            // is
    '0x6977': 'image/webp',               // iw
    '0x6969': 'image/x-icon',             // ii
    '0x6674': 'font/ttf',                 // ft
    '0x666f': 'font/otf',                 // fo
    '0x6677': 'font/woff',                // fw
    '0x6632': 'font/woff2',               // f2
    '0x6273': 'application/octet-stream'  // bs
  };
  
  return bytes2ToMimeMap[bytes2Value] || 'application/octet-stream'; // Default to binary stream
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
  const mimeType = getMimeType(sourcePath).split("; charset=")[0];
  // const charset = mimeType.split("; charset=")[1] || "utf-8";
  const mimeTypeBytes2 = mimeTypeToBytes2(mimeType);

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
      charset: "0x7556", // u8 = utf-8
      encoding: "0x6964", // id = identity
      language: "0x6575" // eu = english-US
    },
    data: [dataRegistrations[0]]
  };
    
  const tx = await wttpSite.PUT(putRequest, { value: royalty[0] });
  await tx.wait();
  console.log("File created successfully!");

  // Upload remaining chunks with progress reporting
  for (let i = 1; i < dataRegistrations.length; i++) {
    console.log(`📤 Uploading chunk ${i + 1}/${dataRegistrations.length} (${Math.round((i + 1) / dataRegistrations.length * 100)}%)`);
    
    try {
      const patchRequest = {
        head: headRequest,
        data: [dataRegistrations[i]]
      };
    
      const tx = await wttpSite.PATCH(patchRequest, { value: royalty[i] });
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