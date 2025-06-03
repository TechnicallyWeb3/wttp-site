// This module deploys a WTTP site using Hardhat Ignition
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";
import { getContractAddress } from "@tw3/esp";

// Default header configuration for WTTP sites
const DEFAULT_HEADER = {
  methods: 511, // All methods allowed (bitmask for all 9 methods)
  cache: {
    maxAge: 3600, // 1 hour
    noStore: false,
    noCache: false,
    immutableFlag: false,
    publicFlag: true
  },
  redirect: {
    code: 0,
    location: ""
  },
  resourceAdmin: ethers.ZeroHash // Default admin role
};

const WTTPSiteModule = buildModule("WTTPSiteModule", (m) => {

  const DPR_ADDRESS = getContractAddress(11155111, "dpr"); // default to Sepolia(all deployments should match anyway since we're using vanity addresses), dpr should be passed in as a parameter

  const dataPointRegistry = m.getParameter("dpr", DPR_ADDRESS);
  const owner = m.getParameter("owner", m.getAccount(0));

  // Deploy the WTTP site using the provided or default DPR
  const wttpSite = m.contract("Web3Site", [
    dataPointRegistry,
    DEFAULT_HEADER,
    owner
  ]);

  return { 
    wttpSite
  };
});

export default WTTPSiteModule;