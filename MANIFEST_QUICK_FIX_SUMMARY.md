# WTTP Manifest - Quick Fix Summary

**Filename:** `wttp.manifest.json`

## What Was Wrong

Chunk addresses were **20 bytes** (Ethereum addresses) instead of **32 bytes** (data point addresses):

```json
❌ BEFORE: "address": "0xfC81667b1AbB282B15A149B6fde07557714E6148"
           (40 hex chars = 20 bytes)

✅ AFTER:  "address": "0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2"
           (64 hex chars = 32 bytes)
```

## What Was Fixed

### 1. Chunk Address Calculation
Changed from truncated hash to full keccak256 to match DPS contract:

```typescript
// BEFORE (Wrong)
const hash = ethers.keccak256(data);
return ethers.getAddress("0x" + hash.slice(2, 42)); // Truncated!

// AFTER (Correct)
const encoded = ethers.solidityPacked(['bytes', 'uint8'], [data, version]);
return ethers.keccak256(encoded); // Full 32 bytes
```

### 2. Site Address Made Optional
You can now generate manifests without a deployed site:

```bash
# Structure only (no estimates)
npx hardhat site:manifest --source ./my-site

# With estimates
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia
```

### 3. Test Config System
Create `wttp-test-config.json` for automatic site resolution:

```json
{
  "networks": {
    "sepolia": {
      "network": "sepolia",
      "siteAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E"
    }
  }
}
```

## Action Required

**⚠️ Regenerate any existing manifests:**

```bash
npx hardhat site:manifest --source ./your-site --network hardhat
```

Old manifests with 20-byte addresses won't match actual on-chain data point addresses.

## Verification

Check your manifest - addresses should be 64 hex characters (32 bytes):

```bash
# Good: 64 chars after 0x
0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2

# Bad: 40 chars after 0x (old format)
0xfC81667b1AbB282B15A149B6fde07557714E6148
```

## Files Changed

- ✅ `src/scripts/generateManifest.ts` - Fixed calculation
- ✅ `src/tasks/manifest.ts` - Added test config support
- ✅ `wttp-test-config.example.json` - Example config
- ✅ `src/scripts/wttpIgnore.ts` - Added `wttp.manifest.json` to ignore patterns

## Testing

Verified with `hex-2048` directory:
- ✅ 11 files processed
- ✅ 119 chunks generated
- ✅ All addresses are 32 bytes
- ✅ Prerequisites work correctly
- ✅ Ranges included for multi-chunk files
- ✅ Works without site address

## Quick Commands

```bash
# Generate manifest (no site needed)
npx hardhat site:manifest --source ./my-site

# Generate with estimates (requires deployed site)
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia

# Use test config
npx hardhat site:manifest --source ./my-site --testconfig ./wttp-test-config.json

# Update existing manifest
npx hardhat site:manifest --source ./my-site --update ./my-site/wttp.manifest.json
```

## What Works Now

✅ Chunk addresses match DPS contract format  
✅ Manifests work without deployed contracts  
✅ Test config for easy CI/CD integration  
✅ Prerequisites for sequential uploads  
✅ External storage rules  
✅ Optional estimates and royalties  

## Documentation

- **Complete Guide**: [MANIFEST_FIXES.md](./MANIFEST_FIXES.md)
- **Usage Examples**: [MANIFEST_EXAMPLE.md](./MANIFEST_EXAMPLE.md)
- **API Reference**: [MANIFEST.md](./MANIFEST.md)
- **Quick Start**: [MANIFEST_QUICKSTART.md](./MANIFEST_QUICKSTART.md)

