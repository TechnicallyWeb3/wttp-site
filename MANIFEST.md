# WTTP Manifest System

The WTTP manifest system provides a pre-calculated plan for uploading websites to the blockchain, allowing external uploaders and custom tools to efficiently manage the upload process with full control over transaction ordering and parallel uploads.

## Overview

The `wttp.manifest.json` file contains:
- Complete file structure analysis
- Pre-calculated chunk addresses (32-byte data point addresses)
- Gas estimates for each transaction (when site provided)
- Royalty costs (when site provided)
- Upload status tracking
- External storage rules for large files
- Transaction history and references

## Generating a Manifest

### Basic Usage (No Site Required)

Generate a manifest with just file structure and chunk addresses:

```bash
npx hardhat site:manifest --source ./my-website
```

Output: `./my-website/wttp.manifest.json`

### With Cost Estimates (Site Required)

```bash
npx hardhat site:manifest \
  --source ./my-website \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --network sepolia
```

### Parameters

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `--source` | Source directory path | Yes | - |
| `--site` | WTTP site contract address | No | None |
| `--testconfig` | Path to test config JSON | No | `./wttp-test-config.json` |
| `--destination` | Destination path on the site | No | `/` |
| `--output` | Output path for manifest file | No | `source/wttp.manifest.json` |
| `--gaslimit` | Max gas price in gwei | No | - |
| `--filelimit` | Max file size in MB | No | - |
| `--nodefaults` | Disable default ignore patterns | No | `false` |
| `--ignorepattern` | Custom ignore file or 'none' | No | `.wttpignore` |
| `--externalrules` | External storage rules JSON file | No | - |
| `--update` | Path to existing manifest to update | No | - |

## Manifest Structure

### Complete Example

```json
{
  "name": "my-website",
  "path": "./my-website/",
  "wttpConfig": {
    "gasLimit": 300,
    "fileLimit": 50,
    "ignorePattern": "./.wttpignore",
    "externalStorageRules": [...]
  },
  "siteData": {
    "directories": [
      {
        "path": "/",
        "index": "./index.html"
      },
      {
        "path": "/about/",
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
      },
      {
        "path": "./script.js",
        "type": "application/javascript",
        "encoding": "gzip",
        "size": 90000,
        "status": "2/3",
        "gasCost": 0.01,
        "royaltyCost": 0.00001,
        "chunks": [
          {
            "address": "0x7a3d2e1c9b4f5a6e8d2c1b9a7f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e",
            "estimate": 200000,
            "range": "0-32767",
            "royalty": 0.000001,
            "txHash": "0xbadc0ffee..."
          },
          {
            "address": "0x4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e",
            "prerequisite": "0x7a3d2e1c9b4f5a6e8d2c1b9a7f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e",
            "estimate": 150000,
            "range": "32768-65535",
            "gas": 0.004,
            "txHash": "0xcaba1a..."
          },
          {
            "address": "0x2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d",
            "prerequisite": "0x4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e",
            "estimate": 150000,
            "range": "65536-90000"
          }
        ]
      },
      {
        "path": "./large-video.mp4",
        "type": "video/mp4",
        "externalStorage": "arweave",
        "size": 300000000,
        "status": "pending",
        "redirect": {
          "code": 301,
          "location": "ar://[txid]"
        },
        "chunks": []
      }
    ]
  },
  "chainData": {
    "contractAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E",
    "chainId": 11155111,
    "name": "sepolia",
    "symbol": "ETH",
    "transactions": [
      {
        "txHash": "0xabcd...",
        "method": "DEFINE",
        "gasUsed": 50000,
        "data": {...}
      },
      {
        "txHash": "0xbadc0ffee...",
        "method": "PUT",
        "chunkAddress": "0x7a3d2e1c9b4f5a6e8d2c1b9a7f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e",
        "value": 0.001,
        "gasUsed": 200000,
        "data": {...}
      }
    ]
  }
}
```

