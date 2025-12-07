import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { 
  encodeCharset,
  encodeMimeType,
  encodeEncoding,
  encodeLanguage,
  IBaseWTTPSite,
  normalizePath
} from "@wttp/core";
import { getMimeTypeWithCharset, getChainSymbol } from "./uploadFile";
import { createWTTPIgnore, WTTPIgnoreOptions } from "./wttpIgnore";

const CHUNK_SIZE = 32 * 1024; // 32KB chunks
const DPS_VERSION = 2; // Default DPS version

// Local chunk address calculation (deterministic hash)
// This matches the DPS contract's calculateAddress method
// Returns bytes32 (32 bytes), not an address (20 bytes)
function calculateChunkAddressLocal(data: Buffer, version: number = DPS_VERSION): string {
  // Match Solidity: keccak256(abi.encodePacked(_data, _version))
  const encoded = ethers.solidityPacked(['bytes', 'uint8'], [data, version]);
  return ethers.keccak256(encoded);
}

// Test config for estimation (optional)
export interface TestConfig {
  network: string;
  siteAddress: string;
  dpsVersion?: number;
}

// External storage rule interface
export interface ExternalStorageRule {
  minSizeBytes?: number;
  maxSizeBytes?: number;
  mimeTypes?: string[];
  extensions?: string[];
  provider: "arweave" | "ipfs" | "filecoin";
  redirectCode?: number; // Default 301
}

export interface ManifestConfig {
  gasLimit?: number;
  fileLimit?: number;
  ignorePattern?: string[] | string | "none";
  externalStorageRules?: ExternalStorageRule[];
  testConfig?: TestConfig;
  destination?: string; // Destination path on WTTP site
  publisher?: string; // Optional publisher address for all files/chunks in this manifest
}

export interface ChunkData {
  address: string;
  estimate?: number;
  range?: string;
  royalty?: number;
  gas?: number;
  txHash?: string;
  prerequisite?: string;
  publisher?: string;
}

export interface FileData {
  path: string;
  type: string;
  charset?: string;
  encoding?: string;
  language?: string;
  size: number;
  status: string;
  gasCost?: number;
  royaltyCost?: number;
  externalStorage?: string;
  redirect?: {
    code: number;
    location: string;
  };
  chunks: ChunkData[];
  publisher?: string;
}

export interface DirectoryData {
  path: string;
  index: string;
  status?: string; // pending, complete, error
  txHash?: string; // Transaction hash for DEFINE
}

export interface TransactionData {
  txHash?: string;
  method: string;
  path?: string; // File or directory path
  chunkAddress?: string;
  range?: string; // Byte range for chunks
  redirect?: {
    code: number;
    location: string;
  };
  value?: number;
  gasUsed?: number;
  data?: any;
}

export interface Manifest {
  name: string;
  path: string;
  wttpConfig?: ManifestConfig;
  siteData: {
    directories: DirectoryData[];
    files: FileData[];
  };
  chainData?: {
    contractAddress: string;
    chainId: number;
    name: string;
    symbol: string;
    transactions: TransactionData[];
    publisher?: string;
  };
}

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

// Helper to get all files recursively
function getAllFiles(dirPath: string, wttpIgnore: any, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
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

// Helper to get all directories recursively
function getAllDirectories(dirPath: string, basePath: string, wttpIgnore: any, arrayOfDirs: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  const relativeDirPath = path.relative(basePath, dirPath);
  
  if (relativeDirPath) {
    arrayOfDirs.push(relativeDirPath);
  }

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    if (wttpIgnore && wttpIgnore.shouldIgnore(fullPath)) {
      return;
    }
    
    if (isDirectory(fullPath)) {
      arrayOfDirs = getAllDirectories(fullPath, basePath, wttpIgnore, arrayOfDirs);
    }
  });

  return arrayOfDirs;
}

// Find index file for directory
function findIndexFile(dirPath: string, wttpIgnore: any): string {
  const files = fs.readdirSync(dirPath);
  
  const indexPriority = [
    "index.html",
    "index.htm",
    "index.js",
    "index.json",
    "index.md",
    "index.txt"
  ];

  for (const indexFile of indexPriority) {
    const fullPath = path.join(dirPath, indexFile);
    if (files.includes(indexFile) && !wttpIgnore.shouldIgnore(fullPath)) {
      return `./${indexFile}`;
    }
  }

  return "./index.html"; // Default
}

