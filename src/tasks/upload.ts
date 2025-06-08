import { task } from "hardhat/config";
import fs from "fs";

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

task("upload", "Upload a file or directory to a WTTP site")
  .addParam("site", "The address of the WTTP site")
  .addParam("source", "The source file or directory path")
  .addParam("destination", "The destination path on the WTTP site")
  .setAction(async (taskArgs, hre) => {
    const { site, source, destination } = taskArgs;
    
    // Connect to the WTTP site
    const wtppSite = await hre.ethers.getContractAt("Web3Site", site);
    
    // Check if source is a file or directory
    if (isDirectory(source)) {
      console.log(`Source ${source} is a directory, using directory upload...`);
      // Import the directory upload function
      const { uploadDirectory } = require("../scripts/uploadDirectory");
      // Upload the directory
      await uploadDirectory(wtppSite, source, destination);
    } else {
      console.log(`Source ${source} is a file, using file upload...`);
      // Import the file upload function
      const { uploadFile } = require("../scripts/uploadFile");
      // Upload the file
      await uploadFile(wtppSite, source, destination);
    }
  });

export default {};