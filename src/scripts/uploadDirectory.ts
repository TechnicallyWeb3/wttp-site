import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { IBaseWTTPSite, READ_ONLY_PUBLIC_HEADER } from "@wttp/core";
import { getMimeType, mimeTypeToBytes2 } from "./uploadFile";
import { uploadFile } from "./uploadFile";
import { DEFINERequestStruct, HEADRequestStruct } from "@wttp/core";
import { normalizePath } from "./pathUtils";

const MAX_CHUNK_SIZE = 32 * 1024;

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



// Main upload directory function with enhanced error handling and validation
export async function uploadDirectory(
  wttpSite: IBaseWTTPSite,
  sourcePath: string,
  destinationPath: string
) {
  console.log(`🚀 Starting directory upload: ${sourcePath} → ${destinationPath}`);
  
  // Parameter validation
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }
  if (!isDirectory(sourcePath)) {
    throw new Error(`Source path ${sourcePath} is not a directory`);
  }
  
  destinationPath = normalizePath(destinationPath);
  
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
    const directoryMetadata = createDirectoryMetadata(sourcePath, sourcePath);
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
  
  // Upload the directory metadata with redirect header
  console.log("Uploading directory metadata with redirect header...");
  
  let requestHead: HEADRequestStruct = {
    path: destinationPath,
    ifModifiedSince: 0,
    ifNoneMatch: ethers.ZeroHash
  };

  const defineRequest: DEFINERequestStruct = {
    head: requestHead,
    data: {
      ...READ_ONLY_PUBLIC_HEADER,
      redirect: {
        code: redirectCode,
        location: indexLocation
      }
    }
  };
    
  const defineTx = await wttpSite.DEFINE(defineRequest);
  await defineTx.wait();
  console.log(`Directory ${destinationPath} created successfully!`);
  
  // Clean up the temporary file
  if (tempMetadataPath) {
    fs.unlinkSync(tempMetadataPath);
  }
  
  // Process all items in the directory
  const items = fs.readdirSync(sourcePath);

  for (const item of items) {
    const fullSourcePath = path.join(sourcePath, item);
    const fullDestPath = path.join(destinationPath, item).replace(/\\/g, '/');
    
    try {
      if (isDirectory(fullSourcePath)) {
        // Recursively handle subdirectories
        await uploadDirectory(wttpSite, fullSourcePath, fullDestPath);
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
  
  // Upload the directory
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