// Check if file should use external storage
function shouldUseExternalStorage(
  filePath: string, 
  fileSize: number, 
  mimeType: string,
  rules?: ExternalStorageRule[]
): ExternalStorageRule | null {
  if (!rules || rules.length === 0) return null;

  const ext = path.extname(filePath).toLowerCase();

  for (const rule of rules) {
    let matches = true;

    // Check size constraints
    if (rule.minSizeBytes && fileSize < rule.minSizeBytes) matches = false;
    if (rule.maxSizeBytes && fileSize > rule.maxSizeBytes) matches = false;

    // Check mime type
    if (rule.mimeTypes && rule.mimeTypes.length > 0) {
      const mimeMatches = rule.mimeTypes.some(pattern => {
        if (pattern.includes("*")) {
          const regex = new RegExp("^" + pattern.replace("*", ".*") + "$");
          return regex.test(mimeType);
        }
        return mimeType === pattern;
      });
      if (!mimeMatches) matches = false;
    }

    // Check extensions
    if (rule.extensions && rule.extensions.length > 0) {
      if (!rule.extensions.includes(ext)) matches = false;
    }

    if (matches) return rule;
  }

  return null;
}

// Chunk file data
function chunkData(data: Buffer, chunkSize: number): Buffer[] {
  const chunks: Buffer[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// Generate manifest for a directory
export async function generateManifest(
  wttpSite: IBaseWTTPSite | null,
  sourcePath: string,
  destinationPath: string,
  config?: ManifestConfig,
  existingManifest?: Manifest,
  publisher?: string
): Promise<Manifest> {
  const estimationMode = wttpSite !== null;
  
  if (estimationMode) {
    console.log(`📋 Generating manifest with estimates for: ${sourcePath} → ${destinationPath}`);
  } else {
    console.log(`📋 Generating manifest (no estimates) for: ${sourcePath} → ${destinationPath}`);
    console.log(`   Chunk addresses and file structure will be calculated`);
    console.log(`   To include cost estimates, provide a site address via test config`);
  }

  // Validate source path
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }
  if (!isDirectory(sourcePath)) {
    throw new Error(`Source path is not a directory: ${sourcePath}`);
  }

  destinationPath = normalizePath(destinationPath, true);

  // Setup ignore patterns
  let ignoreOptions: WTTPIgnoreOptions = { includeDefaults: true };
  
  if (config?.ignorePattern) {
    if (config.ignorePattern === "none") {
      ignoreOptions.includeDefaults = false;
    } else if (typeof config.ignorePattern === "string") {
      // Load from file
      const ignoreFilePath = path.resolve(sourcePath, config.ignorePattern);
      if (fs.existsSync(ignoreFilePath)) {
        const patterns = fs.readFileSync(ignoreFilePath, "utf-8")
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith("#"));
        ignoreOptions.customPatterns = patterns;
      }
    } else if (Array.isArray(config.ignorePattern)) {
      ignoreOptions.customPatterns = config.ignorePattern;
    }
  }

  const wttpIgnore = createWTTPIgnore(sourcePath, ignoreOptions);
  console.log(`📋 Using ${wttpIgnore.getPatterns().length} ignore patterns`);

  // Get chain info if site is provided
  let currencySymbol = "ETH";
  let siteAddress: string | undefined;
  let dps: any = null;
  let dpr: any = null;
  let gasPrice = ethers.parseUnits("50", "gwei");
  let chainData: Manifest["chainData"];

  if (estimationMode && wttpSite) {
    const network = await ethers.provider.getNetwork();
    currencySymbol = await getChainSymbol();
    siteAddress = await wttpSite.getAddress();

    // Get DPS and DPR contracts
    const dpsAddress = await wttpSite.DPS();
    dps = await ethers.getContractAt(
      "@tw3/esp/contracts/interfaces/IDataPointStorage.sol:IDataPointStorage", 
      dpsAddress
    );
    const dprAddress = await wttpSite.DPR();
    dpr = await ethers.getContractAt(
      "@tw3/esp/contracts/interfaces/IDataPointRegistry.sol:IDataPointRegistry", 
      dprAddress
    );

    // Get current gas price for estimates
    const feeData = await ethers.provider.getFeeData();
    gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits("50", "gwei");

    // Set chain data when site is available
    chainData = {
      contractAddress: siteAddress,
      chainId: Number(network.chainId),
      name: network.name === "unknown" ? `chain-${network.chainId}` : network.name,
      symbol: currencySymbol,
      publisher: publisher || config?.publisher || existingManifest?.chainData?.publisher,
      transactions: existingManifest?.chainData?.transactions || [],
    };
  }

  // Initialize manifest structure
  // Prepare config to save in manifest
  const manifestConfig: ManifestConfig | undefined = config ? {
    ...config,
    destination: destinationPath
  } : undefined;

  const manifest: Manifest = {
    name: path.basename(sourcePath),
    path: `./${path.basename(sourcePath)}/`,
    wttpConfig: manifestConfig,
    siteData: {
      directories: [],
      files: []
    },
    chainData
  };

  // Process directories
  const allDirs = getAllDirectories(sourcePath, sourcePath, wttpIgnore);
  
  // Add root directory
  manifest.siteData.directories.push({
    path: "/",
    index: findIndexFile(sourcePath, wttpIgnore)
  });

  // Add subdirectories
  for (const dirPath of allDirs) {
    const fullDirPath = path.join(sourcePath, dirPath);
    const normalizedPath = "/" + dirPath.replace(/\\/g, "/") + "/";
    
    manifest.siteData.directories.push({
      path: normalizedPath,
      index: findIndexFile(fullDirPath, wttpIgnore)
    });
  }

  console.log(`📁 Found ${manifest.siteData.directories.length} directories`);

  // Process files
  const allFiles = getAllFiles(sourcePath, wttpIgnore);
  console.log(`📄 Found ${allFiles.length} files to process`);

  let signerAddress = "0x0000000000000000000000000000000000000000";
  if (estimationMode) {
    const signer = await ethers.provider.getSigner();
    signerAddress = await signer.getAddress();
  }

  for (const filePath of allFiles) {
    console.log(`\n📄 Processing: ${path.relative(sourcePath, filePath)}`);

    const relativePath = path.relative(sourcePath, filePath);
    const normalizedFilePath = "./" + relativePath.replace(/\\/g, "/");
    
    // Read file
    const fileData = fs.readFileSync(filePath);
    const fileSize = fileData.length;

    // Get MIME type
    const { mimeType, charset } = getMimeTypeWithCharset(filePath);

    // Check if file should use external storage
    const externalRule = shouldUseExternalStorage(
      filePath, 
      fileSize, 
      mimeType, 
      config?.externalStorageRules
    );

    if (externalRule) {
      console.log(`   📦 File will use external storage: ${externalRule.provider}`);
      
      // Map provider to correct protocol
      const protocolMap: Record<string, string> = {
        "arweave": "ar",
        "ipfs": "ipfs",
      };
      const protocol = protocolMap[externalRule.provider] || externalRule.provider;
      
      const fileEntry: FileData = {
        path: normalizedFilePath,
        type: mimeType,
        externalStorage: externalRule.provider,
        size: fileSize,
        status: "pending",
        redirect: {
          code: externalRule.redirectCode || 301,
          location: `${protocol}://[pending]`
        },
        chunks: []
      };

      manifest.siteData.files.push(fileEntry);
      continue;
    }

    // Chunk the file
    const chunks = chunkData(fileData, CHUNK_SIZE);
    console.log(`   Split into ${chunks.length} chunks`);

    // Prepare chunk data with estimates
    const chunkDataArray: ChunkData[] = [];
    let previousChunkAddress: string | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Calculate data point address (works with or without site)
      let dataPointAddress: string;
      if (estimationMode && dps) {
        // Use DPS contract calculation
        dataPointAddress = await dps.calculateAddress(chunk);
      } else {
        // Use local calculation
        dataPointAddress = calculateChunkAddressLocal(chunk);
      }

      let royaltyEther = 0;
      let gasEstimate = 0;
      let gasCostEther = 0;

      // Only calculate estimates if we have contracts
      if (estimationMode && dpr && wttpSite) {
        // Get royalty
        const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
        royaltyEther = parseFloat(ethers.formatEther(royalty));

        // Estimate gas (conservative estimate, actual may vary)
        try {
          // Use PUT for estimation (conservative)
          const putRequest = {
            head: {
              path: destinationPath + normalizedFilePath.slice(1),
              ifModifiedSince: 0,
              ifNoneMatch: ethers.ZeroHash
            },
            properties: {
              mimeType: encodeMimeType(mimeType),
              charset: encodeCharset(charset || ""),
              encoding: encodeEncoding("identity"),
              language: encodeLanguage("en-US")
            },
            data: [{
              data: chunk,
              chunkIndex: 0,
              publisher: signerAddress
            }]
          };

          const estimate = await wttpSite.PUT.estimateGas(putRequest, {
            value: royalty
          });
          gasEstimate = Number(estimate);
        } catch (error) {
          // Use conservative default if estimation fails
          gasEstimate = i === 0 ? 200000 : 150000;
          console.log(`   ⚠️ Could not estimate chunk ${i}, using default: ${gasEstimate}`);
        }

        gasCostEther = parseFloat(ethers.formatEther(BigInt(gasEstimate) * gasPrice));
      }

      const chunkEntry: ChunkData = {
        address: dataPointAddress
      };

      // Add estimate only if in estimation mode
      if (estimationMode && gasEstimate > 0) {
        chunkEntry.estimate = gasEstimate;
      }

      // Add range for multi-chunk files
      if (chunks.length > 1) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + chunk.length - 1, fileSize - 1);
        chunkEntry.range = `${start}-${end}`;
      }

      // Add royalty if non-zero (only in estimation mode)
      if (estimationMode && royaltyEther > 0) {
        chunkEntry.royalty = royaltyEther;
      }

      // Add gas cost estimate (only in estimation mode)
      if (estimationMode && gasCostEther > 0) {
        chunkEntry.gas = gasCostEther;
      }

      // Add prerequisite for sequential chunks
      if (i > 0 && previousChunkAddress) {
        chunkEntry.prerequisite = previousChunkAddress;
      }

      chunkDataArray.push(chunkEntry);
      previousChunkAddress = dataPointAddress;

      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        console.log(`   Processed ${i + 1}/${chunks.length} chunks...`);
      }
    }

    // Create file entry
    const fileEntry: FileData = {
      path: normalizedFilePath,
      type: mimeType,
      size: fileSize,
      status: "pending",
      chunks: chunkDataArray
    };

    // Add non-default properties
    if (charset && charset !== "utf-8") {
      fileEntry.charset = charset;
    }

    manifest.siteData.files.push(fileEntry);
    console.log(`   ✅ File processed with ${chunkDataArray.length} chunks`);
  }

  console.log(`\n✅ Manifest generation complete!`);
  console.log(`   Total directories: ${manifest.siteData.directories.length}`);
  console.log(`   Total files: ${manifest.siteData.files.length}`);
  
  if (estimationMode) {
    // Calculate total estimates
    let totalGasEstimate = 0;
    let totalRoyaltyEstimate = 0;
    
    for (const file of manifest.siteData.files) {
      for (const chunk of file.chunks) {
        totalGasEstimate += chunk.estimate || 0;
        totalRoyaltyEstimate += chunk.royalty || 0;
      }
    }

    const totalGasCostEther = parseFloat(ethers.formatEther(BigInt(totalGasEstimate) * gasPrice));
    
    console.log(`\n📊 Estimated Costs:`);
    console.log(`   Gas: ${totalGasCostEther.toFixed(6)} ${currencySymbol}`);
    console.log(`   Royalties: ${totalRoyaltyEstimate.toFixed(6)} ${currencySymbol}`);
    console.log(`   Total: ${(totalGasCostEther + totalRoyaltyEstimate).toFixed(6)} ${currencySymbol}`);
  } else {
    console.log(`\n📊 Summary:`);
    console.log(`   Total chunks: ${manifest.siteData.files.reduce((sum, f) => sum + f.chunks.length, 0)}`);
    console.log(`   (No cost estimates - provide site address for estimates)`);
  }

  return manifest;
}

