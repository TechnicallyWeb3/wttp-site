# Manifest-Based Upload Guide

## Overview

The WTTP manifest system provides a complete workflow for uploading sites to the blockchain with Arweave integration. The manifest acts as a single source of truth, tracking all files, directories, chunks, redirects, and transactions.

## Key Features

- **Complete Configuration**: Manifest stores all upload settings (gas limits, file limits, ignore patterns, destination path)
- **Transaction Tracking**: Every chunk, file, directory, and redirect transaction is recorded
- **Status Management**: Files and directories track their status (pending, complete, error)
- **Royalty Caching**: Pre-calculated royalties speed up uploads
- **Arweave Integration**: Seamless redirect creation for Arweave-hosted files
- **Resumable Uploads**: Skip completed files/chunks automatically
- **Trust-Based**: Upload script trusts manifest completely - no excessive verification

## Workflow

### 1. Generate Manifest

Generate a manifest with all configuration and cost estimates:

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --site 0xYourSiteAddress \
  --destination / \
  --gaslimit 300 \
  --filelimit 400 \
  --externalrules ./arweave-rules.json \
  --network polygon
```

**What it does:**
- Scans your site directory
- Calculates chunk addresses for all files
- Estimates gas costs and royalties
- Identifies files for external storage (Arweave)
- Saves complete configuration in manifest

**Output:** `./my-site/wttp.manifest.json`

### 2. Upload to Arweave (Optional)

If you have files marked for Arweave storage:

```bash
npx hardhat arweave:upload \
  --manifestPath ./my-site/wttp.manifest.json \
  --wallet ./arweave-wallet.json \
  --network polygon
```

**What it does:**
- Reads files marked with `externalStorage: "arweave"`
- Uploads them to Arweave using official Arweave library
- Updates manifest with actual Arweave TXIDs (`ar://...`)
- Sets file status to `"uploaded"`
- Saves updated manifest

### 3. Upload to Blockchain

Upload everything (files, directories, redirects) to your WTTP site:

```bash
npx hardhat site:upload \
  --site 0xYourSiteAddress \
  --manifest ./my-site/wttp.manifest.json \
  --network polygon
```

**What it does:**
- Reads manifest configuration (gas limit, file limit, destination)
- Processes directories (creates with DEFINE)
- Uploads file chunks (PUT for first chunk, PATCH for rest)
- Creates redirects for Arweave files (DEFINE with `ar://` URLs)
- Updates manifest with transaction hashes
- Tracks all transactions in `chainData.transactions`
- Skips files/chunks marked as `"complete"`
- Retries with fresh royalties if transaction fails

## Manifest Structure

### Full Example

```json
{
  "name": "my-site",
  "path": "./my-site/",
  "wttpConfig": {
    "gasLimit": 300,
    "fileLimit": 400,
    "destination": "/",
    "ignorePattern": ["node_modules/**", ".git/**"],
    "externalStorageRules": [
      {
        "minSizeBytes": 1048576,
        "provider": "arweave",
        "mimeTypes": ["image/*", "video/*"]
      }
    ]
  },
  "siteData": {
    "directories": [
      {
        "path": "/",
        "index": "./index.html",
        "status": "complete",
        "txHash": "0xabc123..."
      }
    ],
    "files": [
      {
        "path": "./index.html",
        "type": "text/html",
        "charset": "utf-8",
        "size": 2048,
        "status": "complete",
        "chunks": [
          {
            "address": "0xdef456...",
            "estimate": 150000,
            "royalty": 0.001,
            "gas": 0.0025,
            "txHash": "0x789xyz..."
          }
        ]
      },
      {
        "path": "./large-image.png",
        "type": "image/png",
        "size": 5242880,
        "status": "uploaded",
        "externalStorage": "arweave",
        "redirect": {
          "code": 301,
          "location": "ar://abc123def456..."
        },
        "chunks": []
      }
    ]
  },
  "chainData": {
    "contractAddress": "0xYourSiteAddress",
    "chainId": 137,
    "name": "polygon",
    "symbol": "POL",
    "transactions": [
      {
        "txHash": "0xabc123...",
        "method": "DEFINE",
        "path": "/",
        "redirect": {
          "code": 301,
          "location": "./index.html"
        },
        "gasUsed": 125000
      },
      {
        "txHash": "0xdef456...",
        "method": "PUT",
        "path": "./index.html",
        "chunkAddress": "0xchunk123...",
        "value": 0.001,
        "gasUsed": 180000
      },
      {
        "txHash": "0x789xyz...",
        "method": "DEFINE",
        "path": "./large-image.png",
        "redirect": {
          "code": 301,
          "location": "ar://abc123def456..."
        },
        "gasUsed": 125000
      }
    ]
  }
}
```

