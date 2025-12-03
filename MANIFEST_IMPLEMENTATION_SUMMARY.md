# WTTP Manifest Implementation Summary

## What Was Implemented

A complete manifest generation system that creates detailed, pre-calculated deployment plans for WTTP sites. This enables external uploaders and custom tools to efficiently manage uploads with full control over transaction ordering and parallel processing.

## Files Created/Modified

### New Files

1. **`src/scripts/generateManifest.ts`** (481 lines)
   - Core manifest generation logic
   - Chunk address calculation
   - Royalty and gas estimation
   - External storage rule evaluation
   - Manifest save/load functions

2. **`src/tasks/manifest.ts`** (115 lines)
   - Hardhat task for `site:manifest` command
   - Command-line interface
   - Configuration management
   - Integration with existing site contracts

3. **`MANIFEST.md`** (comprehensive documentation)
   - Complete API documentation
   - Manifest structure reference
   - Status tracking guide
   - Integration examples

4. **`MANIFEST_EXAMPLE.md`** (usage guide)
   - Step-by-step examples
   - Local testing instructions
   - Custom uploader integration
   - Troubleshooting guide

5. **`external-storage-rules.example.json`**
   - Example external storage configuration
   - Rule syntax demonstration
   - Multiple provider examples

### Modified Files

1. **`src/tasks/index.ts`**
   - Added manifest task export

2. **`src/scripts/wttpIgnore.ts`**
   - Added `wttp.manifest.json` to default ignore patterns
   - Prevents manifests from being uploaded to blockchain

## Manifest Structure

The generated manifest follows your specified structure:

```json
{
  "name": "site-name",
  "path": "./site-name/",
  "wttpConfig": {
    "gasLimit": 300,
    "fileLimit": 50,
    "ignorePattern": "./.wttpignore"
  },
  "siteData": {
    "directories": [
      { "path": "/", "index": "./index.html" }
    ],
    "files": [
      {
        "path": "./file.js",
        "type": "application/javascript",
        "size": 90000,
        "status": "pending",
        "chunks": [
          {
            "address": "0xABCD...",
            "estimate": 200000,
            "range": "0-32767",
            "royalty": 0.000001
          },
          {
            "address": "0x1234...",
            "prerequisite": "0xABCD...",
            "estimate": 150000,
            "range": "32768-65535",
            "gas": 0.004
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

## Key Features Implemented

### 1. Pre-Calculation
- ✅ Chunk addresses calculated before upload
- ✅ Royalty costs determined upfront
- ✅ Gas estimates for each transaction
- ✅ File size and metadata included

### 2. Status Tracking
- ✅ `pending` - Not yet uploaded
- ✅ `x/y` - Partially uploaded (x of y chunks)
- ✅ `complete` - Fully uploaded
- ✅ Transaction history in `chainData.transactions`

### 3. External Storage Rules
- ✅ Configurable size thresholds
- ✅ MIME type matching (with wildcards)
- ✅ File extension matching
- ✅ Multiple provider support (arweave, ipfs, filecoin)
- ✅ Custom redirect codes

### 4. Chunk Prerequisites
- ✅ Sequential chunk dependencies tracked
- ✅ Enables parallel upload of independent files
- ✅ Supports resume of failed uploads

### 5. Configuration Management
- ✅ Gas limit configuration
- ✅ File limit configuration
- ✅ Custom ignore patterns
- ✅ External storage rules

### 6. Smart Defaults
- ✅ Only non-default values included (charset, encoding, language)
- ✅ Royalty cost only shown when > 0
- ✅ Gas cost only shown when > 0
- ✅ Range only shown for multi-chunk files
- ✅ Prerequisites only for sequential chunks

## Usage

### Basic Command

```bash
npx hardhat site:manifest \
  --source ./my-website \
  --site 0x1234567890... \
  --network sepolia
```

### With All Options

```bash
npx hardhat site:manifest \
  --source ./my-website \
  --site 0x1234567890... \
  --destination /blog/ \
  --output ./custom-manifest.json \
  --gaslimit 300 \
  --filelimit 50 \
  --externalrules ./external-storage-rules.json \
  --ignorepattern ./custom.ignore \
  --update ./existing-manifest.json \
  --network sepolia
