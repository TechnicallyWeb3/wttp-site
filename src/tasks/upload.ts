import { task, types } from "hardhat/config";
import fs from "fs";

// Helper function to check if a path is a directory
function isDirectory(sourcePath: string): boolean {
  return fs.statSync(sourcePath).isDirectory();
}

task("site:upload", "Upload a file or directory to a WTTP site")
  .addParam("site", "The address of the WTTP site")
  .addParam("source", "The source file or directory path")
  .addOptionalParam("destination", "The destination path on the WTTP site", "/")
  .addOptionalParam("nodefaults", "Disable default ignore patterns", false, types.boolean)
  .setAction(async (taskArgs, hre) => {
    const { site, source, destination, nodefaults } = taskArgs;
    
    // Connect to the WTTP site
    const wtppSite = await hre.ethers.getContractAt("Web3Site", site);
    
    // Check if source is a file or directory
    if (isDirectory(source)) {
      console.log(`Source ${source} is a directory, using directory upload...`);
      // Import the directory upload function
      const { uploadDirectory } = require("../scripts/uploadDirectory");
      
      // Configure ignore options
      const ignoreOptions = {
        includeDefaults: !nodefaults
      };
      
      // Upload the directory
      await uploadDirectory(wtppSite, source, destination, ignoreOptions);
    } else {
      console.log(`Source ${source} is a file, using file upload...`);
      // Import the file upload function
      const { uploadFile } = require("../scripts/uploadFile");
      // Upload the file
      await uploadFile(wtppSite, source, destination);
    }
  });

export default {};