// Standalone version of fetchResource - works with standard ethers.js
import { ethers, Contract, Provider } from "ethers";
import { 
  type HEADRequestStruct, 
  ORIGINS_ADMIN_ONLY, 
  type HEADResponseStruct, 
  type LOCATEResponseStruct, 
  type RangeStruct,
  normalizePath
} from "@wttp/core";
// Import artifact directly to avoid loading tasks
import Web3SiteArtifact from "../../artifacts/contracts/Web3Site.sol/Web3Site.json";

/**
 * Fetches a resource directly from a WTTP site contract (standalone version)
 * 
 * @param provider - Ethers.js provider
 * @param siteAddress - The address of the WTTP site contract
 * @param path - The path to the resource
 * @param options - Optional parameters for the request
 * @returns The response from the site with full content
 */
export async function fetchResource(
  provider: Provider,
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
    throw new Error("Site address is required");
  }
  if (!provider) {
    throw new Error("Provider is required");
  }

  try {
    path = normalizePath(path || "/");
  } catch (error) {
    throw new Error(`Invalid path format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  const { 
    ifModifiedSince = 0, 
    ifNoneMatch = ethers.ZeroHash,
    range = { start: 0, end: 0 } as RangeStruct,
    headRequest = false, 
    datapoints = false, // false means fetch content, true means return only datapoint addresses
    chainId 
  } = options;

  if (process.env.WTTP_SITE_DEBUG) console.log(`🌐 Connecting to site: ${siteAddress}`);
  if (process.env.WTTP_SITE_DEBUG) console.log(`📄 Requesting resource: ${path}${headRequest ? ' (HEAD only)' : ''}`);

  // Get the site contract
  const siteContract = new Contract(siteAddress, Web3SiteArtifact.abi, provider);

  // Create the request
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
    if (process.env.WTTP_SITE_DEBUG) console.log(`Sending HEAD request for ${path} from site ${siteAddress}`);
    try {
      head = await siteContract.HEAD(headRequest_obj) as HEADResponseStruct;
    } catch (error: any) {
      if (process.env.WTTP_SITE_DEBUG) console.log("HEAD request failed, assuming file doesn't exist");
    }

    return { response: { head, resource: { dataPoints: [], totalChunks: 0 } }, content: undefined };

  } else {
    // For GET requests, use the site's GET method
    if (process.env.WTTP_SITE_DEBUG) console.log(`Fetching resource at ${path} from site ${siteAddress}`);
    
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
    
    if (process.env.WTTP_SITE_DEBUG) console.log(`Response status: ${locateResponse.head.status}`);
    
    if (locateResponse.head.status === 404n) {
      if (process.env.WTTP_SITE_DEBUG) console.log(`❌ Resource not found at ${path}`);
      return { response: locateResponse, content: undefined };
    }

    // If content is requested (datapoints is false), fetch the actual content
    if (!datapoints && locateResponse.resource.dataPoints.length > 0) {
      if (process.env.WTTP_SITE_DEBUG) console.log(`📦 Fetching ${locateResponse.resource.dataPoints.length} data points...`);
      
      // Get DPS address from site
      const dpsAddress = await siteContract.DPS();
      
      // Load DPS contract
      const dpsAbi = [
        "function readDataPoint(bytes32) external view returns (bytes memory)"
      ];
      const dps = new Contract(dpsAddress, dpsAbi, provider);
      
      // Read all data points
      const dataPointPromises = locateResponse.resource.dataPoints.map((dp) => 
        dps.readDataPoint(dp)
      );
      
      const dataPointContents = await Promise.all(dataPointPromises);
      
      // Convert bytes to Uint8Array
      const chunks: Uint8Array[] = dataPointContents.map((chunk: any) => {
        if (typeof chunk === 'string') {
          // If it's a hex string, convert it
          return new Uint8Array(ethers.getBytes(chunk));
        } else if (chunk instanceof Uint8Array) {
          return chunk;
        } else {
          // Assume it's already bytes-like
          return new Uint8Array(ethers.getBytes(chunk));
        }
      });
      
      // Combine all chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedContent = new Uint8Array(totalLength);
      
      let offset = 0;
      for (const chunk of chunks) {
        combinedContent.set(chunk, offset);
        offset += chunk.length;
      }
      
      if (process.env.WTTP_SITE_DEBUG) console.log(`✅ Fetched ${combinedContent.length} bytes`);
      return { response: locateResponse, content: combinedContent };
    }

    return { response: locateResponse, content: undefined };
  }
}

