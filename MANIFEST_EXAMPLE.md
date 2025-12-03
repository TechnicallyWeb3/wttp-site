# WTTP Manifest Example Usage

This guide demonstrates how to generate and use WTTP manifest files.

## Prerequisites

**For Planning (No Site Needed):**
- Node.js and npm installed
- Hardhat project set up
- Directory to upload

**For Estimation (With Site):**
- Deployed WTTP Site contract
- Network access (sepolia, polygon, or localhost with running node)

## Quick Start

### 1. Generate Manifest (No Site Needed)

```bash
# Generate manifest with structure and chunk addresses only
npx hardhat site:manifest --source ./test-upload-demo
```

This creates `./test-upload-demo/wttp.manifest.json` with:
- File structure
- Directory index files
- Pre-calculated chunk addresses
- File sizes and types
- Ignored files excluded
- No cost estimates

### 2. Deploy a Site (For Estimates)

```bash
# Deploy to sepolia testnet
npx hardhat site:deploy --network sepolia

# Output: Site deployed at: 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E
```

### 3. Generate Manifest with Estimates

```bash
# Generate with cost estimates
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --network sepolia
```

This creates `./test-upload-demo/wttp.manifest.json` with:
- Everything from step 1 PLUS:
- Pre-calculated chunk addresses
- Royalty costs for each chunk
- Gas estimates
- Total cost breakdown

### 4. Review the Manifest

```bash
cat ./test-upload-demo/wttp.manifest.json
```

Example output structure:

```json
{
  "name": "test-upload-demo",
  "path": "./test-upload-demo/",
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
        "size": 1234,
        "status": "pending",
        "chunks": [
          {
            "address": "0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2",
            "estimate": 200000,
            "royalty": 0.001,
            "gas": 0.005
          }
        ]
      },
      {
        "path": "./script.js",
        "type": "application/javascript",
        "size": 98304,
        "status": "pending",
        "chunks": [
          {
            "address": "0x7a3d2e1c9b4f5a6e8d2c1b9a7f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e",
            "estimate": 200000,
            "range": "0-32767",
            "royalty": 0.0001
          },
          {
            "address": "0x4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e",
            "prerequisite": "0x7a3d2e1c9b4f5a6e8d2c1b9a7f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e",
            "estimate": 150000,
            "range": "32768-65535",
            "gas": 0.0038
          },
          {
            "address": "0x2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d",
            "prerequisite": "0x4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e",
            "estimate": 150000,
            "range": "65536-98303",
            "gas": 0.0038
          }
        ]
      }
    ]
  },
  "chainData": {
    "contractAddress": "0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E",
    "chainId": 11155111,
    "name": "sepolia",
    "symbol": "ETH",
    "transactions": []
  }
}
```

### 5. Upload Using the Manifest

Once you have the manifest, you can:

**A. Use the standard uploader:**
```bash
npx hardhat site:upload \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --source ./test-upload-demo \
  --network sepolia
```

**B. Build a custom uploader** that reads the manifest and:
- Uploads chunks in parallel
- Tracks progress
- Resumes failed uploads
- Optimizes transaction ordering

## Advanced Usage

### With Configuration Options

```bash
npx hardhat site:manifest \
  --source ./my-website \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --gaslimit 300 \
  --filelimit 50 \
  --destination /blog/ \
  --network sepolia
```

This saves configuration in the manifest:

```json
{
  "wttpConfig": {
    "gasLimit": 300,
    "fileLimit": 50
  }
}
```

### With External Storage Rules

