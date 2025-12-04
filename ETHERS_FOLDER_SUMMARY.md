# Ethers Folder - Summary

## What Was Created

A new `src/ethers/` folder containing standalone versions of WTTP scripts that work with standard ethers.js (not Hardhat).

## Folder Structure

```
src/ethers/
├── README.md              - Complete documentation
├── index.ts               - Exports all standalone scripts
├── utils.ts               - Shared utilities
├── generateManifest.ts    - ✅ Fully implemented
├── fetchResource.ts       - ✅ Fully implemented
├── uploadFile.ts          - 🚧 API defined (needs implementation)
├── uploadDirectory.ts    - 🚧 API defined (needs implementation)
├── estimate.ts            - 🚧 API defined (needs implementation)
└── deploy.ts              - 🚧 API defined (needs implementation)
```

## What's Working

### ✅ generateManifest.ts
- Fully functional standalone version
- Works with or without provider
- Uses contract artifacts from `src/index.ts`
- Supports all manifest features

### ✅ fetchResource.ts
- Fully functional standalone version
- Accepts any ethers.js provider
- Uses Web3SiteArtifact.abi
- Supports HEAD and GET requests

## What Needs Implementation

The following scripts have API definitions but need full implementation:

- `uploadFile.ts` - Upload single files
- `uploadDirectory.ts` - Upload directories recursively
- `estimate.ts` - Estimate gas costs for uploads
- `deploy.ts` - Deploy new WTTP sites

## Usage Example

```typescript
import { ethers } from 'ethers';
import { Web3SiteArtifact } from './src';
import { generateManifestStandalone, fetchResource } from './src/ethers';

// Generate manifest
const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_KEY');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const wttpSite = new ethers.Contract(siteAddress, Web3SiteArtifact.abi, signer);

const manifest = await generateManifestStandalone(
  './my-site',
  '/',
  config,
  undefined,
  { provider, signer, wttpSite }
);

// Fetch resource
const resource = await fetchResource(
  provider,
  siteAddress,
  '/index.html'
);
```

## Key Differences from Hardhat Versions

1. **Imports**: Use `import { ethers } from "ethers"` instead of Hardhat
2. **Providers**: Accept providers as parameters instead of using `ethers.provider`
3. **Contracts**: Use `new Contract()` instead of `ethers.getContractAt()`
4. **Artifacts**: Import from `src/index.ts` instead of Hardhat artifacts

## Next Steps

To complete the standalone toolkit:

1. Implement `uploadFile.ts` - Copy from `src/scripts/uploadFile.ts` and adapt
2. Implement `uploadDirectory.ts` - Copy from `src/scripts/uploadDirectory.ts` and adapt
3. Implement `estimate.ts` - Copy from `src/scripts/uploadFile.ts` and `uploadDirectory.ts` estimate functions
4. Implement `deploy.ts` - Copy from `src/tasks/deploy.ts` and adapt

## Documentation

- **Complete Guide**: [src/ethers/README.md](./src/ethers/README.md)
- **Original Standalone Usage**: Moved to `src/ethers/README.md`