### Configuration Fields

#### `wttpConfig`

| Field | Type | Description |
|-------|------|-------------|
| `gasLimit` | number | Maximum gas price in gwei to wait for |
| `fileLimit` | number | Maximum file size in MB |
| `destination` | string | Destination path on WTTP site |
| `ignorePattern` | string[] \| string | Ignore patterns or file path |
| `externalStorageRules` | array | Rules for external storage routing |

#### `siteData.files`

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Relative file path |
| `type` | string | MIME type |
| `size` | number | File size in bytes |
| `status` | string | `"pending"`, `"complete"`, `"uploaded"`, `"error"` |
| `externalStorage` | string | `"arweave"`, `"ipfs"`, etc. |
| `redirect` | object | Redirect configuration |
| `chunks` | array | Chunk data with addresses and TXIDs |

#### `siteData.directories`

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Directory path |
| `index` | string | Index file location |
| `status` | string | `"pending"`, `"complete"`, `"error"` |
| `txHash` | string | DEFINE transaction hash |

#### `chainData.transactions`

| Field | Type | Description |
|-------|------|-------------|
| `txHash` | string | Transaction hash |
| `method` | string | `"PUT"`, `"PATCH"`, `"DEFINE"` |
| `path` | string | File or directory path |
| `chunkAddress` | string | Data point address (for chunks) |
| `range` | string | Byte range (for chunks) |
| `redirect` | object | Redirect details (for DEFINE) |
| `value` | number | Royalty paid (in ETH/POL) |
| `gasUsed` | number | Gas used |

## Status Values

### File Status

- **`pending`**: File not yet uploaded
- **`complete`**: All chunks uploaded to blockchain
- **`uploaded`**: File uploaded to external storage (Arweave)
- **`error`**: Upload failed

### Directory Status

- **`pending`**: Directory not yet created
- **`complete`**: DEFINE transaction successful
- **`error`**: DEFINE transaction failed

## Upload Behavior

### Trust-Based Approach

The upload script **trusts the manifest completely**:

- ✅ Skips files with `status: "complete"`
- ✅ Skips chunks with `txHash` set
- ✅ Uses royalties from manifest (if available)
- ✅ Uses gas/file limits from manifest config
- ✅ Respects destination path from manifest
- ❌ No verification against live blockchain data
- ❌ No re-checking of existing files

### Royalty Handling

1. **Use Manifest Royalties**: If royalty is in manifest, use it
2. **Fetch if Missing**: If not in manifest, fetch from DPR contract
3. **Retry on Error**: If transaction fails with royalty error, fetch fresh royalty and retry

### Transaction Recording

Every successful transaction is recorded in `chainData.transactions`:

```json
{
  "txHash": "0x...",
  "method": "PUT|PATCH|DEFINE",
  "path": "./file.html",
  "chunkAddress": "0x...",
  "range": "0-32767",
  "redirect": {
    "code": 301,
    "location": "ar://..."
  },
  "value": 0.001,
  "gasUsed": 150000
}
```

## Arweave Integration

### External Storage Rules

Define rules in a JSON file:

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["image/*", "video/*"]
  }
]
```

### Upload Process

1. **Manifest Generation**: Files matching rules get `externalStorage: "arweave"` and `redirect.location: "ar://[pending]"`
2. **Arweave Upload**: `arweave:upload` task uploads files and updates location to `ar://TXID`
3. **Blockchain Upload**: `site:upload` creates DEFINE redirects with `ar://TXID` URLs

### Redirect Format

Redirects use `ar://` prefix (not `https://`):

```json
{
  "redirect": {
    "code": 301,
    "location": "ar://abc123def456..."
  }
}
```