### Without Site (Planning Mode)

When no site is provided, `chainData` is omitted and estimates are not included:

```json
{
  "name": "my-website",
  "path": "./my-website/",
  "siteData": {
    "directories": [...],
    "files": [
      {
        "path": "./index.html",
        "type": "text/html",
        "size": 30000,
        "status": "pending",
        "chunks": [
          {
            "address": "0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2"
          }
        ]
      }
    ]
  }
}
```

## Field Reference

### Root Level

- `name` (string): Site/directory name
- `path` (string): Relative path to source directory
- `wttpConfig` (object, optional): Configuration used for generation
- `siteData` (object): File and directory structure
- `chainData` (object, optional): Chain and contract information (only when site provided)

### wttpConfig Fields

- `gasLimit` (number, optional): Maximum gas price in gwei
- `fileLimit` (number, optional): Maximum file size in MB
- `ignorePattern` (string|array|"none", optional): Ignore pattern configuration
- `externalStorageRules` (array, optional): Rules for external storage
- `testConfig` (object, optional): Test configuration for estimates

### Directory Object

- `path` (string): Directory path (e.g., `/`, `/about/`)
- `index` (string): Index file location (e.g., `./index.html`)

### File Object

- `path` (string): File path relative to source
- `type` (string): MIME type
- `charset` (string, optional): Character set (only if not `utf-8`)
- `encoding` (string, optional): Content encoding (only if not `identity`)
- `language` (string, optional): Language code (only if not `en-US`)
- `size` (number): File size in bytes
- `status` (string): Upload status
- `gasCost` (number, optional): Total gas cost (only with estimates)
- `royaltyCost` (number, optional): Total royalty cost (only with estimates)
- `externalStorage` (string, optional): External storage provider
- `redirect` (object, optional): Redirect configuration for external files
- `chunks` (array): Array of chunk objects

### Chunk Object

- `address` (string): **32-byte** data point address (bytes32)
- `estimate` (number, optional): Gas estimate for transaction
- `range` (string, optional): Byte range for multi-chunk files (e.g., `0-32767`)
- `royalty` (number, optional): Royalty cost in native currency
- `gas` (number, optional): Gas cost in native currency
- `txHash` (string, optional): Transaction hash when uploaded
- `prerequisite` (string, optional): Previous chunk address for sequential uploads

### Chain Data Object

- `contractAddress` (string): WTTP site contract address
- `chainId` (number): Chain ID
- `name` (string): Network name
- `symbol` (string): Native currency symbol
- `transactions` (array): Array of transaction objects

### Transaction Object

- `txHash` (string, optional): Transaction hash
- `method` (string): Contract method (`DEFINE`, `PUT`, `PATCH`)
- `chunkAddress` (string, optional): Associated chunk address
- `value` (number, optional): Value sent with transaction
- `gasUsed` (number, optional): Gas used
- `data` (any, optional): Additional transaction data

## File Status Values

- `pending` - Not yet uploaded
- `x/y` - Partially uploaded (x of y chunks complete, e.g., `2/3`)
- `complete` - Fully uploaded

## External Storage Rules

Configure which files should use external storage providers:

### Rule Format

```json
{
  "minSizeBytes": 10485760,
  "maxSizeBytes": 524288000,
  "mimeTypes": ["image/*", "video/*", "audio/*"],
  "extensions": [".png", ".jpg", ".mp4", ".mp3"],
  "provider": "arweave",
  "redirectCode": 301
}
```

### Rule Fields

- `provider` (required): `arweave`, `ipfs`, or `filecoin`
- `minSizeBytes` (optional): Minimum file size to match
- `maxSizeBytes` (optional): Maximum file size to match
- `mimeTypes` (optional): Array of MIME types (supports wildcards)
- `extensions` (optional): Array of file extensions
- `redirectCode` (optional): HTTP redirect code (default: 301)

