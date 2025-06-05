import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-change-network";

// Import task definitions
import "./tasks/deploy";
import "./tasks/fetch";
import "./tasks/upload";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
};

export default config;
