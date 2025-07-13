import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-change-network";
import "hardhat-contract-sizer";
import "hardhat-docgen";
import dotenv from "dotenv";
dotenv.config();

// Import task definitions
import "./src/tasks/deploy";
import "./src/tasks/fetch";
import "./src/tasks/upload";
import { ethers } from "ethers";

const mnemonic = process.env.OWNER_MNEMONIC || "test test test test test test test test test test test junk";
const accounts = ethers.Wallet.fromPhrase(mnemonic);

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
      accounts: {
        mnemonic: mnemonic,
        count: 20
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // Connect to local hardhat node
      accounts: {
        mnemonic: mnemonic,
        count: 20
      },
    },
    sepolia: {
      chainId: 11155111,
      url: "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: {
        mnemonic: mnemonic,
        count: 20
      },
    },
    polygon: {
      chainId: 137,
      url: "https://polygon-bor-rpc.publicnode.com",
      accounts: {
        mnemonic: mnemonic,
        count: 20
      },
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
    }
  },
};

export default config;
