# Standalone Ethers.js Scripts

This folder contains standalone versions of WTTP scripts that work with standard ethers.js (not Hardhat).

## Status

✅ **Implemented:**
- `generateManifest.ts` - Generate manifest files (fully functional)
- `fetchResource.ts` - Fetch resources from sites (fully functional)

🚧 **In Progress:**
- `uploadFile.ts` - Upload single files (API defined, implementation needed)
- `uploadDirectory.ts` - Upload directories (API defined, implementation needed)
- `estimate.ts` - Estimate gas costs (API defined, implementation needed)
- `deploy.ts` - Deploy sites (API defined, implementation needed)

## Quick Start

### Generate Manifest (No Provider Needed)

```typescript
import { generateManifestStandalone, saveManifest } from './src/ethers/generateManifest';

const manifest = await generateManifestStandalone(
  './my-website',
  '/',
  {
    externalStorageRules: [
      { minSizeBytes: 1048576, provider: 'arweave', mimeTypes: ['*'] }
    ]
  }
);

saveManifest(manifest);
```

### Generate Manifest with Estimates

```typescript
import { ethers } from 'ethers';
import { Web3SiteArtifact } from '../index';
import { generateManifestStandalone, saveManifest } from './src/ethers/generateManifest';

const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_KEY');
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const wttpSite = new ethers.Contract(siteAddress, Web3SiteArtifact.abi, signer);

const manifest = await generateManifestStandalone(
  './my-website',
  '/',
  config,
  undefined,
  { provider, signer, wttpSite, currencySymbol: 'ETH' }
);

saveManifest(manifest);
```

### Fetch Resource

```typescript
import { ethers } from 'ethers';
import { fetchResource } from './src/ethers/fetchResource';

const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_KEY');
const result = await fetchResource(
  provider,
  '0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E',
  '/index.html'
);

console.log(`Status: ${result.response.head.status}`);
console.log(`Content: ${result.content?.length} bytes`);
```

## Differences from Hardhat Versions

| Feature | Hardhat Version | Standalone Version |
|---------|----------------|-------------------|
| Import | `import { ethers } from "hardhat"` | `import { ethers } from "ethers"` |
| Provider | `ethers.provider` (Hardhat) | Any ethers.js provider |
| Contracts | `ethers.getContractAt()` | `new Contract(address, abi, provider)` |
| Environment | Requires Hardhat | Any Node.js environment |
| Artifacts | Hardhat artifacts | Import from `src/index.ts` |

## API Reference

### generateManifestStandalone

```typescript
generateManifestStandalone(
  sourcePath: string,
  destinationPath: string,
  config?: ManifestConfig,
  existingManifest?: Manifest,
  options?: {
    provider?: ethers.Provider;
    signer?: ethers.Signer;
    wttpSite?: Contract;
    chainId?: number;
    chainName?: string;
    currencySymbol?: string;
  }
): Promise<Manifest>
```

### fetchResource

```typescript
fetchResource(
  provider: ethers.Provider,
  siteAddress: string,
  path?: string,
  options?: {
    ifModifiedSince?: number;
    ifNoneMatch?: string;
    range?: RangeStruct;
    headRequest?: boolean;
    datapoints?: boolean;
    chainId?: number;
  }
): Promise<{
  response: LOCATEResponseStruct;
  content?: Uint8Array;
}>
```

## Using Contract Artifacts

All standalone scripts use the exported artifacts from `src/index.ts`:

```typescript
import { Web3SiteArtifact } from '../index';

const wttpSite = new ethers.Contract(
  siteAddress,
  Web3SiteArtifact.abi,
  provider
);
```

## Contributing

To implement the remaining standalone scripts:

1. Copy the Hardhat version from `src/scripts/`
2. Replace `import { ethers } from "hardhat"` with `import { ethers } from "ethers"`
3. Replace `ethers.provider` with the provided `provider` parameter
4. Replace `await ethers.provider.getSigner()` with the provided `signer` parameter
5. Replace `ethers.getContractAt()` with `new Contract(address, abi, provider)`
6. Use `Web3SiteArtifact.abi` from `src/index.ts` for contract ABIs

## See Also

- [Hardhat Scripts](../scripts/) - Original Hardhat versions
- [Hardhat Tasks](../tasks/) - Hardhat task definitions
- [Main Index](../index.ts) - Exported artifacts and types
