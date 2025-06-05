// Import ethers from the hardhat runtime environment when running
// but allow direct import from ethers package when imported

import type { Web3Site } from "../typechain-types";
import { ethers } from "hardhat";
import { getContractAddress } from "@tw3/esp";

/**
 * Fetches a resource directly from a WTTP site contract
 * 
 * @param siteAddress - The address of the WTTP site contract
 * @param path - The path to the resource
 * @param options - Optional parameters for the request
 * @returns The response from the site with full content
 */
export async function fetchResourceFromSite(
  siteAddress: string,
  path: string,
  options: {
    ifModifiedSince?: number,
    ifNoneMatch?: string,
    headRequest?: boolean,
    chainId?: number
  } = {}
) {
  const { ifModifiedSince = 0, ifNoneMatch = ethers.ZeroHash, headRequest = false, chainId } = options;

  // Get the site contract
  const siteContract = await ethers.getContractAt("Web3Site", siteAddress) as Web3Site;

  // Create the request - updated to new structure without requestLine wrapper
  const headRequest_obj = {
    path: path,
    ifModifiedSince,
    ifNoneMatch
  };

  // If it's a HEAD request, just call HEAD
  if (headRequest) {
    console.log(`Sending HEAD request for ${path}`);
    const response = await siteContract.HEAD(headRequest_obj);
    return {
      type: 'HEAD' as const,
      response
    };
  }

  // For GET requests, use the site's GET method which returns LOCATEResponse
  console.log(`Fetching resource at ${path} from site ${siteAddress}`);
  const locateResponse = await siteContract.GET(headRequest_obj);
  
  // Updated to use new response structure without responseLine wrapper
  console.log(`Response status: ${locateResponse.head.status}`);
  console.log(`Found ${locateResponse.dataPoints.length} data points`);

  // If the response is successful and has datapoints, read the content
  let content: Uint8Array | null = null;
  
  if ((locateResponse.head.status === 200n || locateResponse.head.status === 206n) 
      && locateResponse.dataPoints.length > 0) {
    content = await readDataPointsContent(siteAddress, locateResponse.dataPoints, chainId);
  }

  return {
    type: 'GET' as const,
    response: locateResponse,
    content
  };
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
  console.log(`Reading content from ${dataPoints.length} datapoints...`);
  
  // Get the site contract to access DPS
  const siteContract = await ethers.getContractAt("Web3Site", siteAddress) as Web3Site;
  const dpsAddress = await siteContract.DPS();
  
  // Get the DPS contract
  const dpsContract = await ethers.getContractAt("DataPointStorage", dpsAddress);
  
  // Read all datapoints and combine their content
  const contents: Uint8Array[] = [];
  
  for (let i = 0; i < dataPoints.length; i++) {
    const dataPointAddress = dataPoints[i];
    console.log(`Reading datapoint ${i + 1}/${dataPoints.length}: ${dataPointAddress}`);
    
    try {
      // Read the datapoint content
      const dataPointContent = await dpsContract.readDataPoint(dataPointAddress);
      contents.push(new Uint8Array(dataPointContent));
    } catch (error) {
      console.error(`Failed to read datapoint ${dataPointAddress}:`, error);
      throw new Error(`Failed to read datapoint ${i}: ${error}`);
    }
  }
  
  // Combine all content chunks
  const totalLength = contents.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  
  let offset = 0;
  for (const chunk of contents) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  
  console.log(`Successfully read ${combined.length} total bytes from ${dataPoints.length} datapoints`);
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
    headRequest?: boolean,
    chainId?: number
  } = {}
) {
  // Fetch the resource directly from the site
  const result = await fetchResourceFromSite(siteAddress, path, options);
  
  let content: string | null = null;
  let rawData: Uint8Array | null = null;
  
  if (result.type === 'HEAD') {
    // For HEAD requests, return just the metadata - updated to use new response structure
    return {
      status: result.response.status,
      metadata: result.response.metadata,
      etag: result.response.etag,
      content: null,
      rawData: null
    };
  } else {
    // For GET requests, process the content
    const getResponse = result.response;
    rawData = result.content;
    
    // Updated to use new response structure
    if (getResponse.head.status === 200n || getResponse.head.status === 206n) {
      if (rawData && rawData.length > 0) {
        // Convert the response data to a string if it's text
        const mimeType = getResponse.head.metadata.properties.mimeType;
        
        if (isText(mimeType)) {
          content = ethers.toUtf8String(rawData);
        } else {
          content = `<Binary data: ${rawData.length} bytes>`;
        }
      }
    }
    
    return {
      status: getResponse.head.status,
      metadata: getResponse.head.metadata,
      etag: getResponse.head.etag,
      content,
      rawData
    };
  }
}
