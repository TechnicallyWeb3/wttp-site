// Import ethers from the hardhat runtime environment when running
// but allow direct import from ethers package when imported

import { ethers } from "hardhat";
import { 
  HEADRequestStruct, 
  ORIGINS_ADMIN_ONLY, 
  type HEADResponseStruct, 
  type IBaseWTTPSite, 
  type LOCATEResponseStruct, 
  type RangeStruct,
  normalizePath
} from "@wttp/core";

/**
 * Fetches a resource directly from a WTTP site contract
 * 
 * @param siteAddress - The address of the WTTP site contract
 * @param path - The path to the resource
 * @param options - Optional parameters for the request
 * @returns The response from the site with full content
 */
export async function fetchResource(
  siteAddress: string,
  path?: string,
  options: {
    ifModifiedSince?: number,
    ifNoneMatch?: string,
    range?: RangeStruct,
    headRequest?: boolean,
    datapoints?: boolean,
    chainId?: number
  } = {},
): Promise<{
  response: LOCATEResponseStruct,
  content?: Uint8Array,
}> {
  // Parameter validation
  if (!siteAddress) {
    // TODO: should validate that siteAddress is a valid address
    throw new Error("Site address is required");
  }

  try {
    path = normalizePath(path || "/"); // should force absolute path, doesn't
  } catch (error) {
    throw new Error(`Invalid path format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const { 
    ifModifiedSince = 0, 
    ifNoneMatch = ethers.ZeroHash,
    range = { start: 0, end: 0 } as RangeStruct,
    headRequest = false, 
    datapoints = true,
    chainId 
  } = options;

  console.log(`🌐 Connecting to site: ${siteAddress}`);
  console.log(`📄 Requesting resource: ${path}${headRequest ? ' (HEAD only)' : ''}`);

  // Get the site contract with error handling
  let siteContract: IBaseWTTPSite;
  try {
    siteContract = await ethers.getContractAt("Web3Site", siteAddress) as unknown as IBaseWTTPSite;
  } catch (error) {
    throw new Error(`Failed to connect to site contract at ${siteAddress}: ${error}`);
  }

  // Create the request - updated to new structure without requestLine wrapper
  const headRequest_obj: HEADRequestStruct = {
    path: path,
    ifModifiedSince,
    ifNoneMatch
  };

  let head: HEADResponseStruct = {
    status: 404n,
    headerInfo: {
      cache: {immutableFlag: false, preset: 0n, custom: ""},
      cors: {
        methods: 1n, 
        origins: ORIGINS_ADMIN_ONLY, 
        preset: 0n, 
        custom: ""
      },
      redirect: {code: 0n, location: ""}
    },
    metadata: { 
      properties: { 
        mimeType: "0x0000", 
        charset: "0x0000", 
        encoding: "0x0000", 
        language: "0x0000" 
      },
      size: 0n,
      version: 0n,
      lastModified: 0n,
      header: ethers.ZeroHash
    },
    etag: ethers.ZeroHash
  };

  // If it's a HEAD request, just call HEAD
  if (headRequest) {
    console.log(`Sending HEAD request for ${path} from site ${siteAddress}`);
    try {
      head = await siteContract.HEAD(headRequest_obj) as HEADResponseStruct;
    } catch (error: any) {
      console.log(error.message);
    }

    return { response: { head, resource: { dataPoints: [], totalChunks: 0 } }, content: undefined };

  } else {
    // For GET requests, use the site's GET method which returns LOCATEResponse
    console.log(`Fetching resource at ${path} from site ${siteAddress}`);
    
    let locateResponse: LOCATEResponseStruct;
    try {
      locateResponse = await siteContract.GET({head: headRequest_obj, rangeChunks: range}) as LOCATEResponseStruct;
    } catch (error: any) {
      console.log(error);
      locateResponse = {
        head: head,
        resource: {
          dataPoints: [],
          totalChunks: 0
        }
      };
    }
    
    // Updated to use new response structure without responseLine wrapper
    console.log(`Response status: ${locateResponse.head.status}`);
    console.log(`Found ${locateResponse.resource.dataPoints.length} data points`);

    // If the response is successful and user wants data (no --datapoints flag), load the content
    let content: Uint8Array | undefined = undefined;
    if (!datapoints) {
      if ((locateResponse.head.status === 200n || locateResponse.head.status === 206n) 
          && locateResponse.resource.dataPoints.length > 0) {
        const dataPointAddresses: string[] = locateResponse.resource.dataPoints.map(dp => dp.toString());
        content = await readDataPointsContent(siteAddress, dataPointAddresses, chainId);
      }
    }

    return {
      response: locateResponse,
      content
    };
  }
}

/**
 * Reads content from an array of datapoints using the DPS contract
 * 
 * @param siteAddress - The address of the WTTP site (to get DPS reference)
 * @param dataPoints - Array of datapoint addresses
 * @param chainId - Optional chain ID for ESP deployments
 * @returns Combined content from all datapoints
 */
export async function readDataPointsContent(
  siteAddress: string,
  dataPoints: string[],
  chainId?: number
): Promise<Uint8Array> {
  console.log(`📥 Reading content from ${dataPoints.length} datapoints...`);
  
  // Parameter validation
  if (!siteAddress || !dataPoints || dataPoints.length === 0) {
    throw new Error("Valid site address and datapoints array required");
  }
  
  // Get the site contract to access DPS
  const siteContract = await ethers.getContractAt("Web3Site", siteAddress) as unknown as IBaseWTTPSite;
  const dpsAddress = await siteContract.DPS();

  console.log(`🔗 Loading DPS at address ${dpsAddress}...`);
  
  // Get the DPS contract
  const dpsContract = await ethers.getContractAt("@tw3/esp/contracts/interfaces/IDataPointStorage.sol:IDataPointStorage", dpsAddress);
  
  // Read all datapoints and combine their content with progress reporting
  const contents: Uint8Array[] = [];
  let totalBytesRead = 0;
  
  for (let i = 0; i < dataPoints.length; i++) {
    const dataPointAddress = dataPoints[i];
    const progress = Math.round(((i + 1) / dataPoints.length) * 100);
    console.log(`📊 Reading chunk ${i + 1}/${dataPoints.length} (${progress}%): ${dataPointAddress.substring(0, 10)}...`);
    
    try {
      // Read the datapoint content
      const dataPointContent = await dpsContract.readDataPoint(dataPointAddress);
      const chunk = new Uint8Array(ethers.toBeArray(dataPointContent));
      contents.push(chunk);
      totalBytesRead += chunk.length;
      
      console.log(`✅ Chunk ${i + 1} read: ${chunk.length} bytes`);
    } catch (error) {
      console.error(`❌ Failed to read datapoint ${dataPointAddress}:`, error);
      throw new Error(`Failed to read datapoint ${i + 1}/${dataPoints.length}: ${error}`);
    }
  }
  
  // Combine all content chunks with optimized allocation
  console.log(`🔗 Combining ${dataPoints.length} chunks (${totalBytesRead} total bytes)...`);
  const combined = new Uint8Array(totalBytesRead);
  
  let offset = 0;
  for (let i = 0; i < contents.length; i++) {
    const chunk = contents[i];
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log(`✅ Successfully reconstructed ${combined.length} bytes from ${dataPoints.length} chunks`);
  return combined;
}

export function isText(mimeType: string): boolean {
  return mimeType === "0x7470" || // text/plain (tp)
    mimeType === "0x7468" || // text/html (th)
    mimeType === "0x7463" || // text/css (tc)
    mimeType === "0x746d" || // text/markdown (tm)
    mimeType === "0x616a" || // application/javascript (aj)
    mimeType === "0x616f" || // application/json (ao)
    mimeType === "0x6178" || // application/xml (ax)
    mimeType === "0x6973";   // image/svg+xml (is)
}

/**
 * Main function to fetch a resource from a WTTP site
 */
export async function main(
  siteAddress: string,
  path: string,
  options: {
    ifModifiedSince?: number,
    ifNoneMatch?: string,
    range?: RangeStruct,
    headRequest?: boolean,
    datapoints?: boolean,
    chainId?: number
  } = {},
) {
  // Fetch the resource directly from the site
  return await fetchResource(siteAddress, path, options);
}
