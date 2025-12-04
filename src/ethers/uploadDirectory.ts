// Standalone version of uploadDirectory - works with standard ethers.js
import { ethers, Contract, Provider, Signer } from "ethers";
import fs from "fs";
import path from "path";
import { 
  DEFAULT_HEADER,
  type DEFINERequestStruct, 
  normalizePath
} from "@wttp/core";
// Import artifact directly to avoid loading tasks
import {
  getChainSymbol,
  getDynamicGasSettings
} from "../utils";
import { uploadFile } from "./uploadFile";
import { fetchResource } from "./fetchResource";
import { createWTTPIgnore, WTTPIgnoreOptions } from "../scripts/wttpIgnore";
import { getWttpSite } from "./utils";

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

// Helper function to find index files in a directory
function findIndexFiles(dirPath: string): string[] {
  const indexFiles = ["index.html", "index.htm"];
  const foundIndexFiles: string[] = [];
  
  for (const indexFile of indexFiles) {
    const fullPath = path.join(dirPath, indexFile);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      foundIndexFiles.push(indexFile);
    }
  }
  
  return foundIndexFiles;
}

// Helper function to create directory metadata
function createDirectoryMetadata(dirPath: string, basePath: string, wttpIgnore: any): Record<string, any> {
  const directoryMetadata: Record<string, any> = {};
  const files = fs.readdirSync(dirPath);
  
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
      return;
    }
    
    if (isDirectory(fullPath)) {
      directoryMetadata[file] = {
        type: "directory",
        path: path.relative(basePath, fullPath).replace(/\\/g, '/')
      };
    } else {
      directoryMetadata[file] = {
        type: "file",
        path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
        size: fs.statSync(fullPath).size
      };
    }
  });
  
  return { "directory": directoryMetadata };
}

export interface UploadDirectoryOptions {
  provider: Provider;
  signer: Signer;
  ignoreOptions?: WTTPIgnoreOptions;
  fileLimitBytes?: number;
  gasLimitGwei?: number;
}

// Main upload directory function
export async function uploadDirectory(
//   wttpSite: Contract,
  wttpSiteAddress: string,
  sourcePath: string,
  destinationPath: string,
  options: UploadDirectoryOptions
) {
  const { provider, signer, ignoreOptions, fileLimitBytes, gasLimitGwei } = options;
  const wttpSite = getWttpSite(wttpSiteAddress, provider, signer);
  console.log(`🚀 Starting directory upload: ${sourcePath} → ${destinationPath}`);
  
  // Get currency symbol
  const currencySymbol = await getChainSymbol(provider);
  
  // Track gas and royalties for summary
  let totalGasUsed = 0n;
  let totalRoyaltiesSpent = 0n;
  let totalFileSize = 0;
  
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
      await uploadFile(wttpSiteAddress, tempMetadataPath, destinationPath, {
        provider,
        signer,
        fileLimitBytes,
        gasLimitGwei
      });
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
    const existingResource = await fetchResource(provider, siteAddress, destinationPath, { headRequest: true });
    
    if (existingResource.response.head.status !== 404n) {
      // Resource exists, check if we need to update
      shouldDefine = false; // Simplified - in full version would compare headers
    }
  } catch (error) {
    // Resource doesn't exist, we need to define it
    shouldDefine = true;
  }

  // Define the directory if needed
  if (shouldDefine) {
    const requestHead = {
      path: destinationPath,
      ifModifiedSince: 0,
      ifNoneMatch: ethers.ZeroHash
    };

    const defineRequest: DEFINERequestStruct = {
      head: requestHead,
      data: newHeaderData
    };
      
    console.log(`🚀 Sending DEFINE transaction with optimized gas settings...`);
    const gasSettings = await getDynamicGasSettings(provider);
    // wttpSite is already created with signer via getWttpSite, so use it directly
    const defineTx = await wttpSite.DEFINE(defineRequest, gasSettings);
    // Wait for transaction to be fully confirmed
    const defineReceipt = await defineTx.wait(1);
    if (defineReceipt) {
      totalGasUsed += defineReceipt.gasUsed;
    }
    // Small delay to ensure nonce is updated in provider (critical for Hardhat automining)
    // Hardhat automining can cause nonce conflicts if transactions are sent too rapidly
    await new Promise(resolve => setTimeout(resolve, 200));
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
        // Recursively upload subdirectory
        await uploadDirectory(wttpSiteAddress, fullSourcePath, fullDestPath, options);
      } else {
        // Upload file
        const fileSize = fs.statSync(fullSourcePath).size;
        totalFileSize += fileSize;
        
        await uploadFile(wttpSiteAddress, fullSourcePath, fullDestPath, {
          provider,
          signer,
          fileLimitBytes,
          gasLimitGwei
        });
      }
    } catch (error) {
      console.error(`❌ Failed to upload ${item}:`, error);
      throw error;
    }
  }

  console.log(`🎉 Directory upload completed!`);
  console.log(`📊 Total file size: ${(totalFileSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`⛽ Total gas used: ${totalGasUsed.toString()}`);
  console.log(`💰 Total royalties spent: ${ethers.formatEther(totalRoyaltiesSpent)} ${currencySymbol}`);
}