### Example Rules File

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  },
  {
    "minSizeBytes": 52428800,
    "provider": "arweave",
    "mimeTypes": ["*"]
  },
  {
    "extensions": [".pdf"],
    "minSizeBytes": 5242880,
    "provider": "ipfs",
    "redirectCode": 302
  }
]
```

Usage:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --externalrules ./external-storage-rules.json
```

## Test Config

Create `wttp-test-config.json` for automatic site resolution:

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

The manifest task will automatically load this file and use the configuration for the current network.

## Chunk Prerequisites

For multi-chunk files, chunks after the first include a `prerequisite` field:

```json
{
  "chunks": [
    {
      "address": "0x7a3d...",
      "estimate": 200000
    },
    {
      "address": "0x4f3e...",
      "prerequisite": "0x7a3d...",
      "estimate": 150000
    },
    {
      "address": "0x2e1d...",
      "prerequisite": "0x4f3e...",
      "estimate": 150000
    }
  ]
}
```

This ensures chunks are uploaded in order. External uploaders should:
1. Upload chunks without prerequisites in parallel
2. Wait for prerequisite chunks to complete before uploading dependent chunks

## Updating a Manifest

After partial uploads or to refresh estimates:

```bash
npx hardhat site:manifest \
  --source ./my-website \
  --update ./my-website/wttp.manifest.json \
  --network sepolia
```

This preserves transaction history and updates remaining chunks.

## Integration Examples

### Loading a Manifest

```typescript
import fs from 'fs';

const manifest = JSON.parse(
  fs.readFileSync('./site/wttp.manifest.json', 'utf-8')
);

console.log(`Site: ${manifest.name}`);
console.log(`Files: ${manifest.siteData.files.length}`);
console.log(`Contract: ${manifest.chainData?.contractAddress}`);
```

### Finding Pending Chunks

```typescript
const pendingChunks = manifest.siteData.files
  .flatMap(file => file.chunks
    .filter(chunk => !chunk.txHash && !chunk.prerequisite)
    .map(chunk => ({ file, chunk }))
  );

console.log(`${pendingChunks.length} chunks ready to upload`);
```

### Updating Status

```typescript
function updateChunkStatus(
  manifestPath: string,
  chunkAddress: string,
  txHash: string,
  gasUsed: number
) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  for (const file of manifest.siteData.files) {
    const chunk = file.chunks.find(c => c.address === chunkAddress);
    if (chunk) {
      chunk.txHash = txHash;
      chunk.gasUsed = gasUsed;
      
      // Update file status
      const completed = file.chunks.filter(c => c.txHash).length;
      file.status = completed === file.chunks.length 
        ? 'complete' 
        : `${completed}/${file.chunks.length}`;
      
      // Add transaction
      if (manifest.chainData) {
        manifest.chainData.transactions.push({
          txHash,
          method: 'PUT',
          chunkAddress,
          gasUsed
        });
      }
      
      break;
    }
  }
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
```

## Important Notes

### Chunk Address Format

Chunk addresses are **32-byte data point addresses** (bytes32), not 20-byte Ethereum addresses:

✅ Correct: `0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2` (64 hex chars)  
❌ Wrong: `0xfC81667b1AbB282B15A149B6fde07557714E6148` (40 hex chars)

### Ignored Files

The file `wttp.manifest.json` is automatically added to the default ignore patterns and will not be uploaded to the blockchain.

### Two Modes

1. **Planning Mode** (no site): Generates structure and chunk addresses only
2. **Estimation Mode** (with site): Includes gas estimates and royalty costs

Both modes generate the same file structure and chunk addresses. The difference is whether cost information is included.

## See Also

- [Usage Examples](./MANIFEST_EXAMPLE.md)
- [Quick Reference](./MANIFEST_QUICKSTART.md)
- [Fix Summary](./MANIFEST_FIXES.md)
