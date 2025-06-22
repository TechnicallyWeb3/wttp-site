import { task } from "hardhat/config";
import { decodeCharset, decodeEncoding, decodeLanguage, decodeMimeType, IBaseWTTPSite, RangeStruct } from "@wttp/core";
import { loadContract } from "@tw3/esp";

task("site:fetch", "Fetch a resource from a WTTP site via the WTTPGateway")
  .addOptionalParam("url", "The URL of the WTTP site")
  .addOptionalParam("site", "The address of the WTTP site")
  .addOptionalParam("path", "The path to the resource", "/")
  .addOptionalParam("range", "Byte range in format 'start-end' (e.g., '10-20')")
  .addOptionalParam("ifModifiedSince", "Unix timestamp for If-Modified-Since header")
  .addOptionalParam("ifNoneMatch", "ETag value for If-None-Match header")
  .addFlag("head", "Perform a HEAD request instead of GET")
  .addFlag("datapoints", "Fetch datapoints instead of resource data")
  .setAction(async (taskArgs, hre) => {

    if (!taskArgs.url && !taskArgs.site) {
      throw new Error("Either --url or --site must be provided");
    }

    if (taskArgs.url && taskArgs.site) {
      console.log("WARNING: Both --url and --site provided, using --url");
    }

    if (taskArgs.url) {
      const url = new URL(taskArgs.url);
      taskArgs.site = url.hostname;
      taskArgs.path = url.pathname;
    }

    const { fetchResource, isText } = require("../scripts/fetchResource");
    const { site, path, range, ifModifiedSince, ifNoneMatch, head, datapoints } = taskArgs;
    
    // Parse range if provided
    let rangeOption: RangeStruct | undefined = undefined;
    if (range) {
      const [start, end] = range.split("-").map((n: string) => parseInt(n.trim()));
      rangeOption = { start, end } as RangeStruct;
    }
    
    // Parse ifModifiedSince if provided
    const ifModifiedSinceOption = ifModifiedSince ? parseInt(ifModifiedSince) : undefined;    
    // Fetch the resource
    const resource = await fetchResource(
      site,
      path,
      {
        range: rangeOption,
        ifModifiedSince: ifModifiedSinceOption,
        ifNoneMatch,
        headRequest: head,
        datapoints,
      },
    );
    // console.log(response);

    console.log("\n=== WTTP Response ===");
    const status = resource.response.head.status;
    console.log(`Status: ${status}`);
    if (status >= 300n && status < 310n) {
      console.log(`Redirect: ${resource.response.head.headerInfo.redirect.location}`);
    }

    const metadata = resource.response.head.metadata;
    const resourceSize = metadata.size;
    const mimeTypeBytes = metadata.properties.mimeType;

    if (head) {
      console.log("\n=== HEAD Response ==="); 
      if (datapoints) {
        console.log("\nWARNING: --datapoints is not supported for HEAD requests");
      }
    } else {
      console.log("\n=== GET Response ===");
      if (!datapoints) {
        console.log("\n=== Content ===");
        if (isText(mimeTypeBytes)) {
          const maxContentLength = 1000;
          const truncatedMessage = resource.content.length > maxContentLength ? `... (truncated, ${resourceSize} bytes total)` : "";
          console.log(`Data: ${hre.ethers.toUtf8String(resource.content).substring(0, maxContentLength)}${truncatedMessage}`);
        } else {
          console.log(`Data: ${resourceSize} bytes`); // remove the 0x prefix
        }
        console.log("================\n");
      }
    }

    console.log(`Content-Type: ${decodeMimeType(mimeTypeBytes)}`);
    console.log(`CharsetBytes: ${metadata.properties.charset}`);
    console.log(`Charset: ${decodeCharset(metadata.properties.charset)}`);
    console.log(`Encoding: ${decodeEncoding(metadata.properties.encoding)}`);
    console.log(`Language: ${decodeLanguage(metadata.properties.language)}`);
    console.log(`Size: ${metadata.size} bytes`);
    console.log(`Version: ${metadata.version}`); 
    console.log(`ETag: ${resource.response.head.etag}`);
    console.log(`Last Modified: ${new Date(Number(metadata.lastModified) * 1000).toISOString()}`);

    if (datapoints) {
      console.log(`Datapoints: ${resource.response.dataPoints}`);
    }
    
    return resource;
  });

export default {};