# Ethers Standalone Requirements for @wttp/core

## Current Usage Analysis

Our standalone ethers scripts (`src/ethers/`) currently use:

### From @wttp/core:
1. **TypeChain Types & Interfaces:**
   - `IBaseWTTPSite` - Interface type for contract typing
   - `LOCATEResponseStruct` - Response structure types
   - `HEADRequestStruct`, `DEFINERequestStruct`, etc. - Request structure types

2. **Utilities:**
   - `encodeCharset`, `encodeMimeType` - Encoding utilities
   - `normalizePath` - Path normalization
   - `DEFAULT_HEADER` - Default header configuration

3. **Factories (available but not currently used in standalone):**
   - `IBaseWTTPSite__factory` - Has `.abi` property but no `.bytecode` (interface only)

### From @wttp/site (local):
1. **Contract Artifacts:**
   - `Web3SiteArtifact` - Full artifact with `.abi` and `.bytecode`
   - Currently imported directly from `artifacts/` folder to avoid Hardhat task registration

## Recommendations for @wttp/core

### Option 1: Export Interface Artifacts (Recommended)
Since `@wttp/core` defines interfaces, it could export artifacts for those interfaces:

```typescript
// In @wttp/core/src/index.ts or separate export
export { default as IBaseWTTPSiteArtifact } from "../artifacts/contracts/interfaces/IBaseWTTPSite.sol/IBaseWTTPSite.json";
export { default as IBaseWTTPStorageArtifact } from "../artifacts/contracts/interfaces/IBaseWTTPStorage.sol/IBaseWTTPStorage.json";
// etc.
```

**Use case:** For creating contract instances when you only have an interface:
```typescript
import { IBaseWTTPSiteArtifact } from "@wttp/core";
const contract = new ethers.Contract(address, IBaseWTTPSiteArtifact.abi, signer);
```

### Option 2: Use Factory ABIs (Already Available)
The factories already have `.abi` properties:

```typescript
import { IBaseWTTPSite__factory } from "@wttp/core";
const contract = new ethers.Contract(address, IBaseWTTPSite__factory.abi, signer);
```

**Status:** This already works! We could use this instead of artifacts for interface contracts.

### Option 3: Standalone Export Path
Create a separate export that doesn't include Hardhat-specific things:

```json
// In @wttp/core/package.json
{
  "exports": {
    ".": { /* main export */ },
    "./standalone": {
      "import": "./dist/esm/standalone.js",
      "require": "./dist/cjs/standalone.js",
      "types": "./dist/types/standalone.d.ts"
    }
  }
}
```

**Use case:** Import without triggering Hardhat task registration:
```typescript
import { IBaseWTTPSite, IBaseWTTPSite__factory } from "@wttp/core/standalone";
```

## What We Actually Need

### For @wttp/site (not @wttp/core):
Since `Web3Site` is a contract in `@wttp/site`, we need:

1. **Export Web3SiteArtifact without Hardhat dependencies:**
   - Currently we import directly from artifacts folder
   - Could export from a "standalone" path in `@wttp/site` that doesn't load tasks

### For @wttp/core:
1. **Keep current exports** - They work well for standalone usage
2. **Optional: Export interface artifacts** - Would be convenient but factories already provide ABIs
3. **Optional: Standalone export path** - Would be nice but not critical

## Current Workaround

We're currently importing artifacts directly to avoid Hardhat task registration:

```typescript
// Instead of: import { Web3SiteArtifact } from "../index";
// We use:
import Web3SiteArtifact from "../../artifacts/contracts/Web3Site.sol/Web3Site.json";
```

This works but is less clean than importing from the package.

## Recommendation

**For @wttp/core:**
- ✅ Current exports are sufficient
- Optional: Export interface artifacts for convenience
- Optional: Add standalone export path for cleaner imports

**For @wttp/site:**
- Export `Web3SiteArtifact` from a path that doesn't trigger task registration
- Example: `export { Web3SiteArtifact } from "./artifacts/contracts/Web3Site.sol/Web3Site.json"` in a separate file

**Priority:**
1. **Low** - Current workaround works fine
2. **Medium** - Export artifacts from non-task-loading path in `@wttp/site`
3. **Low** - Additional exports from `@wttp/core` (nice to have but not critical)

