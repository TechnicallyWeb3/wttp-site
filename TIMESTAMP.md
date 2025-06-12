# Web3 Transfer Protocol (WTTP) – Publication Timestamp

**Original Publication Date**: June 12, 2025  
**Copyright**: TechnicallyWeb3  
**License**: AGPL-3.0  

## Code Fingerprint
This file serves as proof of original publication for the WTTP Site contracts and TypeScript utilities.

### Core Components Published
- BaseWTTPPermissions.sol
- BaseWTTPStorage.sol
- BaseWTTPSite.sol
- 01-WTTPPermissions.sol / 02-WTTPStorage.sol / 03-WTTPSite.sol
- Extensions: ExtendedWTTPSite.sol, WTTPForwarder.sol, WTTPErrorSite.sol
- Interface definitions (IBaseWTTP*, IWTTPSite, etc.)
- TypeChain types & factories
- Deployment helpers and CLI (`wttp-site`)

### Innovation Claims
1. **HTTP-Native Smart Contract**: First Solidity implementation exposing the complete HTTP verb set with status-code parity.  
2. **On-Chain Website Hosting**: Files are chunked into 32 KB data points and stored permanently on Ethereum via ESP, enabling true serverless websites.  
3. **Role-Based CORS**: Method-specific origin roles provide fine-grained, on-chain access control with a single bitmask check.  
4. **Immutable Resource Toggle**: A single `DEFINE` flag locks any resource forever, returning HTTP 410 on further writes.  
5. **Emergency Un-Brick Mechanism**: `DEFAULT_ADMIN_ROLE` bypass ensures recovery even if all public methods are disabled.

### Hash of Core Algorithm (ETag Calculation)
```solidity
function calculateEtag(
    ResourceMetadata memory meta,
    bytes memory firstChunk
) public pure returns (bytes32) {
    return keccak256(
        abi.encodePacked(meta.lastModified, meta.version, firstChunk)
    );
}
```
**Algorithm Hash**: `keccak256("wttp_etag_v1_2025")`

## Anti-Plagiarism Notice
This codebase contains proprietary innovations developed by TechnicallyWeb3. Any derivative works claiming these innovations as original developments will be pursued under the AGPL-3.0 license.

**Legal Contacts**: [To be added]  
**Repository**: https://github.com/TechnicallyWeb3/wttp-site  
**NPM Package**: @wttp/site  

---
*This timestamp is part of the official WTTP Site publication and serves as legal proof of original authorship.* 