# WTTP Site Scripts and Tasks Documentation

This document provides comprehensive documentation for all Hardhat tasks, Hardhat scripts, and standalone ethers.js scripts available in the WTTP Site package.

---

## Table of Contents

1. [Hardhat Tasks](#hardhat-tasks)
   - [Site Management Tasks](#site-management-tasks)
   - [Arweave Tasks](#arweave-tasks)
   - [WordPress Optimization Tasks](#wordpress-optimization-tasks)
2. [Hardhat Scripts](#hardhat-scripts)
3. [Standalone Ethers Scripts](#standalone-ethers-scripts)
4. [Usage Examples](#usage-examples)

---

## Hardhat Tasks

Hardhat tasks are CLI commands that can be executed using `npx hardhat <task-name>`. They integrate with Hardhat's runtime environment and provide convenient access to WTTP Site functionality.

### Site Management Tasks

#### `site:deploy`

Deploy a Web3Site contract to the blockchain.

**Usage:**
```bash
npx hardhat site:deploy [options] --network <network>
```

**Parameters:**
- `--dpr` (optional): DataPointRegistry contract address. Defaults to official ESP deployment for the current network.
- `--owner` (optional): Site owner address. Defaults to deployer address.
- `--cache-preset` (optional): Cache preset value. Accepts numeric (0-6) or named values:
  - `none` (0): No caching
  - `short` (2): Short-term cache
  - `medium` (3): Medium-term cache (default)
  - `long` (4): Long-term cache
  - `aggressive` (5): Aggressive caching
  - `permanent` (6): Permanent cache
- `--header-preset` (optional): Header preset configuration:
  - `basic`: Standard caching and CORS settings
  - `development`: Development-friendly settings (no cache, permissive CORS)
  - `production`: Production-optimized settings (long cache, strict CORS)
- `--cors-preset` (optional): CORS preset configuration:
  - `permissive`: Allow all origins
  - `strict`: Same-origin only
  - `basic`: Basic CORS settings
- `--skip-verify` (flag): Skip contract verification on block explorer
- `--auto-fund` (flag): Automatically fund deployer from owner if needed

**Examples:**
```bash
# Deploy with default settings
npx hardhat site:deploy --network localhost

# Deploy with custom cache preset
npx hardhat site:deploy --cache-preset aggressive --network sepolia

# Deploy with header preset
npx hardhat site:deploy --header-preset production --network polygon

# Deploy with auto-funding enabled
npx hardhat site:deploy --auto-fund --network sepolia
```

**Output:**
- Contract address
- Owner address
- DPR address
- Transaction hash
- Deployment cost estimate

---

#### `site:verify`

Verify a deployed Web3Site contract on a block explorer.

**Usage:**
```bash
npx hardhat site:verify --address <address> --dpr <dpr-address> --owner <owner-address> [options] --network <network>
```

**Parameters:**
- `--address` (required): Web3Site contract address to verify
- `--dpr` (required): DPR address used in constructor
- `--owner` (required): Owner address used in constructor
- `--cache-preset` (optional): Same as `site:deploy`
- `--header-preset` (optional): Same as `site:deploy`
- `--cors-preset` (optional): Same as `site:deploy`
- `--confirmations` (optional): Number of confirmations to wait before verifying (default: 5)
- `--skip-wait` (flag): Skip waiting for confirmations

**Examples:**
```bash
# Verify with default settings
npx hardhat site:verify --address 0x... --dpr 0x... --owner 0x... --network sepolia

# Verify without waiting for confirmations
npx hardhat site:verify --address 0x... --dpr 0x... --owner 0x... --skip-wait --network sepolia
```

---

#### `site:upload`

Upload files or directories to a WTTP site. Supports both direct uploads and manifest-based uploads.

**Usage:**
```bash
npx hardhat site:upload [options] --network <network>
```

**Parameters:**
- `--site` (optional): WTTP site contract address. Required unless using `--manifest` with a manifest containing `chainData.contractAddress`.
- `--source` (optional): Source file or directory path. Required unless using `--manifest`.
- `--manifest` (optional): Path to manifest file for manifest-based uploads.
- `--destination` (optional): Destination path on the WTTP site (default: `/`).
- `--nodefaults` (flag): Disable default ignore patterns (not recommended).
- `--gaslimit` (optional): Maximum gas price in gwei to wait for before sending transactions (default: 300).
- `--filelimit` (optional): Maximum file size in MB (default: 400).

**Upload Modes:**

1. **Direct Upload Mode:**
   ```bash
   npx hardhat site:upload --site 0x... --source ./public --network localhost
   ```

2. **Manifest-Based Upload:**
   ```bash
   npx hardhat site:upload --manifest ./wttp.manifest.json --network localhost
   ```

**Examples:**
```bash
# Upload a directory
npx hardhat site:upload --site 0x... --source ./public --destination / --network localhost

# Upload a single file
npx hardhat site:upload --site 0x... --source ./index.html --destination /index.html --network localhost

# Upload using manifest
npx hardhat site:upload --manifest ./wttp.manifest.json --network sepolia

# Upload with custom gas limit
npx hardhat site:upload --site 0x... --source ./public --gaslimit 200 --network polygon
```

**Features:**
- Automatic file chunking (32KB chunks)
- Smart upload optimization (skips unchanged chunks)
- Progress reporting
- Gas price monitoring
- File size validation

---

#### `site:fetch`

Fetch a resource from a WTTP site via the WTTPGateway.

**Usage:**
```bash
npx hardhat site:fetch [options] --network <network>
```

**Parameters:**
- `--url` (optional): Full URL of the WTTP site (alternative to `--site` and `--path`).
- `--site` (optional): WTTP site contract address (required if not using `--url`).
- `--path` (optional): Path to the resource (default: `/`).
- `--range` (optional): Byte range in format `start-end` (e.g., `10-20`).
- `--if-modified-since` (optional): Unix timestamp for If-Modified-Since header.
- `--if-none-match` (optional): ETag value for If-None-Match header.
- `--head` (flag): Perform a HEAD request instead of GET.
- `--datapoints` (flag): Fetch datapoint addresses instead of resource data.

**Examples:**
```bash
# Fetch root resource
npx hardhat site:fetch --site 0x... --network localhost

# Fetch specific path
npx hardhat site:fetch --site 0x... --path /index.html --network localhost

# Fetch with URL
npx hardhat site:fetch --url http://0x...localhost:8545/index.html --network localhost

# HEAD request
npx hardhat site:fetch --site 0x... --path /style.css --head --network localhost

# Fetch byte range
npx hardhat site:fetch --site 0x... --path /large-file.bin --range 0-1024 --network localhost
```

**Output:**
- Status code
- Content-Type
- Charset, Encoding, Language
- File size
- Version
- ETag
- Last Modified timestamp
- Content (for GET requests)

---

#### `site:manifest`

Generate a manifest file for a WTTP site directory. Manifests track file structure, chunk addresses, and cost estimates.

**Usage:**
```bash
npx hardhat site:manifest --source <directory> [options] --network <network>
```

**Parameters:**
- `--source` (required): Source directory path.
- `--site` (optional): WTTP site contract address (for cost estimates).
- `--testconfig` (optional): Path to test config JSON file with site/network info.
- `--destination` (optional): Destination path on the WTTP site (default: `/`).
- `--output` (optional): Output path for manifest file (default: `source/wttp.manifest.json`).
- `--gaslimit` (optional): Maximum gas price in gwei (stored in manifest config).
- `--filelimit` (optional): Maximum file size in MB (stored in manifest config).
- `--nodefaults` (flag): Disable default ignore patterns.
- `--ignorepattern` (optional): Custom ignore pattern file path or `none`.
- `--externalrules` (optional): JSON file path containing external storage rules.
- `--update` (optional): Path to existing manifest to update.

**Examples:**
```bash
# Generate manifest without cost estimates
npx hardhat site:manifest --source ./public --network localhost

# Generate manifest with cost estimates
npx hardhat site:manifest --source ./public --site 0x... --network sepolia

# Generate manifest with external storage rules
npx hardhat site:manifest --source ./public --externalrules ./arweave-rules.json --network localhost

# Update existing manifest
npx hardhat site:manifest --source ./public --update ./wttp.manifest.json --network localhost
```

**Manifest Structure:**
- `name`: Site name
- `path`: Site path
- `wttpConfig`: Upload configuration
- `siteData`: File and directory structure
- `chainData`: Blockchain information and cost estimates

---

#### `site:estimate`

Estimate gas costs for uploading a file or directory to a WTTP site.

**Usage:**
```bash
npx hardhat site:estimate --source <path> [options] --network <network>
```

**Parameters:**
- `--source` (required): Source file or directory path.
- `--site` (optional): WTTP site contract address (uses default test contract if not provided).
- `--destination` (optional): Destination path on the WTTP site (auto-generated if not provided).
- `--gasprice` (optional): Custom gas price in gwei.
- `--rate` (optional): Multiplier rate for current gas price (default: 2, accepts decimals like 1.5).
- `--min` (optional): Minimum gas price in gwei (default: 150).
- `--nodefaults` (flag): Disable default ignore patterns.

**Examples:**
```bash
# Estimate file upload
npx hardhat site:estimate --source ./index.html --network localhost

# Estimate directory upload
npx hardhat site:estimate --source ./public --network sepolia

# Estimate with custom gas price
npx hardhat site:estimate --source ./large-file.bin --gasprice 100 --network polygon

# Estimate with rate multiplier
npx hardhat site:estimate --source ./public --rate 1.5 --min 100 --network localhost
```

**Output:**
- Total cost (gas + royalties)
- Total gas
- Total royalty cost
- Transaction count
- Cost per MB

---

### Arweave Tasks

#### `arweave:upload`

Upload site resources to Arweave using the official Arweave library. Updates manifest with Arweave transaction IDs.

**Usage:**
```bash
npx hardhat arweave:upload [options]
```

**Parameters:**
- `--manifestPath` (optional): Path to an existing manifest file.
- `--source` (optional): Source directory path (required if generating manifest).
- `--wallet` (required): Path to Arweave wallet JSON file (JWK format).
- `--externalrules` (optional): JSON file path containing external storage rules (for manifest generation).
- `--gaslimit` (optional): Maximum gas price in gwei (for manifest generation).
- `--filelimit` (optional): Maximum file size in MB (for manifest generation).
- `--ignorepattern` (optional): Custom ignore pattern file path or `none`.
- `--output` (optional): Output path for manifest file (when generating).
- `--upload-manifest` (flag): Upload the manifest itself to Arweave after updating.

**Examples:**
```bash
# Upload using existing manifest
npx hardhat arweave:upload --manifestPath ./wttp.manifest.json --wallet ./wallet.json

# Generate manifest and upload
npx hardhat arweave:upload --source ./public --wallet ./wallet.json --externalrules ./arweave-rules.json

# Upload manifest itself
npx hardhat arweave:upload --manifestPath ./wttp.manifest.json --wallet ./wallet.json --upload-manifest
```

**Workflow:**
1. Load or generate manifest
2. Find files marked for Arweave storage
3. Upload files to Arweave
4. Update manifest with transaction IDs
5. Optionally upload manifest to Arweave

---

#### `arweave:generate`

Generate a new Arweave wallet and save to file.

**Usage:**
```bash
npx hardhat arweave:generate [options]
```

**Parameters:**
- `--output` (optional): Output filename for the wallet JSON file (default: `wallet.json`).
- `--force` (flag): Force overwrite existing wallet file (with balance check and warning).

**Examples:**
```bash
# Generate wallet
npx hardhat arweave:generate --output ./arweave-wallet.json

# Force overwrite (with safety checks)
npx hardhat arweave:generate --output ./wallet.json --force
```

**Security:**
- Automatically adds wallet file to `.gitignore`
- Warns if overwriting wallet with non-zero balance
- Provides 10-second countdown before overwriting

---

#### `arweave:address`

Get the Arweave address from a wallet file.

**Usage:**
```bash
npx hardhat arweave:address [options]
```

**Parameters:**
- `--wallet` (optional): Path to Arweave wallet JSON file (default: `wallet.json`).

**Examples:**
```bash
# Get address from default wallet
npx hardhat arweave:address

# Get address from specific wallet
npx hardhat arweave:address --wallet ./arweave-wallet.json
```

---

#### `arweave:balance`

Get the balance of an Arweave wallet or address.

**Usage:**
```bash
npx hardhat arweave:balance [options]
```

**Parameters:**
- `--wallet` (optional): Path to Arweave wallet JSON file (default: `wallet.json`).
- `--address` (optional): Arweave address to check balance.

**Examples:**
```bash
# Check wallet balance
npx hardhat arweave:balance --wallet ./wallet.json

# Check address balance
npx hardhat arweave:balance --address <arweave-address>
```

**Output:**
- Balance in Winston (smallest unit)
- Balance in AR (readable format)

---

#### `arweave:send`

Send AR tokens from a wallet to an address.

**Usage:**
```bash
npx hardhat arweave:send --wallet <path> --to <address> --amount <amount>
```

**Parameters:**
- `--wallet` (required): Path to Arweave wallet JSON file.
- `--to` (required): Destination Arweave address.
- `--amount` (required): Amount to send in AR (not Winston).
- `--self` (flag): Allow sending to the same address (for testing/debugging).

**Examples:**
```bash
# Send AR tokens
npx hardhat arweave:send --wallet ./wallet.json --to <address> --amount 0.1

# Self-send (for testing)
npx hardhat arweave:send --wallet ./wallet.json --to <same-address> --amount 0.01 --self
```

**Output:**
- Transaction ID
- Transaction status
- View transaction link

---

### WordPress Optimization Tasks

#### `wp-minimize`

Minimize WordPress site by identifying unused files. Can generate `.wttpignore` or delete unused files.

**Usage:**
```bash
npx hardhat wp-minimize --path <directory> [options]
```

**Parameters:**
- `--path` (required): Path to WordPress site directory.
- `--delete-files` (flag): Delete unused files instead of creating `.wttpignore`.
- `--dry-run` (flag): Show what would be done without making changes.
- `--debug` (flag): Enable debug output to see reference processing.

**Examples:**
```bash
# Analyze and generate .wttpignore
npx hardhat wp-minimize --path ./wordpress-site

# Delete unused files
npx hardhat wp-minimize --path ./wordpress-site --delete-files

# Dry run to see what would be done
npx hardhat wp-minimize --path ./wordpress-site --dry-run
```

**Features:**
- Scans HTML files for references
- Scans CSS files for references
- Tracks file usage counts
- Identifies unused files
- Calculates potential savings

---

#### `wp-ninja-fix`

Replace Ninja Forms with custom HTML forms. Removes Ninja Forms JavaScript and replaces forms with static HTML.

**Usage:**
```bash
npx hardhat wp-ninja-fix --path <directory> [options]
```

**Parameters:**
- `--path` (required): Path to WordPress site directory.
- `--dry-run` (flag): Show what would be done without making changes.
- `--backup` (flag): Create backup files and add them to `.wttpignore`.

**Examples:**
```bash
# Replace Ninja Forms
npx hardhat wp-ninja-fix --path ./wordpress-site

# Dry run to see changes
npx hardhat wp-ninja-fix --path ./wordpress-site --dry-run

# With backups
npx hardhat wp-ninja-fix --path ./wordpress-site --backup
```

**Features:**
- Extracts form data from Ninja Forms JavaScript
- Generates custom HTML forms
- Removes Ninja Forms JavaScript
- Preserves form functionality
- Creates backups (optional)

---

#### `wp-routes`

Process WordPress site routes using `routes.json` configuration. Updates links and creates client-side redirects.

**Usage:**
```bash
npx hardhat wp-routes --path <directory> [options]
```

**Parameters:**
- `--path` (required): Path to WordPress site directory.
- `--config-file` (optional): Path to `routes.json` configuration file (defaults to `{path}/routes.json`).
- `--dry-run` (flag): Show what would be done without making changes.
- `--backup` (flag): Create backup files.
- `--no-redirect` (flag): Skip creating client-side redirect script.

**Examples:**
```bash
# Process routes
npx hardhat wp-routes --path ./wordpress-site

# Dry run
npx hardhat wp-routes --path ./wordpress-site --dry-run

# With backups
npx hardhat wp-routes --path ./wordpress-site --backup
```

**Configuration File (`routes.json`):**
```json
{
  "routes": {
    "/old-path": {
      "redirect": "/new-path",
      "method": "replace"
    }
  },
  "settings": {
    "backupOriginals": false,
    "updateCanonicalUrls": true,
    "updateOembedUrls": true,
    "clientSideRedirects": true,
    "preserveQueryParams": true,
    "preserveHashFragments": true
  }
}
```

---

## Hardhat Scripts

Hardhat scripts are Node.js modules that can be imported and used in your own scripts. They use Hardhat's ethers instance and are designed for use within Hardhat projects.

### Available Scripts

#### `uploadFile`

Upload a single file to a WTTP site.

**Location:** `src/scripts/uploadFile.ts`

**Usage:**
```typescript
import { uploadFile } from "./scripts/uploadFile";
import { ethers } from "hardhat";

const wttpSite = await ethers.getContractAt("Web3Site", siteAddress);
await uploadFile(
  wttpSite,
  "./index.html",
  "/index.html",
  400 * 1024 * 1024, // fileLimitBytes
  300 // gasLimitGwei
);
```

**Parameters:**
- `wttpSite`: Web3Site contract instance
- `sourcePath`: Source file path
- `destinationPath`: Destination path on site
- `fileLimitBytes` (optional): Maximum file size in bytes
- `gasLimitGwei` (optional): Maximum gas price in gwei

---

#### `uploadDirectory`

Upload a directory recursively to a WTTP site.

**Location:** `src/scripts/uploadDirectory.ts`

**Usage:**
```typescript
import { uploadDirectory } from "./scripts/uploadDirectory";
import { ethers } from "hardhat";

const wttpSite = await ethers.getContractAt("Web3Site", siteAddress);
await uploadDirectory(
  wttpSite,
  "./public",
  "/",
  { includeDefaults: true }, // ignoreOptions
  400 * 1024 * 1024, // fileLimitBytes
  300 // gasLimitGwei
);
```

**Parameters:**
- `wttpSite`: Web3Site contract instance
- `sourcePath`: Source directory path
- `destinationPath`: Destination path on site
- `ignoreOptions` (optional): WTTP ignore configuration
- `fileLimitBytes` (optional): Maximum file size in bytes
- `gasLimitGwei` (optional): Maximum gas price in gwei

---

#### `uploadFromManifest`

Upload files using a manifest file.

**Location:** `src/scripts/uploadFromManifest.ts`

**Usage:**
```typescript
import { uploadFromManifest } from "./scripts/uploadFromManifest";
import { ethers } from "hardhat";

const wttpSite = await ethers.getContractAt("Web3Site", siteAddress);
await uploadFromManifest(
  wttpSite,
  "./wttp.manifest.json",
  "./public" // optional source path
);
```

**Parameters:**
- `wttpSite`: Web3Site contract instance
- `manifestPath`: Path to manifest file
- `sourcePath` (optional): Source directory path

---

#### `fetchResource`

Fetch a resource from a WTTP site.

**Location:** `src/scripts/fetchResource.ts`

**Usage:**
```typescript
import { fetchResource } from "./scripts/fetchResource";

const resource = await fetchResource(
  siteAddress,
  "/index.html",
  {
    range: { start: 0, end: 1024 },
    ifModifiedSince: 1234567890,
    ifNoneMatch: "0x...",
    headRequest: false,
    datapoints: false
  }
);
```

**Parameters:**
- `siteAddress`: WTTP site contract address
- `path`: Resource path
- `options` (optional): Request options

---

#### `generateManifest`

Generate a manifest file for a directory.

**Location:** `src/scripts/generateManifest.ts`

**Usage:**
```typescript
import { generateManifest, saveManifest } from "./scripts/generateManifest";
import { ethers } from "hardhat";

const wttpSite = await ethers.getContractAt("Web3Site", siteAddress);
const manifest = await generateManifest(
  wttpSite,
  "./public",
  "/",
  {
    gasLimit: 300,
    fileLimit: 400,
    ignorePattern: ".wttpignore"
  }
);

saveManifest(manifest, "./wttp.manifest.json");
```

**Parameters:**
- `wttpSite`: Web3Site contract instance (optional, for cost estimates)
- `sourcePath`: Source directory path
- `destinationPath`: Destination path on site
- `config` (optional): Manifest configuration
- `existingManifest` (optional): Existing manifest to update

---

#### `uploadToArweave`

Upload files to Arweave and update manifest.

**Location:** `src/scripts/uploadToArweave.ts`

**Usage:**
```typescript
import { uploadToArweave } from "./scripts/uploadToArweave";

const result = await uploadToArweave(
  "./wttp.manifest.json",
  {
    walletPath: "./wallet.json",
    sourcePath: "./public",
    uploadManifest: false
  }
);
```

**Parameters:**
- `manifestPath`: Path to manifest file
- `options`: Upload options

---

## Standalone Ethers Scripts

Standalone ethers.js scripts can be used outside of Hardhat projects. They work with standard ethers.js providers and signers.

### Available Scripts

#### `deploy`

Deploy a Web3Site contract using standard ethers.js.

**Location:** `src/ethers/deploy.ts`

**Usage:**
```typescript
import { deployWeb3Site } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(privateKey, provider);

const result = await deployWeb3Site({
  provider,
  signer,
  ownerAddress: "0x...",
  dprAddress: "0x...",
  defaultHeader: DEFAULT_HEADER,
  autoFund: false
});

console.log(`Deployed at: ${result.address}`);
```

**Parameters:**
- `provider`: Ethers.js provider
- `signer`: Ethers.js signer
- `ownerAddress`: Site owner address
- `dprAddress`: DPR contract address
- `defaultHeader` (optional): Default header configuration
- `autoFund` (optional): Auto-fund deployer if needed

**Returns:**
- `contract`: Deployed contract instance
- `address`: Contract address
- `deployerAddress`: Deployer address
- `ownerAddress`: Owner address
- `dprAddress`: DPR address
- `txHash`: Transaction hash
- `actualCost`: Actual deployment cost

---

#### `uploadFile`

Upload a file using standard ethers.js.

**Location:** `src/ethers/uploadFile.ts`

**Usage:**
```typescript
import { uploadFile } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(privateKey, provider);

const result = await uploadFile(
  "0x...", // siteAddress
  "./index.html",
  "/index.html",
  {
    provider,
    signer,
    fileLimitBytes: 400 * 1024 * 1024,
    gasLimitGwei: 300
  }
);
```

**Parameters:**
- `wttpSiteAddress`: WTTP site contract address
- `sourcePath`: Source file path
- `destinationPath`: Destination path on site
- `options`: Upload options

**Returns:**
- `response`: LOCATEResponseStruct
- `content`: File content (optional)

---

#### `uploadDirectory`

Upload a directory using standard ethers.js.

**Location:** `src/ethers/uploadDirectory.ts`

**Usage:**
```typescript
import { uploadDirectory } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(privateKey, provider);

await uploadDirectory(
  "0x...", // siteAddress
  "./public",
  "/",
  {
    provider,
    signer,
    ignoreOptions: { includeDefaults: true },
    fileLimitBytes: 400 * 1024 * 1024,
    gasLimitGwei: 300
  }
);
```

**Parameters:**
- `wttpSiteAddress`: WTTP site contract address
- `sourcePath`: Source directory path
- `destinationPath`: Destination path on site
- `options`: Upload options

---

#### `estimate`

Estimate gas costs for uploads using standard ethers.js.

**Location:** `src/ethers/estimate.ts`

**Usage:**
```typescript
import { estimateFile, estimateDirectory } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

// Estimate file
const fileEstimate = await estimateFile(
  "0x...", // siteAddress
  "./index.html",
  "/index.html",
  {
    provider,
    gasPriceGwei: 50,
    rate: 2,
    minGasPriceGwei: 150
  }
);

// Estimate directory
const dirEstimate = await estimateDirectory(
  "0x...", // siteAddress
  "./public",
  "/",
  {
    provider,
    gasPriceGwei: 50,
    rate: 2,
    minGasPriceGwei: 150
  }
);
```

**Parameters:**
- `wttpSiteAddress`: WTTP site contract address
- `sourcePath`: Source file or directory path
- `destinationPath`: Destination path on site
- `options`: Estimation options

**Returns:**
- `totalGas`: Total gas estimate
- `totalCost`: Total cost estimate
- `royaltyCost`: Royalty cost estimate
- `transactionCount`: Number of transactions
- `chunksToUpload`: Number of chunks to upload

---

#### `fetchResource`

Fetch a resource using standard ethers.js.

**Location:** `src/ethers/fetchResource.ts`

**Usage:**
```typescript
import { fetchResource } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");

const resource = await fetchResource(
  provider,
  "0x...", // siteAddress
  "/index.html",
  {
    ifModifiedSince: 1234567890,
    ifNoneMatch: "0x...",
    range: { start: 0, end: 1024 },
    headRequest: false,
    datapoints: false
  }
);
```

**Parameters:**
- `provider`: Ethers.js provider
- `siteAddress`: WTTP site contract address
- `path`: Resource path
- `options`: Request options

**Returns:**
- `response`: LOCATEResponseStruct
- `content`: Resource content (optional)

---

#### `generateManifest`

Generate a manifest using standard ethers.js.

**Location:** `src/ethers/generateManifest.ts`

**Usage:**
```typescript
import { generateManifestStandalone, saveManifest } from "@wttp/site/ethers";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(privateKey, provider);

const manifest = await generateManifestStandalone(
  "./public",
  "/",
  {
    gasLimit: 300,
    fileLimit: 400,
    ignorePattern: ".wttpignore"
  },
  undefined, // existingManifest
  {
    provider,
    signer,
    wttpSiteAddress: "0x...",
    chainId: 11155111,
    chainName: "sepolia",
    currencySymbol: "ETH"
  }
);

saveManifest(manifest, "./wttp.manifest.json");
```

**Parameters:**
- `sourcePath`: Source directory path
- `destinationPath`: Destination path on site
- `config` (optional): Manifest configuration
- `existingManifest` (optional): Existing manifest to update
- `options` (optional): Generation options

---

#### `uploadToArweave`

Upload files to Arweave using standard ethers.js.

**Location:** `src/ethers/uploadToArweave.ts`

**Usage:**
```typescript
import { uploadToArweave } from "@wttp/site/ethers";

const result = await uploadToArweave(
  "./wttp.manifest.json",
  {
    walletPath: "./wallet.json",
    sourcePath: "./public",
    uploadManifest: false
  }
);
```

**Parameters:**
- `manifestPath`: Path to manifest file
- `options`: Upload options

**Returns:**
- `filesUploaded`: Number of files uploaded
- `filesSkipped`: Number of files skipped
- `txIds`: Map of file paths to transaction IDs
- `manifestTxId`: Manifest transaction ID (if uploaded)

---

## Usage Examples

### Complete Workflow Example

```bash
# 1. Deploy a site
npx hardhat site:deploy --network sepolia

# 2. Generate manifest with cost estimates
npx hardhat site:manifest --source ./public --site 0x... --network sepolia

# 3. Upload files using manifest
npx hardhat site:upload --manifest ./wttp.manifest.json --network sepolia

# 4. Fetch a resource
npx hardhat site:fetch --site 0x... --path /index.html --network sepolia
```

### Using Standalone Scripts in Your Code

```typescript
import { deployWeb3Site, uploadFile } from "@wttp/site/ethers";
import { ethers } from "ethers";

// Setup
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/YOUR_KEY");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Deploy
const deployment = await deployWeb3Site({
  provider,
  signer,
  ownerAddress: signer.address,
  dprAddress: "0x...", // Official ESP DPR
});

// Upload
await uploadFile(
  deployment.address,
  "./index.html",
  "/index.html",
  {
    provider,
    signer,
    fileLimitBytes: 400 * 1024 * 1024,
    gasLimitGwei: 300
  }
);
```

### WordPress Site Optimization Workflow

```bash
# 1. Minimize unused files
npx hardhat wp-minimize --path ./wordpress-site --dry-run

# 2. Fix Ninja Forms
npx hardhat wp-ninja-fix --path ./wordpress-site --backup

# 3. Process routes
npx hardhat wp-routes --path ./wordpress-site --backup

# 4. Generate manifest
npx hardhat site:manifest --source ./wordpress-site --network sepolia

# 5. Upload
npx hardhat site:upload --manifest ./wordpress-site/wttp.manifest.json --network sepolia
```

---

## Additional Resources

- [WTTP Core Documentation](https://github.com/TechnicallyWeb3/wttp-core)
- [ESP Documentation](https://github.com/TechnicallyWeb3/esp)
- [Arweave Documentation](https://docs.arweave.org/)

---

## Support

For issues, questions, or contributions, please visit the [WTTP Site GitHub repository](https://github.com/TechnicallyWeb3/wttp-site).
