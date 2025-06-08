import { task } from "hardhat/config";
import { IWTTPGateway, IWTTPGateway__factory } from "@wttp/core";

task("fetch", "Fetch a resource from a WTTP site via the WTTPGateway")
  .addParam("wttp", "The address of the WTTPGateway")
  .addParam("site", "The address of the WTTP site")
  .addParam("path", "The path to the resource")
  .addOptionalParam("range", "Byte range in format 'start-end' (e.g., '10-20')")
  .addOptionalParam("ifModifiedSince", "Unix timestamp for If-Modified-Since header")
  .addOptionalParam("ifNoneMatch", "ETag value for If-None-Match header")
  .addFlag("head", "Perform a HEAD request instead of GET")
  .setAction(async (taskArgs, hre) => {

    const { fetchResource, isText } = require("../scripts/fetchResource");
    const { bytes2ToMimeType } = require("../scripts/uploadFile");
    const { wttp, site, path, range, ifModifiedSince, ifNoneMatch, head } = taskArgs;

    const gateway: IWTTPGateway = IWTTPGateway__factory.connect(wttp, hre.ethers.provider);
    
    // Parse range if provided
    let rangeOption = undefined;
    if (range) {
      const [start, end] = range.split("-").map((n: string) => parseInt(n.trim()));
      rangeOption = { start, end };
    }
    
    // Parse ifModifiedSince if provided
    const ifModifiedSinceOption = ifModifiedSince ? parseInt(ifModifiedSince) : undefined;    
    // Fetch the resource
    const response = await fetchResource(
      gateway,
      site,
      path,
      {
        range: rangeOption,
        ifModifiedSince: ifModifiedSinceOption,
        ifNoneMatch,
        headRequest: head
      }
    );

    console.log("\n=== WTTP Response ===");
    let headData = undefined;
    let mimeType = undefined;
    if (head) {
      headData = response;
      mimeType = headData.metadata.properties.mimeType;
      console.log("\n=== HEAD Response ==="); 
    } else {
      headData = response.head;
      mimeType = headData.metadata.properties.mimeType;
      console.log("\n=== GET Response ===");
      console.log("\n=== Content ===");
      if (isText(mimeType)) {
        console.log(`Data: ${hre.ethers.toUtf8String(response.data)}`);
      } else {
        console.log(`Data: ${response.data.length - 2} bytes`); // remove the 0x prefix
      }
      console.log("================\n");
    }

    console.log(`ETag: ${headData.etag}`);
    console.log(`Last Modified: ${new Date(Number(headData.metadata.lastModified) * 1000).toISOString()}`);
    console.log(`Content-Type: ${bytes2ToMimeType(mimeType)}`);
    console.log(`Charset: ${headData.metadata.properties.charset}`);
    console.log(`Encoding: ${headData.metadata.properties.encoding}`);
    console.log(`Language: ${headData.metadata.properties.language}`);
    console.log(`Size: ${headData.metadata.size} bytes`);
    console.log(`Version: ${headData.metadata.version}`);
    
    if (response.content) {
      console.log("\n=== Content ===");
      // If content is too large, truncate it
      const maxContentLength = 1000;
      if (response.content.length > maxContentLength) {
        console.log(`${response.content.substring(0, maxContentLength)}... (truncated, ${response.content.length} bytes total)`);
      } else {
        console.log(response.content);
      }
    }
    
    return response;
  });

export default {};