// Load test config from file
export function loadTestConfig(configPath: string, networkName?: string): TestConfig | null {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const configJson = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configJson);

    // Support both direct config and networks-based config
    if (config.networks) {
      // Networks-based config
      const network = networkName || config.default;
      if (!network) {
        console.warn(`⚠️ No network specified and no default in test config`);
        return null;
      }

      const networkConfig = config.networks[network];
      if (!networkConfig) {
        console.warn(`⚠️ Network '${network}' not found in test config`);
        return null;
      }

      return networkConfig as TestConfig;
    } else {
      // Direct config format
      return config as TestConfig;
    }
  } catch (error) {
    console.warn(`⚠️ Could not load test config: ${error}`);
    return null;
  }
}

// Save manifest to file
export function saveManifest(manifest: Manifest, outputPath?: string): string {
  const manifestPath = outputPath || path.join(manifest.path, "wttp.manifest.json");
  const manifestJson = JSON.stringify(manifest, null, 2);
  
  fs.writeFileSync(manifestPath, manifestJson);
  console.log(`\n💾 Manifest saved to: ${manifestPath}`);
  
  return manifestPath;
}

// Load existing manifest
export function loadManifest(manifestPath: string): Manifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }
  
  const manifestJson = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(manifestJson) as Manifest;
}

