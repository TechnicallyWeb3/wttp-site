import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-change-network";
import "hardhat-contract-sizer";
import "hardhat-build";
import "hardhat-docgen";

// Import task definitions
import "./src/tasks/deploy";
import "./src/tasks/fetch";
import "./src/tasks/upload";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  networks: {
    hardhat: {
      // Default hardhat network configuration
    }
  }
};

export default config;
