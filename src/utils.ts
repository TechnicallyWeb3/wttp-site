// Shared utilities used by both Hardhat and standalone ethers.js scripts
import path from "path";
import mime from "mime-types";
import { ethers, Provider } from "ethers";

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
export function chunkData(data: Buffer, chunkSize: number): Buffer[] {
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

// Helper function to determine if a MIME type is text-based and should include charset
function isTextMimeType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || 
         mimeType.includes('javascript') || 
         mimeType.includes('json') || 
         mimeType.includes('xml') || 
         mimeType.includes('html') || 
         mimeType.includes('css') || 
         mimeType.includes('svg');
}

// Helper function to get MIME type with charset for text files
export function getMimeTypeWithCharset(filePath: string): { mimeType: string; charset: string | undefined } {
  const baseMimeType = getMimeType(filePath);
  
  // For text-based files, add charset
  if (isTextMimeType(baseMimeType)) {
    return {
      mimeType: baseMimeType,
      charset: "utf-8"
    };
  }
  
  // For non-text files, no charset needed
  return {
    mimeType: baseMimeType,
    charset: undefined
  };
}

// Helper function to get chain currency symbol (POL for Polygon, ETH otherwise)
// Provider-based version for standalone use
export async function getChainSymbol(provider?: Provider): Promise<string> {
  if (!provider) return "ETH";
  
  try {
    const network = await provider.getNetwork();
    return network.chainId === 137n ? "POL" : "ETH";
  } catch (error) {
    // Default to ETH if we can't detect network
    return "ETH";
  }
}

// Helper function to get chain symbol from chain ID
export function getChainSymbolFromChainId(chainId: number | bigint): string {
  const id = typeof chainId === 'bigint' ? Number(chainId) : chainId;
  return id === 137 ? "POL" : "ETH";
}

// Helper function to wait until gas price is below the specified limit
export async function waitForGasPriceBelowLimit(
  provider: Provider,
  gasLimitGwei: number, 
  checkIntervalMs: number = 10000
): Promise<void> {
  const gasLimit = ethers.parseUnits(gasLimitGwei.toString(), "gwei");
  
  while (true) {
    try {
      const feeData = await provider.getFeeData();
      let currentGasPrice: bigint;
      
      if (feeData.gasPrice) {
        currentGasPrice = feeData.gasPrice;
      } else if (feeData.maxFeePerGas) {
        currentGasPrice = feeData.maxFeePerGas;
      } else {
        console.warn("⚠️ Could not fetch gas price, proceeding anyway");
        return;
      }
      
      if (currentGasPrice <= gasLimit) {
        console.log(`✅ Gas price is below limit: ${ethers.formatUnits(currentGasPrice, "gwei")} gwei <= ${gasLimitGwei} gwei`);
        return;
      }
      
      console.log(`⏳ Gas price (${ethers.formatUnits(currentGasPrice, "gwei")} gwei/${ethers.formatUnits(feeData.maxFeePerGas ?? 9n, "gwei")} gwei) is above limit (${gasLimitGwei} gwei), waiting ${checkIntervalMs/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    } catch (error) {
      console.warn("⚠️ Error checking gas price, proceeding anyway:", error);
      return;
    }
  }
}

// Helper function to get dynamic gas settings based on current network conditions
export async function getDynamicGasSettings(provider: Provider) {
  try {
    // Get current network fee data
    const feeData = await provider.getFeeData();
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

// Helper function to get gas price for estimation (custom or multiply current by rate, with optional minimum)
export async function getEstimationGasPrice(
  provider: Provider,
  customGasPriceGwei?: number, 
  rate: number = 2, 
  minGasPriceGwei: number = 150
): Promise<bigint> {
  if (customGasPriceGwei !== undefined) {
    return ethers.parseUnits(customGasPriceGwei.toString(), "gwei");
  }
  
  try {
    const feeData = await provider.getFeeData();
    let currentGasPrice: bigint;
    
    if (feeData.maxFeePerGas) {
      // EIP-1559 network
      currentGasPrice = feeData.maxFeePerGas;
    } else if (feeData.gasPrice) {
      // Legacy network
      currentGasPrice = feeData.gasPrice;
    } else {
      // Fallback
      currentGasPrice = ethers.parseUnits("75", "gwei"); // Default to 75 gwei
    }
    
    // Multiply the current gas price by the rate
    // Convert to number, multiply, then back to bigint to handle decimals
    const currentGasPriceNumber = Number(currentGasPrice);
    const multipliedGasPriceNumber = currentGasPriceNumber * rate;
    const multipliedGasPrice = BigInt(Math.floor(multipliedGasPriceNumber));
    
    // Apply minimum gas price
    const minGasPrice = ethers.parseUnits(minGasPriceGwei.toString(), "gwei");
    
    return multipliedGasPrice > minGasPrice ? multipliedGasPrice : minGasPrice;
  } catch (error) {
    console.warn(`⚠️ Could not fetch network gas prices, using minimum ${minGasPriceGwei} gwei`);
    return ethers.parseUnits(minGasPriceGwei.toString(), "gwei");
  }
}

