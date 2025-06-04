import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { Web3Site } from "../typechain-types";
import { getMimeType, mimeTypeToBytes2 } from "./uploadFile";
import { uploadFile } from "./uploadFile";

// Constants
const WTTP_VERSION = "WTTP/3.0";

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

// Helper function to get all files in a directory recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (isDirectory(fullPath)) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// Helper function to get all directories in a directory recursively
function getAllDirectories(dirPath: string, basePath: string, arrayOfDirs: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  const relativeDirPath = path.relative(basePath, dirPath);
  
  if (relativeDirPath) {
    arrayOfDirs.push(relativeDirPath);
  }

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (isDirectory(fullPath)) {
      arrayOfDirs = getAllDirectories(fullPath, basePath, arrayOfDirs);
    }
  });

  return arrayOfDirs;
}

// Helper function to determine the index file for a directory
function findIndexFile(dirPath: string): string | null {
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
  
  for (const indexFile of indexPriority) {
    if (files.includes(indexFile)) {
      return indexFile;
    }
  }
  
  return null;
}

// Helper function to create directory metadata
function createDirectoryMetadata(dirPath: string, basePath: string): Record<string, any> {
  const files = fs.readdirSync(dirPath);
  const directoryMetadata: Record<string, any> = {};
  
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
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

// Main upload directory function
export async function uploadDirectory(
  wtppSite: Web3Site,
  sourcePath: string,
  destinationPath: string
) {
  console.log(`Uploading directory ${sourcePath} to ${destinationPath}...`);
  
  if (!isDirectory(sourcePath)) {
    throw new Error(`Source path ${sourcePath} is not a directory`);
  }
  
  // Normalize destination path to ensure it ends with a slash
  if (!destinationPath.endsWith("/")) {
    destinationPath += "/";
  }
  
  // Find the index file for the directory
  const indexFile = findIndexFile(sourcePath);
  const indexLocation = indexFile ? `./${indexFile}` : "directory:"; // Default to index.html even if it doesn't exist
  
  // Create directory metadata
  const directoryMetadata = createDirectoryMetadata(sourcePath, sourcePath);
  const directoryMetadataJson = JSON.stringify(directoryMetadata, null, 2);
  
  // Prepare for upload
  const signer = await ethers.provider.getSigner();
  const signerAddress = await signer.getAddress();
  
  // Get the DPS and DPR contracts for reuse
  const dpsAddress = await wtppSite.DPS();
  const dps = await ethers.getContractAt("DataPointStorage", dpsAddress);
  const dprAddress = await wtppSite.DPR();
  const dpr = await ethers.getContractAt("DataPointRegistry", dprAddress);
  
  // Check if resource exists
  const headRequest = {
    requestLine: {
      protocol: WTTP_VERSION,
      path: destinationPath,
      method: 1 // HEAD
    },
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };
  
  const headResponse = await wtppSite.HEAD(headRequest);
  const resourceExists = headResponse.responseLine.code !== 404n;
  
  // Upload the directory metadata with redirect header
  console.log("Uploading directory metadata with redirect header...");
  
  // First, we need to create a temporary file with the directory metadata
  const tempMetadataPath = path.join(process.cwd(), "temp_directory_metadata.json");
  fs.writeFileSync(tempMetadataPath, directoryMetadataJson);
  
  // Read the file data
  const fileData = fs.readFileSync(tempMetadataPath);
  
  // Chunk the data
  const CHUNK_SIZE = 32 * 1024; // 32KB chunks
  const chunks: Buffer[] = [];
  for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
    chunks.push(fileData.slice(i, i + CHUNK_SIZE));
  }
  
  // Prepare data registrations
  const dataRegistrations = chunks.map((chunk, index) => ({
    data: chunk,
    chunkIndex: index,
    publisher: signerAddress
  }));
  
  let royalty = [0n];
  
  // Check royalties for the first chunk
  const dataPointAddress = await dps.calculateAddress(dataRegistrations[0].data);
  royalty[0] = await dpr.getDataPointRoyalty(dataPointAddress);
  
  // Check if the directory already exists
  if (resourceExists) {
    console.log(`Directory ${destinationPath} already exists, updating...`);
    
    // Use PATCH to update the existing directory
    const patchRequest = {
      head: headRequest,
      data: [dataRegistrations[0]]
    };
    
    const tx = await wtppSite.PATCH(patchRequest, { value: royalty[0] });
    await tx.wait();
    console.log("Directory updated successfully!");
    
    // Use DEFINE to ensure the directory has the correct headers
    const defineRequest = {
      head: headRequest,
      data: {
        methods: 65535, // All methods allowed (2^16 - 1)
        cache: {
          maxAge: 0,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: false
        },
        redirect: {
          code: 300, // Multiple Choices
          location: indexLocation
        },
        resourceAdmin: ethers.ZeroHash
      }
    };
    
    const defineTx = await wtppSite.DEFINE(defineRequest);
    await defineTx.wait();
    console.log("Directory headers updated successfully!");
  } else {
    // Use PUT to create the directory resource with custom headers
    console.log(`Creating directory ${destinationPath}...`);

    const putRequest = {
      head: headRequest,
      mimeType: "0x0001", // indicates directory
      charset: "0x0000", // No metadata
      encoding: "0x0000", // No metadata
      language: "0x0000", // No metadata
      data: [dataRegistrations[0]],
      headers: [
        {
          name: "Status",
          value: "300" // Multiple Choices
        },
        {
          name: "Location",
          value: indexLocation
        }
      ]
    };
    
    const tx = await wtppSite.PUT(putRequest, { value: royalty[0] });
    await tx.wait();
    console.log("Directory created successfully!");
    
    // Use DEFINE to ensure the directory has the correct headers
    const defineRequest = {
      head: headRequest,
      data: {
        methods: 65535, // All methods allowed (2^16 - 1)
        cache: {
          maxAge: 0,
          noStore: false,
          noCache: false,
          immutableFlag: false,
          publicFlag: false
        },
        redirect: {
          code: 300, // Multiple Choices
          location: indexLocation
        },
        resourceAdmin: ethers.ZeroHash
      }
    };
    
    const defineTx = await wtppSite.DEFINE(defineRequest);
    await defineTx.wait();
    console.log("Directory headers updated successfully!");
  }
  
  // Upload remaining chunks if any
  for (let i = 1; i < dataRegistrations.length; i++) {
    // Check royalty for this chunk
    const dataPointAddress = await dps.calculateAddress(dataRegistrations[i].data);
    royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
    
    // Use PATCH to update existing resource
    console.log(`Uploading chunk ${i}...`);
    const patchRequest = {
      head: headRequest,
      data: [dataRegistrations[i]]
    };
  
    const tx = await wtppSite.PATCH(patchRequest, { value: royalty[i] });
    await tx.wait();
    console.log(`Chunk ${i} uploaded successfully!`);
  }
  
  // Clean up the temporary file
  fs.unlinkSync(tempMetadataPath);
  
  // Upload all files in the directory
  const allFiles = getAllFiles(sourcePath);
  
  for (const file of allFiles) {
    const relativePath = path.relative(sourcePath, file);
    const destinationFilePath = path.join(destinationPath, relativePath).replace(/\\/g, '/');
    
    console.log(`Uploading file ${file} to ${destinationFilePath}...`);
    await uploadFile(wtppSite, file, destinationFilePath);
  }
  
  // Create all subdirectories
  const allDirectories = getAllDirectories(sourcePath, sourcePath);
  
  for (const dir of allDirectories) {
    const fullSourceDirPath = path.join(sourcePath, dir);
    const destinationDirPath = path.join(destinationPath, dir).replace(/\\/g, '/') + '/';
    
    console.log(`Creating directory ${destinationDirPath}...`);
    
    // Find the index file for the subdirectory
    const subDirIndexFile = findIndexFile(fullSourceDirPath);
    const subDirIndexLocation = subDirIndexFile ? `./${subDirIndexFile}` : "./index.html";
    
    // Create subdirectory metadata
    const subDirMetadata = createDirectoryMetadata(fullSourceDirPath, sourcePath);
    const subDirMetadataJson = JSON.stringify(subDirMetadata, null, 2);
    
    // Write subdirectory metadata to a temporary file
    const tempSubDirMetadataPath = path.join(process.cwd(), `temp_${dir.replace(/[\/\\]/g, '_')}_metadata.json`);
    fs.writeFileSync(tempSubDirMetadataPath, subDirMetadataJson);
    
    // Read the file data
    const fileData = fs.readFileSync(tempSubDirMetadataPath);
    
    // Chunk the data
    const CHUNK_SIZE = 32 * 1024; // 32KB chunks
    const chunks: Buffer[] = [];
    for (let i = 0; i < fileData.length; i += CHUNK_SIZE) {
      chunks.push(fileData.slice(i, i + CHUNK_SIZE));
    }
    
    // Prepare data registrations
    const dataRegistrations = chunks.map((chunk, index) => ({
      data: chunk,
      chunkIndex: index,
      publisher: signerAddress
    }));
    
    let royalty = [0n];
    
    // Check royalties for the first chunk
    const dataPointAddress = await dps.calculateAddress(dataRegistrations[0].data);
    royalty[0] = await dpr.getDataPointRoyalty(dataPointAddress);
    
    // Create subdirectory head request
    const subDirHeadRequest = {
      requestLine: {
        protocol: WTTP_VERSION,
        path: destinationDirPath,
        method: 1 // HEAD
      },
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };
    
    // Check if subdirectory already exists
    const subDirHeadResponse = await wtppSite.HEAD(subDirHeadRequest);
    const subDirExists = subDirHeadResponse.responseLine.code !== 404n;
    
    if (subDirExists) {
      // Use PATCH to update the existing subdirectory
      console.log(`Subdirectory ${destinationDirPath} already exists, updating...`);
      const patchRequest = {
        head: subDirHeadRequest,
        data: [dataRegistrations[0]]
      };
      
      const tx = await wtppSite.PATCH(patchRequest, { value: royalty[0] });
      await tx.wait();
      console.log(`Subdirectory ${destinationDirPath} updated successfully!`);
      
      // Use DEFINE to ensure the subdirectory has the correct headers
      const defineRequest = {
        head: subDirHeadRequest,
        data: {
          methods: 65535, // All methods allowed (2^16 - 1)
          cache: {
            maxAge: 0,
            noStore: false,
            noCache: false,
            immutableFlag: false,
            publicFlag: false
          },
          redirect: {
            code: 300, // Multiple Choices
            location: subDirIndexLocation
          },
          resourceAdmin: ethers.ZeroHash
        }
      };
      
      const defineTx = await wtppSite.DEFINE(defineRequest);
      await defineTx.wait();
      console.log(`Subdirectory ${destinationDirPath} headers updated successfully!`);
    } else {
      // Use PUT to create the subdirectory resource with custom headers
      console.log(`Creating subdirectory ${destinationDirPath} with redirect header...`);
      const putRequest = {
        head: subDirHeadRequest,
        mimeType: "0x0001", // Directory mime type
        charset: "0x0000", // No metadata
        encoding: "0x0000", // No metadata
        language: "0x0000", // No metadata
        data: [dataRegistrations[0]],
        headers: [
          {
            name: "Status",
            value: "300" // Multiple Choices
          },
          {
            name: "Location",
            value: subDirIndexLocation
          }
        ]
      };
    
      const tx = await wtppSite.PUT(putRequest, { value: royalty[0] });
      await tx.wait();
      console.log(`Subdirectory ${destinationDirPath} created successfully!`);
      
      // Use DEFINE to ensure the subdirectory has the correct headers
      const defineRequest = {
        head: subDirHeadRequest,
        data: {
          methods: 65535, // All methods allowed (2^16 - 1)
          cache: {
            maxAge: 0,
            noStore: false,
            noCache: false,
            immutableFlag: false,
            publicFlag: false
          },
          redirect: {
            code: 300, // Multiple Choices
            location: subDirIndexLocation
          },
          resourceAdmin: ethers.ZeroHash
        }
      };
      
      const defineTx = await wtppSite.DEFINE(defineRequest);
      await defineTx.wait();
      console.log(`Subdirectory ${destinationDirPath} headers updated successfully!`);
    }
    
    // Upload remaining chunks if any
    for (let i = 1; i < dataRegistrations.length; i++) {
      // Check royalty for this chunk
      const dataPointAddress = await dps.calculateAddress(dataRegistrations[i].data);
      royalty[i] = await dpr.getDataPointRoyalty(dataPointAddress);
      
      // Use PATCH to update existing resource
      console.log(`Uploading chunk ${i} for subdirectory ${destinationDirPath}...`);
      const patchRequest = {
        head: subDirHeadRequest,
        data: [dataRegistrations[i]]
      };
    
      const tx = await wtppSite.PATCH(patchRequest, { value: royalty[i] });
      await tx.wait();
      console.log(`Chunk ${i} for subdirectory ${destinationDirPath} uploaded successfully!`);
    }
    
    // Clean up the temporary file
    fs.unlinkSync(tempSubDirMetadataPath);
  }
  
  console.log(`Directory ${sourcePath} uploaded successfully to ${destinationPath}`);
  return true;
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
  const wtppSite = await ethers.getContractAt("Web3Site", siteAddress);
  
  // Upload the directory
  await uploadDirectory(wtppSite, sourcePath, destinationPath);
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