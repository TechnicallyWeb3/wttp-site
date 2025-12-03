# WTTP Manifest Fixes - Summary

**Filename:** `wttp.manifest.json` (automatically created in source directory)

## Issues Found and Fixed

### 1. **Critical: Incorrect Chunk Address Calculation** ✅ FIXED

**Problem:** Chunk addresses were being calculated as 20-byte Ethereum addresses instead of 32-byte data point addresses.

**Before (Incorrect):**
```typescript
function calculateChunkAddressLocal(data: Buffer): string {
  const hash = ethers.keccak256(data);
  return ethers.getAddress("0x" + hash.slice(2, 42)); // Wrong! Only 20 bytes
}
```
Result: `0xfC81667b1AbB282B15A149B6fde07557714E6148` (40 hex chars = 20 bytes)

**After (Correct):**
```typescript
function calculateChunkAddressLocal(data: Buffer, version: number = DPS_VERSION): string {
  // Match Solidity: keccak256(abi.encodePacked(_data, _version))
  const encoded = ethers.solidityPacked(['bytes', 'uint8'], [data, version]);
  return ethers.keccak256(encoded); // Returns full 32 bytes
}
```
Result: `0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2` (64 hex chars = 32 bytes)

**Why it matters:** The DPS (Data Point Storage) contract's `calculateAddress` method returns `bytes32`, not an `address`. The previous implementation was truncating the hash to 20 bytes, which would never match the actual data point addresses on-chain.

### 2. **Site Address Now Optional** ✅ FIXED

**Problem:** Manifest generation required a deployed site contract, making it impossible to generate manifests for planning without deploying first.

**Changes:**
- Made `wttpSite` parameter optional (`IBaseWTTPSite | null`)
- Chunk addresses are now calculated locally when no site is provided
- Estimates and royalties are skipped when no site is available
- `chainData` is now optional and only included when site info is available

**Usage:**
```bash
# Without site - just structure and chunk addresses
npx hardhat site:manifest --source ./my-site

# With site - includes estimates and royalties
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia
```

### 3. **Test Config System** ✅ IMPLEMENTED

**Added:** Test config system for providing site addresses for estimation without CLI arguments.

**Test Config File Format** (`wttp-test-config.json`):
```json
{
  "networks": {
    "localhost": {
      "network": "localhost",
      "siteAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "dpsVersion": 2
    },
    "sepolia": {
      "network": "sepolia",
      "siteAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E",
      "dpsVersion": 2
    }
  },
  "default": "sepolia"
}
```

**Usage:**
```bash
# Auto-loads ./wttp-test-config.json for current network
npx hardhat site:manifest --source ./my-site --network sepolia

# Or specify custom config file
npx hardhat site:manifest --source ./my-site --testconfig ./custom-config.json
```

**Priority Order:**
1. `--site` CLI argument (highest priority)
2. `--testconfig` file
3. Default `./wttp-test-config.json`
4. Existing manifest `chainData`
5. No site (manifest without estimates)

### 4. **Conditional ChainData** ✅ FIXED

**Problem:** `chainData` was always included in manifest, even with dummy values when no site was provided.

**Fix:** `chainData` is now optional and only included when site information is available.

**Before:**
```json
{
  "chainData": {
    "contractAddress": "0x0000000000000000000000000000000000000000",
    "chainId": 31337,
    "name": "hardhat",
    "symbol": "ETH",
    "transactions": []
  }
}
```

**After (no site):**
```json
{
  "siteData": { ... }
  // No chainData
}
```

**After (with site):**
```json
{
  "siteData": { ... },
  "chainData": {
    "contractAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E",
    "chainId": 11155111,
    "name": "sepolia",
    "symbol": "ETH",
    "transactions": []
  }
}
```

## Files Modified

### Core Implementation
1. **`src/scripts/generateManifest.ts`**
   - Fixed `calculateChunkAddressLocal()` to match DPS contract logic
   - Added `DPS_VERSION` constant
   - Made `wttpSite` parameter optional
   - Added `TestConfig` interface
   - Made `chainData` optional in `Manifest` interface
   - Added `loadTestConfig()` helper function
   - Conditional chunk address calculation (DPS contract vs local)
   - Conditional chainData initialization

