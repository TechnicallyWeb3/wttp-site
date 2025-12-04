export * from "./scripts";
export * from "./tasks";

// Standalone ethers.js implementations (usable outside Hardhat)
export * as ethersStandalone from "./ethers";

// Shared utilities (also available through scripts, but exported here for direct access)
export {
  looseEqual,
  chunkData,
  getMimeType,
  getMimeTypeWithCharset,
  getChainSymbolFromChainId
} from "./utils";

export * from "../typechain-types";

export { default as Web3SiteArtifact } from "../artifacts/contracts/Web3Site.sol/Web3Site.json";
export { default as BaseWTTPSiteArtifact } from "../artifacts/contracts/BaseWTTPSite.sol/BaseWTTPSite.json";
export { default as BaseWTTPPermissionsArtifact } from "../artifacts/contracts/BaseWTTPPermissions.sol/BaseWTTPPermissions.json";
export { default as BaseWTTPStorageArtifact } from "../artifacts/contracts/BaseWTTPStorage.sol/BaseWTTPStorage.json";
export { default as ExtendedWTTPSiteArtifact } from "../artifacts/contracts/extensions/ExtendedWTTPSite.sol/ExtendedWTTPSite.json";
export { default as WTTPForwarderArtifact } from "../artifacts/contracts/extensions/WTTPForwarder.sol/WTTPForwarder.json";
export { default as WTTPErrorSiteArtifact } from "../artifacts/contracts/extensions/WTTPErrorSite.sol/WTTPErrorSite.json";