```

### Command Parameters

| Parameter | Description | Required |
|-----------|-------------|----------|
| `--source` | Source directory path | Yes |
| `--site` | WTTP site contract address | No* |
| `--destination` | Destination path on site | No (default: `/`) |
| `--output` | Output file path | No (default: `source/wttp.manifest.json`) |
| `--gaslimit` | Max gas price in gwei | No |
| `--filelimit` | Max file size in MB | No |
| `--nodefaults` | Disable default ignore patterns | No |
| `--ignorepattern` | Custom ignore file or `"none"` | No |
| `--externalrules` | External storage rules JSON | No |
| `--update` | Existing manifest to update | No |
| `--network` | Network to use | Yes |

*Site is optional - uses default estimation contract if not provided (requires network with deployed contracts)

## Testing

### Prerequisites
You need a deployed WTTP site to generate accurate manifests:

```bash
# Option 1: Use sepolia testnet (has default contracts)
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --network sepolia

# Option 2: Deploy your own site first
npx hardhat site:deploy --network sepolia
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --site 0x... \
  --network sepolia

# Option 3: Local testing
# Terminal 1:
npx hardhat node
# Terminal 2:
npx hardhat site:deploy --network localhost
# Terminal 3:
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --site 0x... \
  --network localhost
```

## Integration Points

### For External Uploaders

The manifest provides everything needed for custom uploaders:

1. **Chunk Addresses**: Pre-calculated, no need to recompute
2. **Royalty Costs**: Known before transaction
3. **Gas Estimates**: Conservative estimates for planning
4. **Prerequisites**: Sequential dependencies clear
5. **Status Tracking**: Easy progress monitoring

### Example Integration

```typescript
// Load manifest
const manifest = JSON.parse(fs.readFileSync('wttp.manifest.json', 'utf-8'));

// Find chunks ready to upload (no prerequisites)
const readyChunks = manifest.siteData.files
  .flatMap(file => file.chunks
    .filter(chunk => !chunk.txHash && !chunk.prerequisite)
    .map(chunk => ({ file, chunk }))
  );

// Upload in parallel
await Promise.all(
  readyChunks.map(({ file, chunk }) => uploadChunk(file, chunk))
);

// Update manifest with results
updateManifest(manifest, results);
```

## Benefits

1. **Cost Transparency**: Know exact costs before uploading
2. **Parallel Uploads**: Upload independent files simultaneously
3. **Resume Support**: Continue failed uploads from last checkpoint
4. **External Storage**: Automatically route large files to cheaper storage
5. **Custom Tools**: Enable third-party uploaders and UIs
6. **Deployment Tracking**: Manifest serves as deployment record
7. **CI/CD Integration**: Automated deployment pipelines possible

## Next Steps

1. **Test the manifest generation** with your sites
2. **Review generated manifests** to ensure accuracy
3. **Implement custom uploader** if needed (using manifest data)
4. **Create external storage rules** for your use case
5. **Integrate into CI/CD** for automated deployments

## Future Enhancements (Not Implemented)

These could be added later:

1. **Manifest validation**: Verify uploaded data matches manifest
2. **Upload task integration**: Make standard uploader read manifests
3. **API endpoints**: RESTful API for manifest updates
4. **Web UI**: Visual progress tracking and management
5. **Compression detection**: Optimize encoding selection
6. **Cost optimization**: Suggest cheaper alternatives
7. **Batch updates**: Update multiple files' status at once

## Documentation

- **[MANIFEST.md](./MANIFEST.md)**: Complete API reference
- **[MANIFEST_EXAMPLE.md](./MANIFEST_EXAMPLE.md)**: Usage examples and integration guide
- **[external-storage-rules.example.json](./external-storage-rules.example.json)**: Example rules configuration

## Support

For issues or questions:
1. Check [MANIFEST_EXAMPLE.md](./MANIFEST_EXAMPLE.md) troubleshooting section
2. Review the generated manifest structure
3. Verify site contract is deployed on target network
4. Check that DPS/DPR contracts are accessible