Create `external-storage-rules.json`:

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"],
    "extensions": [".png", ".jpg", ".mp4"]
  },
  {
    "minSizeBytes": 52428800,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

Generate manifest with external storage:

```bash
npx hardhat site:manifest \
  --source ./media-heavy-site \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --externalrules ./external-storage-rules.json \
  --network sepolia
```

Files matching rules will show:

```json
{
  "path": "./large-video.mp4",
  "type": "video/mp4",
  "size": 50000000,
  "externalStorage": "arweave",
  "status": "pending",
  "redirect": {
    "code": 301,
    "location": "arweave://[pending]"
  },
  "chunks": []
}
```

### With Custom Ignore Patterns

Use a custom ignore file:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --ignorepattern ./custom.ignore \
  --network sepolia
```

Or disable default patterns:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --site 0x8de4FAA55d6521Ff79a45bCB05359c177c7CD46E \
  --nodefaults \
  --network sepolia
```

### Using Test Config

Create `wttp-test-config.json`:

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

Then generate without specifying site:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --network sepolia
```

The site address will be loaded automatically from the test config.

### Updating an Existing Manifest

After partial uploads, update the manifest:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --update ./my-site/wttp.manifest.json \
  --network sepolia
```

This preserves transaction history and updates remaining estimates.

## Custom Uploader Integration

### Reading the Manifest

```typescript
import fs from 'fs';

// Load manifest
const manifest = JSON.parse(
  fs.readFileSync('./site/wttp.manifest.json', 'utf-8')
);

// Get all pending files
const pendingFiles = manifest.siteData.files
  .filter(file => file.status === 'pending');

console.log(`${pendingFiles.length} files to upload`);

// Get chunks ready to upload (no prerequisites or prerequisites met)
const readyChunks = [];
for (const file of manifest.siteData.files) {
  for (const chunk of file.chunks) {
    if (!chunk.txHash && !chunk.prerequisite) {
      readyChunks.push({ file, chunk });
    }
  }
}

console.log(`${readyChunks.length} chunks ready to upload now`);

// Upload in parallel
await Promise.all(
  readyChunks.map(({file, chunk}) => 
    uploadChunk(file.path, chunk)
  )
);
```

### Updating Status

```typescript
// After successful upload
function updateManifestAfterUpload(
  manifestPath: string,
  filePath: string,
  chunkAddress: string,
  txHash: string,
  gasUsed: number
) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  
  // Find the file
  const file = manifest.siteData.files
    .find(f => f.path === filePath);
  
  if (file) {
    // Find and update the chunk
    const chunk = file.chunks
      .find(c => c.address === chunkAddress);
    
    if (chunk) {
      chunk.txHash = txHash;
      chunk.gasUsed = gasUsed;
    }
    
    // Update file status
    const completedChunks = file.chunks
      .filter(c => c.txHash).length;
    
    if (completedChunks === file.chunks.length) {
      file.status = 'complete';
    } else {
      file.status = `${completedChunks}/${file.chunks.length}`;
    }
    
    // Add transaction to chainData
    if (manifest.chainData) {
      manifest.chainData.transactions.push({
        txHash,
        method: 'PUT',
        chunkAddress,
        gasUsed
      });
    }
  }
  
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  );
}

// Usage
updateManifestAfterUpload(
  './site/wttp.manifest.json',
  './index.html',
  '0xe28d51320e2649fe527fa037f2867232b7cc3e5d2cb1fed6d1640d8c675c82f2',
  '0xabc123...',
  200000
);
```

### Calculating Costs

```typescript
function calculateTotalCost(manifest: any): {
  totalGas: number,
  totalRoyalty: number,
  totalCost: number,
  pendingCost: number
} {
  let totalGas = 0;
  let totalRoyalty = 0;
  let pendingGas = 0;
  let pendingRoyalty = 0;
  
  for (const file of manifest.siteData.files) {
    for (const chunk of file.chunks) {
      const gas = chunk.gas || 0;
      const royalty = chunk.royalty || 0;
      
      totalGas += gas;
      totalRoyalty += royalty;
      
      if (!chunk.txHash) {
        pendingGas += gas;
        pendingRoyalty += royalty;
      }
    }
  }
  
  return {
    totalGas,
    totalRoyalty,
    totalCost: totalGas + totalRoyalty,
    pendingCost: pendingGas + pendingRoyalty
  };
}

const costs = calculateTotalCost(manifest);
console.log(`Total cost: ${costs.totalCost} ETH`);
console.log(`Remaining: ${costs.pendingCost} ETH`);
```

### Finding Next Chunks to Upload

```typescript
function getNextChunks(manifest: any, limit: number = 10) {
  const ready = [];
  
  for (const file of manifest.siteData.files) {
    for (const chunk of file.chunks) {
      // Skip if already uploaded
      if (chunk.txHash) continue;
      
      // Skip if has prerequisite that's not uploaded
      if (chunk.prerequisite) {
        const prereq = file.chunks.find(c => 
          c.address === chunk.prerequisite
        );
        if (!prereq?.txHash) continue;
      }
      
      ready.push({ file, chunk });
      if (ready.length >= limit) break;
    }
    if (ready.length >= limit) break;
  }
  
  return ready;
}

// Get next 5 chunks to upload
const next = getNextChunks(manifest, 5);
console.log(`Next ${next.length} chunks ready`);
```

## Testing Locally

For local testing, you need a running Hardhat node:

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy a site
npx hardhat site:deploy --network localhost
# Output: Site deployed at: 0x5FbDB2315678afecb367f032d93F642f64180aa3

# Terminal 3: Generate manifest
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --site 0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  --network localhost
```

## Best Practices

1. **Generate manifests before large uploads** to review costs
2. **Commit manifests to version control** to track deployment history
3. **Use external storage rules** for media-heavy sites
4. **Update manifests after partial uploads** to track progress
5. **Verify chunk addresses** are 32 bytes (64 hex chars)
6. **Use test config** for CI/CD automation
7. **Start without site** to see structure, then add site for estimates

## Troubleshooting

### "Source directory does not exist"

**Problem**: Path is incorrect

**Solution**: 
```bash
# Use correct relative or absolute path
npx hardhat site:manifest --source ./my-actual-directory
```

### "Cannot connect to network localhost"

**Problem**: No local Hardhat node running

**Solution**:
```bash
# Start node first
npx hardhat node
```

### Chunk addresses are 40 characters instead of 64

**Problem**: Old version of manifest generator

**Solution**: Regenerate with latest version:
```bash
npx hardhat site:manifest --source ./my-site
```

### No cost estimates in manifest

**Cause**: No site address provided (this is normal for planning mode)

**Solution**: Add `--site` parameter for estimates:
```bash
npx hardhat site:manifest --source ./my-site --site 0x... --network sepolia
```

## Real-World Example

Complete workflow for deploying a website:

```bash
# 1. Generate planning manifest (no site needed)
npx hardhat site:manifest --source ./my-website

# Review output: 
# - 50 files
# - 237 chunks total
# - Check which files will be uploaded

# 2. Deploy site (if needed)
npx hardhat site:deploy --network sepolia
# Output: 0x8de4...

# 3. Add test config for convenience
cat > wttp-test-config.json << 'EOF'
{
  "networks": {
    "sepolia": {
      "network": "sepolia",
      "siteAddress": "0x8de4..."
    }
  }
}
EOF

# 4. Regenerate with estimates
npx hardhat site:manifest \
  --source ./my-website \
  --network sepolia

# Review costs in manifest
cat ./my-website/wttp.manifest.json | grep -A 5 "Estimated Costs"

# 5. Upload
npx hardhat site:upload \
  --source ./my-website \
  --site 0x8de4... \
  --network sepolia

# 6. Update manifest after upload
npx hardhat site:manifest \
  --source ./my-website \
  --update ./my-website/wttp.manifest.json \
  --network sepolia
```

## Next Steps

- Review the [API documentation](./MANIFEST.md) for complete field reference
- Check [Quick Reference](./MANIFEST_QUICKSTART.md) for common commands
- See [Fixes documentation](./MANIFEST_FIXES.md) for technical details
- Build your custom uploader using the manifest
