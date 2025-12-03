# WTTP Manifest Quick Reference

## Generate a Manifest

```bash
# Basic usage (no site needed - structure only)
npx hardhat site:manifest --source ./my-site

# With cost estimates (requires deployed site)
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia

# With external storage for large files
npx hardhat site:manifest \
  --source ./my-site \
  --site 0x... \
  --externalrules ./external-storage-rules.json \
  --network sepolia

# With configuration
npx hardhat site:manifest \
  --source ./my-site \
  --site 0x... \
  --gaslimit 300 \
  --filelimit 50 \
  --network sepolia
```

## Example External Storage Rules

Create `external-storage-rules.json`:

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"],
    "extensions": [".png", ".jpg", ".mp4"]
  }
]
```

## Manifest Output Structure

File: `wttp.manifest.json`

```json
{
  "name": "my-site",
  "path": "./my-site/",
  "siteData": {
    "directories": [
      {
        "path": "/",
        "index": "./index.html"
      }
    ],
    "files": [
      {
        "path": "./index.html",
        "type": "text/html",
        "size": 30000,
        "status": "pending",
        "chunks": [
          {
            "address": "0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2",
            "estimate": 200000,
            "royalty": 0.001,
            "gas": 0.0053
          }
        ]
      }
    ]
  },
  "chainData": {
    "contractAddress": "0x8de4...",
    "chainId": 11155111,
    "name": "sepolia",
    "symbol": "ETH",
    "transactions": []
  }
}
```

## Using Manifest for Custom Upload

```typescript
// Load
const manifest = JSON.parse(fs.readFileSync('wttp.manifest.json', 'utf-8'));

// Find pending chunks (no prerequisites)
const pending = manifest.siteData.files
  .flatMap(f => f.chunks
    .filter(c => !c.txHash && !c.prerequisite)
    .map(c => ({ file: f, chunk: c }))
  );

// Upload chunk
await uploadChunk(pending[0].file, pending[0].chunk);

// Update status
pending[0].chunk.txHash = "0x...";
pending[0].file.status = "1/3";
fs.writeFileSync('wttp.manifest.json', JSON.stringify(manifest, null, 2));
```

## Key Features

- ✅ Pre-calculated chunk addresses (32-byte data point addresses)
- ✅ Royalty costs before upload (when site provided)
- ✅ Gas estimates per transaction (when site provided)
- ✅ External storage for large files
- ✅ Status tracking (pending → x/y → complete)
- ✅ Chunk prerequisites for ordering
- ✅ Transaction history
- ✅ Works without deployed site

## Common Commands

```bash
# Generate manifest (no site needed)
npx hardhat site:manifest --source ./site

# Generate with estimates (requires site)
npx hardhat site:manifest --source ./site --site 0x... --network sepolia

# Upload using standard uploader
npx hardhat site:upload --source ./site --site 0x... --network sepolia

# Update manifest after partial upload
npx hardhat site:manifest --source ./site --update ./site/wttp.manifest.json
```

## File Status Values

- `pending` - Not uploaded
- `1/3` - Partial (1 of 3 chunks done)
- `complete` - Fully uploaded

## Chunk Address Format

✅ Correct (32 bytes): `0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2`  
❌ Wrong (20 bytes): `0xfC81667b1AbB282B15A149B6fde07557714E6148`

Chunk addresses are **bytes32** (64 hex characters), not Ethereum addresses.

## Chunk Prerequisites

```json
{
  "chunks": [
    {
      "address": "0x7a3d2e1c...",
      "estimate": 200000
    },
    {
      "address": "0x4f3e2d1c...",
      "prerequisite": "0x7a3d2e1c...",
      "estimate": 150000
    },
    {
      "address": "0x2e1d0c9b...",
      "prerequisite": "0x4f3e2d1c...",
      "estimate": 150000
    }
  ]
}
```

Upload chunks in order: second chunk after first completes, third after second completes.

## Test Config

Create `wttp-test-config.json` for automatic site resolution:

```json
{
  "networks": {
    "localhost": {
      "network": "localhost",
      "siteAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    },
    "sepolia": {
      "network": "sepolia",
      "siteAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E"
    }
  },
  "default": "sepolia"
}
```

Then simply run:

```bash
npx hardhat site:manifest --source ./site --network sepolia
```

The site address will be loaded automatically from the config.

## Two Modes

### Planning Mode (No Site)

```bash
npx hardhat site:manifest --source ./site
```

Generates:
- File structure
- Chunk addresses
- Prerequisites
- Ignored files list

Does NOT include:
- Gas estimates
- Royalty costs
- Chain data

### Estimation Mode (With Site)

```bash
npx hardhat site:manifest --source ./site --site 0x... --network sepolia
```

Generates everything from planning mode PLUS:
- Gas estimates per chunk
- Royalty costs
- Total cost breakdown
- Chain information

## External Storage

Files matching external storage rules get special handling:

```json
{
  "path": "./large-video.mp4",
  "type": "video/mp4",
  "externalStorage": "arweave",
  "size": 300000000,
  "status": "pending",
  "redirect": {
    "code": 301,
    "location": "arweave://[pending]"
  },
  "chunks": []
}
```

These files are uploaded to external providers instead of blockchain.

## Documentation

- **Full API**: [MANIFEST.md](./MANIFEST.md)
- **Examples**: [MANIFEST_EXAMPLE.md](./MANIFEST_EXAMPLE.md)
- **Fixes**: [MANIFEST_FIXES.md](./MANIFEST_FIXES.md)

## Quick Tips

1. **Generate without site first** to see structure and chunk count
2. **Add test config** to your repo for CI/CD
3. **Use external storage** for files > 10MB
4. **Update manifest** after partial uploads to track progress
5. **Verify chunk addresses** are 64 hex chars (32 bytes)
