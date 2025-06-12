import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-change-network";
import "hardhat-contract-sizer";
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
      chainId: 31337,
      // Default hardhat network configuration
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Connect to local hardhat node
    }
  }
};

export default config;