**Why `ar://`?**
- Protocol-agnostic
- Client can choose Arweave gateway
- Future-proof for different Arweave access methods

## Advanced Usage

### Resume Interrupted Upload

Just run the upload command again:

```bash
npx hardhat site:upload \
  --site 0xYourSiteAddress \
  --manifest ./my-site/wttp.manifest.json \
  --network polygon
```

The script will:
- Skip files with `status: "complete"`
- Skip chunks with `txHash` set
- Continue from where it left off

### Update Existing Site

1. Modify your site files
2. Regenerate manifest (with same destination)
3. Upload with manifest

The script will:
- Upload only new/changed files
- Skip unchanged files (based on chunk addresses)

### Custom Destination

```bash
npx hardhat site:manifest \
  --source ./my-site \
  --destination /v2/ \
  --site 0xYourSiteAddress
```

All files will be uploaded to `/v2/` path.

### Multiple Arweave Rules

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["*"]
  },
  {
    "provider": "arweave",
    "mimeTypes": ["video/*"]
  }
]
```

- Rule 1: Any file > 10MB → Arweave
- Rule 2: All videos → Arweave

## Troubleshooting

### "Insufficient balance" Error

**Cause**: Not enough ETH/POL for royalties

**Solution**: 
1. Check manifest for total royalty estimate
2. Fund your wallet
3. Re-run upload (it will skip completed chunks)

### "Royalty error" During Upload

**Cause**: Royalty changed between manifest generation and upload

**Solution**: Script automatically fetches fresh royalty and retries

### Files Not Uploading

**Check**:
1. File status in manifest (`"pending"` = will upload)
2. Chunk `txHash` values (if set, chunk is skipped)
3. Gas limit setting (may be waiting for gas price to drop)

### Arweave Files Not Creating Redirects

**Check**:
1. File has `redirect.location` with actual TXID (not `[pending]`)
2. File status is `"uploaded"` (not `"pending"`)
3. Run `arweave:upload` task first to upload files

## Best Practices

1. **Generate Manifest First**: Always generate manifest before uploading
2. **Use External Storage**: Configure Arweave rules for large files
3. **Set Gas Limits**: Use `--gaslimit` to avoid high gas prices
4. **Save Manifests**: Keep manifests for record-keeping and resumability
5. **Test on Testnet**: Test full workflow on testnet first
6. **Monitor Transactions**: Check `chainData.transactions` for all TXIDs
7. **Backup Manifests**: Manifests are your upload history

## Example Workflows

### Simple Site Upload

```bash
# 1. Generate manifest
npx hardhat site:manifest \
  --source ./my-site \
  --site 0xYourSite \
  --network polygon

# 2. Upload to blockchain
npx hardhat site:upload \
  --site 0xYourSite \
  --manifest ./my-site/wttp.manifest.json \
  --network polygon
```

### Site with Arweave Media

```bash
# 1. Create Arweave rules
echo '[{"minSizeBytes": 1048576, "provider": "arweave", "mimeTypes": ["image/*", "video/*"]}]' > arweave-rules.json

# 2. Generate manifest
npx hardhat site:manifest \
  --source ./my-site \
  --site 0xYourSite \
  --externalrules ./arweave-rules.json \
  --network polygon

# 3. Upload media to Arweave
npx hardhat arweave:upload \
  --manifestPath ./my-site/wttp.manifest.json \
  --wallet ./arweave-wallet.json

# 4. Upload everything to blockchain
npx hardhat site:upload \
  --site 0xYourSite \
  --manifest ./my-site/wttp.manifest.json \
  --network polygon
```

### Update Existing Site

```bash
# 1. Regenerate manifest (same destination)
npx hardhat site:manifest \
  --source ./my-site \
  --site 0xYourSite \
  --destination / \
  --network polygon

# 2. Upload changes
npx hardhat site:upload \
  --site 0xYourSite \
  --manifest ./my-site/wttp.manifest.json \
  --network polygon
```

## See Also

- [Arweave Storage Guide](./ARWEAVE_STORAGE_GUIDE.md)
- [Manifest Documentation](./MANIFEST.md)
- [Upload Scripts Documentation](./docs/api-reference/upload-scripts.md)




