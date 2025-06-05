import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-change-network";
import "hardhat-contract-sizer";

// // Import task definitions
// import "./tasks/deploy";
// import "./tasks/fetch";
// import "./tasks/upload";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  }
};

export default config;
