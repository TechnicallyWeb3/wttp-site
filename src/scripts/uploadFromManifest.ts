import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { 
  IBaseWTTPSite, 
  DEFAULT_HEADER, 
  DEFINERequestStruct,
  PUTRequestStruct,
  PATCHRequestStruct,
  DataRegistrationStruct,
  encodeCharset,
  encodeMimeType,
  encodeEncoding,
  encodeLanguage,
  normalizePath
} from "@wttp/core";
import { 
  loadManifest,
  saveManifest,
  Manifest,
  FileData,
} from "./generateManifest";
import {
  chunkData,
  getChainSymbol,
  waitForGasPriceBelowLimit,
  getDynamicGasSettings
} from "./uploadFile";

const CHUNK_SIZE = 32 * 1024; // 32KB chunks

/**
 * Upload files, directories, and redirects from a manifest
 * Trusts the manifest completely - no excessive checks
 */
export async function uploadFromManifest(
  wttpSite: IBaseWTTPSite,
  manifestPath: string,
  sourcePath?: string
): Promise<Manifest> {
  console.log(`📋 Loading manifest: ${manifestPath}`);
  
  const manifest = loadManifest(manifestPath);
  const baseSourcePath = sourcePath || path.dirname(manifestPath);
  
  // Get configuration from manifest
  const config = manifest.wttpConfig;
  const gasLimitGwei = config?.gasLimit;
  const fileLimitBytes = config?.fileLimit ? config.fileLimit * 1024 * 1024 : undefined;
  const destinationPath = config?.destination || "/";
  
  console.log(`📁 Source path: ${baseSourcePath}`);
  console.log(`📁 Destination: ${destinationPath}`);
  if (gasLimitGwei) console.log(`⛽ Gas limit: ${gasLimitGwei} gwei`);
  if (fileLimitBytes) console.log(`📦 File limit: ${(fileLimitBytes / (1024 * 1024)).toFixed(2)} MB`);
  
  const currencySymbol = await getChainSymbol();
  const siteAddress = await wttpSite.getAddress();
  
  // Get DPR and DPS contracts
  const dprAddress = await wttpSite.DPR();
  const dpr = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointRegistry.sol:IDataPointRegistry", dprAddress);
  
  const dpsAddress = await wttpSite.DPS();
  const dps = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointStorage.sol:IDataPointStorage", dpsAddress);
  
  // Track totals
  let totalGasUsed = 0n;
  let totalRoyaltiesSpent = 0n;
  let filesUploaded = 0;
  let filesSkipped = 0;
  let directoriesProcessed = 0;
  let chunksUploaded = 0;
  
  // Get signer
  const signers = await ethers.getSigners();
  const signer = signers[0];
  const signerAddress = await signer.getAddress();
  
  // Process directories first
  console.log(`\n📂 Processing directories...`);
  for (const directory of manifest.siteData.directories) {
    // Skip if already complete
    if (directory.status === "complete") {
      console.log(`⏭️  Skipping directory ${directory.path} - already complete`);
      continue;
    }
    
    console.log(`\n📁 Processing directory: ${directory.path}`);
    
    try {
      // Wait for gas limit
      if (gasLimitGwei) {
        await waitForGasPriceBelowLimit(gasLimitGwei);
      }
      
      const gasSettings = await getDynamicGasSettings();
      
      // Create DEFINE request for directory
      // Normalize the directory index path (remove ./ prefix and join with destination)
      const indexRelativePath = directory.index.replace(/^\.\//, "");
      const normalizedIndexPath = normalizePath(path.join(destinationPath, indexRelativePath).replace(/\\/g, '/'));
      
      const defineRequest: DEFINERequestStruct = {
        head: {
          path: normalizePath(path.join(destinationPath, directory.path).replace(/\\/g, '/')),
          ifModifiedSince: 0,
          ifNoneMatch: ethers.ZeroHash
        },
        data: {
          ...DEFAULT_HEADER,
          redirect: {
            code: 301,
            location: normalizedIndexPath
          }
        }
      };
      
      console.log(`🚀 Sending DEFINE transaction for directory...`);
      const tx = await wttpSite.DEFINE(defineRequest, gasSettings);
      const receipt = await tx.wait();
      
      if (receipt) {
        totalGasUsed += receipt.gasUsed;
        directory.txHash = receipt.hash;
        directory.status = "complete";
        
        // Add to transaction log
        if (!manifest.chainData) {
        manifest.chainData = {
          contractAddress: siteAddress,
          chainId: Number((await ethers.provider.getNetwork()).chainId),
          name: "",
          symbol: currencySymbol,
          transactions: []
        };
      }
      
      if (manifest.chainData) {
        manifest.chainData.transactions.push({
          txHash: receipt.hash,
          method: "DEFINE",
          path: normalizePath(path.join(destinationPath, directory.path).replace(/\\/g, '/')),
          redirect: {
            code: 301,
            location: normalizedIndexPath
          },
          gasUsed: Number(receipt.gasUsed)
        });
      }
        
        console.log(`✅ Directory created: ${directory.path}`);
        directoriesProcessed++;
        
        // Save manifest after each directory
        saveManifest(manifest, manifestPath);
      }
    } catch (error) {
      console.error(`❌ Failed to process directory ${directory.path}:`, error);
      directory.status = "error";
      saveManifest(manifest, manifestPath);
    }
  }
  
  // Process files
  console.log(`\n📄 Processing files...`);
  for (const file of manifest.siteData.files) {
    // Skip if already complete
    if (file.status === "complete") {
      console.log(`⏭️  Skipping ${file.path} - already complete`);
      filesSkipped++;
      continue;
    }
    
    console.log(`\n📄 Processing: ${file.path}`);
    
    // Handle files with external storage (redirects)
    if (file.externalStorage === "arweave" && file.redirect) {
      await uploadArweaveRedirect(
        wttpSite,
        file,
        manifest,
        manifestPath,
        destinationPath,
        gasLimitGwei,
        siteAddress,
        currencySymbol
      );
      filesUploaded++;
      directoriesProcessed++; // Count as directory since it's a redirect
      totalGasUsed += BigInt(file.gasCost || 0);
      continue;
    }
    
    // Handle regular files
    const fileRelativePath = file.path.replace(/^\.\//, "");
    const fileAbsolutePath = path.join(baseSourcePath, fileRelativePath);
    const normalizedFilePath = normalizePath(path.join(destinationPath, fileRelativePath).replace(/\\/g, '/'));
    
    if (!fs.existsSync(fileAbsolutePath)) {
      console.warn(`⚠️  File not found: ${fileAbsolutePath} - skipping`);
      continue;
    }
    
    // Read file
    const fileData = fs.readFileSync(fileAbsolutePath);
    
    // Check file limit
    if (fileLimitBytes && fileData.length > fileLimitBytes) {
      console.warn(`⚠️  File exceeds limit: ${fileData.length} > ${fileLimitBytes} - skipping`);
      continue;
    }
    
    // Chunk the file
    const chunks = chunkData(fileData, CHUNK_SIZE);
    console.log(`   ${chunks.length} chunks`);
    
    // Build data registrations
    const dataRegistrations: DataRegistrationStruct[] = [];
    const royalties: bigint[] = [];
    let totalRoyalty = 0n;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkInfo = file.chunks[i];
      
      // Skip if chunk is complete
      if (chunkInfo.txHash) {
        console.log(`   ⏭️  Chunk ${i} already uploaded`);
        continue;
      }
      
      // Publisher lookup: chunk.publisher -> file.publisher -> chainData.publisher -> signerAddress
      const publisherAddress = chunkInfo.publisher || file.publisher || manifest.chainData?.publisher || signerAddress;
      
      dataRegistrations.push({
        data: chunks[i],
        chunkIndex: i,
        publisher: publisherAddress
      });
      
      // Use royalty from manifest if available
      if (chunkInfo.royalty !== undefined) {
        const royaltyWei = ethers.parseEther(chunkInfo.royalty.toString());
        royalties.push(royaltyWei);
        totalRoyalty += royaltyWei;
      } else {
        // Fetch royalty if not in manifest
        const dataPointAddress = await dps.calculateAddress(chunks[i]);
        const royalty = await dpr.getDataPointRoyalty(dataPointAddress);
        royalties.push(royalty);
        totalRoyalty += royalty;
      }
    }
    
    if (dataRegistrations.length === 0) {
      console.log(`   ✅ All chunks already uploaded`);
      file.status = "complete";
      saveManifest(manifest, manifestPath);
      filesSkipped++;
      continue;
    }
    
    console.log(`   💰 Total royalty: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}`);
    
    // Check balance
    const balance = await ethers.provider.getBalance(signerAddress);
    if (balance < totalRoyalty) {
      throw new Error(`Insufficient balance. Required: ${ethers.formatEther(totalRoyalty)} ${currencySymbol}, Available: ${ethers.formatEther(balance)} ${currencySymbol}`);
    }
    
    // Wait for gas limit
    if (gasLimitGwei) {
      await waitForGasPriceBelowLimit(gasLimitGwei);
    }
    
    const gasSettings = await getDynamicGasSettings();
    
    // Build PUT request (first chunk)
    const putRequest: PUTRequestStruct = {
      head: {
        path: normalizedFilePath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      },
      properties: {
        mimeType: encodeMimeType(file.type),
        charset: encodeCharset(file.charset || ""),
        encoding: encodeEncoding("identity"),
        language: encodeLanguage("en-US")
      },
      data: [dataRegistrations[0]]
    };
    
    try {
      console.log(`🚀 Sending PUT transaction...`);
      const tx = await wttpSite.PUT(putRequest, {
        value: royalties[0],
        ...gasSettings
      });
      const receipt = await tx.wait();
      
      if (receipt) {
        totalGasUsed += receipt.gasUsed;
        totalRoyaltiesSpent += royalties[0];
        file.chunks[0].txHash = receipt.hash;
        chunksUploaded++;
        
        // Add to transaction log
        if (!manifest.chainData) {
          manifest.chainData = {
            contractAddress: siteAddress,
            chainId: Number((await ethers.provider.getNetwork()).chainId),
            name: "",
            symbol: currencySymbol,
            transactions: []
          };
        }
        
        if (manifest.chainData) {
          manifest.chainData.transactions.push({
            txHash: receipt.hash,
            method: "PUT",
            path: normalizedFilePath,
            chunkAddress: file.chunks[0].address,
            range: file.chunks[0].range,
            value: Number(ethers.formatEther(royalties[0])),
            gasUsed: Number(receipt.gasUsed)
          });
        }
        
        console.log(`   ✅ PUT complete`);
      }
    } catch (error: any) {
      // Handle royalty errors - fetch fresh royalty and retry
      if (error.message?.includes("royalty") || error.message?.includes("InsufficientValue")) {
        console.log(`   ⚠️ Royalty error, fetching fresh royalty...`);
        const dataPointAddress = await dps.calculateAddress(chunks[0]);
        const freshRoyalty = await dpr.getDataPointRoyalty(dataPointAddress);
        royalties[0] = freshRoyalty;
        
        console.log(`   🔄 Retrying with fresh royalty: ${ethers.formatEther(freshRoyalty)} ${currencySymbol}`);
        const tx = await wttpSite.PUT(putRequest, {
          value: freshRoyalty,
          ...gasSettings
        });
        const receipt = await tx.wait();
        
        if (receipt) {
          totalGasUsed += receipt.gasUsed;
          totalRoyaltiesSpent += freshRoyalty;
          file.chunks[0].txHash = receipt.hash;
          chunksUploaded++;
          
          if (manifest.chainData) {
            manifest.chainData.transactions.push({
              txHash: receipt.hash,
              method: "PUT",
              path: normalizedFilePath,
              chunkAddress: file.chunks[0].address,
              range: file.chunks[0].range,
              value: Number(ethers.formatEther(freshRoyalty)),
              gasUsed: Number(receipt.gasUsed)
            });
          }
          
          console.log(`   ✅ PUT complete (retry)`);
        }
      } else {
        throw error;
      }
    }
    
    // Upload remaining chunks with PATCH
    if (dataRegistrations.length > 1) {
      for (let i = 1; i < dataRegistrations.length; i++) {
        if (gasLimitGwei) {
          await waitForGasPriceBelowLimit(gasLimitGwei);
        }
        
        const patchRequest: PATCHRequestStruct = {
          head: {
            path: normalizedFilePath,
            ifModifiedSince: 0,
            ifNoneMatch: ethers.ZeroHash
          },
          data: [dataRegistrations[i]]
        };
        
        try {
          console.log(`🚀 Sending PATCH transaction (chunk ${i + 1}/${dataRegistrations.length})...`);
          const tx = await wttpSite.PATCH(patchRequest, {
            value: royalties[i],
            ...gasSettings
          });
          const receipt = await tx.wait();
          
          if (receipt) {
            totalGasUsed += receipt.gasUsed;
            totalRoyaltiesSpent += royalties[i];
            file.chunks[i].txHash = receipt.hash;
            chunksUploaded++;
            
            if (manifest.chainData) {
              manifest.chainData.transactions.push({
                txHash: receipt.hash,
                method: "PATCH",
                path: normalizedFilePath,
                chunkAddress: file.chunks[i].address,
                range: file.chunks[i].range,
                value: Number(ethers.formatEther(royalties[i])),
                gasUsed: Number(receipt.gasUsed)
              });
            }
            
            console.log(`   ✅ PATCH complete`);
          }
        } catch (error: any) {
          // Handle royalty errors
          if (error.message?.includes("royalty") || error.message?.includes("InsufficientValue")) {
            console.log(`   ⚠️ Royalty error, fetching fresh royalty...`);
            const dataPointAddress = await dps.calculateAddress(chunks[i]);
            const freshRoyalty = await dpr.getDataPointRoyalty(dataPointAddress);
            royalties[i] = freshRoyalty;
            
            console.log(`   🔄 Retrying with fresh royalty: ${ethers.formatEther(freshRoyalty)} ${currencySymbol}`);
            const tx = await wttpSite.PATCH(patchRequest, {
              value: freshRoyalty,
              ...gasSettings
            });
            const receipt = await tx.wait();
            
            if (receipt) {
              totalGasUsed += receipt.gasUsed;
              totalRoyaltiesSpent += freshRoyalty;
              file.chunks[i].txHash = receipt.hash;
              chunksUploaded++;
              
              if (manifest.chainData) {
                manifest.chainData.transactions.push({
                  txHash: receipt.hash,
                  method: "PATCH",
                  path: normalizedFilePath,
                  chunkAddress: file.chunks[i].address,
                  range: file.chunks[i].range,
                  value: Number(ethers.formatEther(freshRoyalty)),
                  gasUsed: Number(receipt.gasUsed)
                });
              }
              
              console.log(`   ✅ PATCH complete (retry)`);
            }
          } else {
            throw error;
          }
        }
        
        // Save manifest after each chunk
        saveManifest(manifest, manifestPath);
      }
    }
    
    file.status = "complete";
    filesUploaded++;
    
    // Save manifest after each file
    saveManifest(manifest, manifestPath);
  }
  
  // Print summary
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
  const totalGasCost = totalGasUsed * effectiveGasPrice;
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   Directories processed: ${directoriesProcessed}`);
  console.log(`   Files uploaded: ${filesUploaded}`);
  console.log(`   Files skipped: ${filesSkipped}`);
  console.log(`   Chunks uploaded: ${chunksUploaded}`);
  console.log(`   Total gas used: ${totalGasUsed.toString()}`);
  console.log(`   Total gas cost: ${ethers.formatEther(totalGasCost)} ${currencySymbol}`);
  console.log(`   Total royalties: ${ethers.formatEther(totalRoyaltiesSpent)} ${currencySymbol}`);
  console.log(`   Total cost: ${ethers.formatEther(totalGasCost + totalRoyaltiesSpent)} ${currencySymbol}`);
  
  return manifest;
}

/**
 * Upload Arweave redirect using DEFINE
 */
async function uploadArweaveRedirect(
  wttpSite: IBaseWTTPSite,
  file: FileData,
  manifest: Manifest,
  manifestPath: string,
  destinationPath: string,
  gasLimitGwei: number | undefined,
  siteAddress: string,
  currencySymbol: string
): Promise<void> {
  if (!file.redirect) {
    console.warn(`⚠️  File ${file.path} has no redirect configured`);
    return;
  }
  
  // Check if redirect is ready (has TXID)
  if (file.redirect.location === "ar://[pending]") {
    console.log(`⏭️  Skipping ${file.path} - Arweave TXID not yet available`);
    return;
  }
  
  // Normalize the file path (remove ./ prefix and join with destination, then normalize)
  const fileRelativePath = file.path.replace(/^\.\//, "");
  const normalizedPath = normalizePath(path.join(destinationPath, fileRelativePath).replace(/\\/g, '/'));
  
  console.log(`📍 Setting redirect for ${normalizedPath} → ${file.redirect.location}`);
  
  try {
    // Wait for gas limit
    if (gasLimitGwei) {
      await waitForGasPriceBelowLimit(gasLimitGwei);
    }
    
    const gasSettings = await getDynamicGasSettings();
    
    // Create DEFINE request with redirect
    const defineRequest: DEFINERequestStruct = {
      head: {
        path: normalizedPath,
        ifModifiedSince: 0,
        ifNoneMatch: ethers.ZeroHash
      },
      data: {
        ...DEFAULT_HEADER,
        redirect: {
          code: file.redirect.code,
          location: file.redirect.location
        }
      }
    };
    
    console.log(`🚀 Sending DEFINE transaction for redirect...`);
    const tx = await wttpSite.DEFINE(defineRequest, gasSettings);
    const receipt = await tx.wait();
    
    if (receipt) {
      file.status = "complete";
      file.gasCost = Number(receipt.gasUsed);
      
      // Add to transaction log
      if (!manifest.chainData) {
        manifest.chainData = {
          contractAddress: siteAddress,
          chainId: Number((await ethers.provider.getNetwork()).chainId),
          name: "",
          symbol: currencySymbol,
          transactions: []
        };
      }
      
      if (manifest.chainData) {
        manifest.chainData.transactions.push({
          txHash: receipt.hash,
          method: "DEFINE",
          path: normalizedPath,
          redirect: {
            code: file.redirect.code,
            location: file.redirect.location
          },
          gasUsed: Number(receipt.gasUsed)
        });
      }
      
      console.log(`✅ Redirect set: ${normalizedPath} → ${file.redirect.location}`);
      
      // Save manifest
      saveManifest(manifest, manifestPath);
    }
  } catch (error) {
    console.error(`❌ Failed to set redirect for ${normalizedPath}:`, error);
    file.status = "error";
    saveManifest(manifest, manifestPath);
    throw error;
  }
}