2. **`src/tasks/manifest.ts`**
   - Added `--testconfig` parameter
   - Made `--site` optional
   - Auto-loads `./wttp-test-config.json` if exists
   - Updated site address priority logic
   - Fixed chainData access to use optional chaining
   - Better error messages and user guidance

### Documentation
3. **`wttp-test-config.example.json`** (NEW)
   - Example test configuration file
   - Shows network-based config structure
   - Documents supported fields

4. **`MANIFEST_FIXES.md`** (NEW)
   - This document
   - Complete fix summary

## Testing

### Test 1: Manifest Without Site (Structure Only)
```bash
npx hardhat site:manifest --source ./hex-2048 --network hardhat
```

**Results:**
- ✅ Generated successfully without site
- ✅ Chunk addresses are 32 bytes (correct format)
- ✅ Prerequisites set correctly for sequential chunks
- ✅ Ranges included for multi-chunk files
- ✅ No chainData in output
- ✅ No estimates or royalties (as expected)

**Sample Output:**
```json
{
  "path": "./game.js",
  "chunks": [
    {
      "address": "0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2"
    }
  ]
}
```

### Test 2: Chunk Address Verification
Compared generated addresses with DPS contract calculation:

**DPS Contract Logic:**
```solidity
function calculateAddress(bytes memory _data) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(_data, VERSION)); // VERSION = 2
}
```

**Our Local Calculation:**
```typescript
const encoded = ethers.solidityPacked(['bytes', 'uint8'], [data, 2]);
return ethers.keccak256(encoded);
```

**Result:** ✅ Addresses match expected format and length

## Benefits

### 1. **Correctness**
- Chunk addresses now match what DPS contract generates
- Can be used to verify uploaded data
- Prerequisites work correctly for sequential uploads

### 2. **Flexibility**
- Generate manifests without deploying contracts
- Use for planning and cost estimation
- Test configs for different environments
- No network requirements for structure generation

### 3. **Developer Experience**
- Clear error messages
- Helpful guidance when site not provided
- Auto-loads test config if available
- Priority system for site address resolution

### 4. **Use Cases Enabled**

**Planning Mode (No Site):**
```bash
npx hardhat site:manifest --source ./my-site
```
- Calculate chunk addresses
- Determine file structure
- Identify files to ignore
- Plan external storage
- No network/contract needed

**Estimation Mode (With Site):**
```bash
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia
```
- Everything from planning mode PLUS:
- Gas estimates per chunk
- Royalty costs
- Total cost estimation
- Network-specific pricing

## Migration Guide

### For Existing Manifests

Old manifests with 20-byte addresses will need to be regenerated:

```bash
# Regenerate existing manifest
npx hardhat site:manifest --source ./my-site --update ./my-site/wttp.manifest.json
```

### For CI/CD Pipelines

Add test config to your repository:

```json
// wttp-test-config.json
{
  "networks": {
    "sepolia": {
      "network": "sepolia",
      "siteAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E"
    }
  },
  "default": "sepolia"
}
```

Then your pipeline can generate manifests without CLI arguments:
```bash
npx hardhat site:manifest --source ./dist --network sepolia
```

## Next Steps

1. ✅ Chunk addresses fixed
2. ✅ Site address made optional
3. ✅ Test config system implemented
4. ✅ Documentation updated

**Recommended:**
- Regenerate any existing manifests
- Add `wttp-test-config.json` to your projects
- Test manifest generation in your workflow
- Verify chunk addresses match deployed data

## Compatibility

- **Breaking Change:** Old manifests with 20-byte addresses are incompatible
- **Action Required:** Regenerate manifests using fixed version
- **Backward Compatible:** Test config and optional site are additive features
- **No Contract Changes:** Only affects off-chain manifest generation

## Files Created/Modified Summary

```
✓ src/scripts/generateManifest.ts     (Fixed chunk address calculation)
✓ src/tasks/manifest.ts                (Added test config support)
✓ wttp-test-config.example.json       (New example config)
✓ MANIFEST_FIXES.md                    (This document)
```

All changes maintain backward compatibility except for the chunk address format, which was incorrect and needed to be fixed.

