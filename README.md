<!--
© 2025 TechnicallyWeb3 – Licensed under AGPL-3.0
-->

# WTTP Site: Your On-Chain Web Server

**Host dynamic and static websites directly on any EVM-compatible blockchain.**

[![npm version](https://img.shields.io/npm/v/wttp-site.svg)](https://www.npmjs.com/package/wttp-site)
[![License](https://img.shields.io/npm/l/wttp-site.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-215%20passing-brightgreen)](./test/)
[![Docs](https://img.shields.io/badge/docs-comprehensive-blue)](./docs/)

WTTP Site provides a powerful set of smart contracts that act as a decentralized, on-chain web server. It solves the last-mile problem of Web3 front-end hosting by moving your entire website—not just the data—onto the blockchain, making it as resilient and censorship-resistant as the underlying network itself.

- **Stop Relying on Centralized Hosting**: Eliminate dependencies on AWS S3, Vercel, or IPFS for your dApp's front end.
- **HTTP-like Experience**: Use familiar methods like `GET`, `PUT`, and `POST` directly on-chain.
- **On-Chain Logic**: Implement dynamic, server-side logic within your smart contract website.

---

## 🚀 Quick Start

Get your first on-chain website live in minutes.

#### 1. Clone and Set Up the Repository (Preferred Method)

To get started quickly with minimal setup, clone this repository and use the pre-configured setup:

```bash
# Clone the repository
git clone https://github.com/TechnicallyWeb3/wttp-site.git
```

```bash
# Navigate into the project directory
cd wttp-site
```

```bash
# Install dependencies
npm install
```

```bash
# Compile the smart contracts
npm run compile
```

This method is the easiest and fastest way to get your on-chain website live without manually configuring the Hardhat extension or installing the package separately. Once dependencies are installed and contracts are compiled, you can immediately proceed to running a local Hardhat node and deploying your site.

---

The previous instructions for installing and configuring the npm package remain available as an alternative method for advanced users or custom setups.

```bash
npm install @wttp/site
```

To use this as a hardhat package you should import this package into your hardhat config file. 

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@wttp/site";

const config: HardhatUserConfig = {
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337, // all configured networks must include chainId
        },
        // ... your other networks
    },
  // ... your other config options
};

export default config;
```

```javascript
// hardhat.config.js
require("@wttp/site");

module.exports = {
    networks: {
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337 // all configured networks must include chainId
        }
        // ... your other networks
    }
  // ... your other config options
};
```
### 2. Run a Local Hardhat Node

You can deploy these on any network you want however for testing a local hardhat node will perform best. You'll need to open a separate terminal you can keep open in the background. 

```bash
# Start a node. *hardhat.config must have localhost enabled, see example above
npx hardhat node
```

### 3. Deploy Your Site (Zero-Parameter Deployment)

Thanks to intelligent defaults, you can deploy a fully-configured site with a single command. It automatically uses the official ESP deployment on the target network and sets up secure defaults.

```bash
# Deploy to localhost testnet (or any configured network)
npx hardhat site:deploy --network localhost
```

That's it! Your on-chain web server is now live. You should see an output like this:

```bash
# Output from the previous command
🚀 Web3Site Deployment Task
🌐 Network: localhost

👤 Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
👤 Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
📍 Using test DPS(temporary deployment): 0x74Cf9087AD26D541930BaC724B7ab21bA8F00a27
Deployment args: {"dps":"0x74Cf9087AD26D541930BaC724B7ab21bA8F00a27","royaltyRate":1000,"owner":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"}       
0xefAB0Beb0A557E452b398035eA964948c750b2Fd
📍 Using test DPR(temporary deployment): 0xefAB0Beb0A557E452b398035eA964948c750b2Fd
⚙️  Cache preset: 3
⚙️  Cache preset resolved: 3 (from '3')
💰 Deployer balance: 9999.644627285828822945 ETH
💰 Owner balance: 9999.644627285828822945 ETH
⛽ Estimated cost: 0.005559766639145744 ETH (5054333 gas)
🚀 Deploying Web3Site...
✅ Web3Site deployed successfully!
📍 Address: 0xaca81583840B1bf2dDF6CDe824ada250C1936B4D
🔗 Transaction: 0xd034c5a304bb15d9d9a31e7a0b71a37c1931cc5a84d13f588428be2ac6a2be55
🧪 Contract test passed - DPR: 0xefAB0Beb0A557E452b398035eA964948c750b2Fd

🎉 Deployment Summary:
==================================================
Web3Site: 0xaca81583840B1bf2dDF6CDe824ada250C1936B4D
Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DPR: 0xefAB0Beb0A557E452b398035eA964948c750b2Fd
Transaction: 0xd034c5a304bb15d9d9a31e7a0b71a37c1931cc5a84d13f588428be2ac6a2be55
==================================================
```

### 4. Upload Your Website

Upload a directory of static files (HTML, CSS, JS) to your new on-chain site. Add your site to a directory in the hardhat project somewhere, for example `./public/`

```bash
# The --site parameter is the address from the previous step
npx hardhat site:upload --site 0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44 --source ./public --network localhost
```

You should see a message saying `Directory .\public\ uploaded successfully to /` to indicate the upload completed successfully, though if you have any issues refer to the logs in the console.

### 5. Fetch Resources from Your Website

You can now see your site living on chain with the following command:

```bash
# The --site parameter is the address from the previous steps
npx hardhat site:fetch --site 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 --network localhost
```

Or lookup a resource such as:
```bash
# The --path parameter is the path of the resource you're looking for, / if empty
npx hardhat site:fetch --site 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9 --path /index.html --network localhost
```

### 6. Environment Configuration (Optional)

For deploying to live networks and contract verification, you'll need to set up environment variables. Create a `.env` file in the project root:

```bash
# Create .env file from template (if available)
cp .env.template .env
```

Then configure the following variables in your `.env` file:

```bash
# Your wallet mnemonic (12-24 word phrase) - KEEP THIS SECURE!
OWNER_MNEMONIC="your twelve word mnemonic phrase here for deployment wallet"

# Etherscan API key for contract verification on Ethereum networks
ETHERSCAN_API_KEY="your_etherscan_api_key_here"

# PolygonScan API key for contract verification on Polygon network
POLYGONSCAN_API_KEY="your_polygonscan_api_key_here"
```

**Security Note**: Never commit your `.env` file to version control. The `.gitignore` file already excludes it by default.

**Getting API Keys**:
- **Etherscan API**: Register at [etherscan.io](https://etherscan.io/apis) and create a free API key
- **PolygonScan API**: Register at [polygonscan.com](https://polygonscan.com/apis) and create a free API key

### 7. Supported Networks

WTTP Site supports deployment to the following networks:

| Network | Chain ID | Network Flag | Description |
| :--- | :--- | :--- | :--- |
| **Localhost** | 31337 | `--network localhost` | Local Hardhat development network |
| **Sepolia** | 11155111 | `--network sepolia` | Ethereum testnet - free ETH from faucets |
| **Polygon** | 137 | `--network polygon` | Polygon mainnet - low-cost transactions |

**Example deployment to Sepolia testnet**:
```bash
npx hardhat site:deploy --network sepolia
```

**Example deployment to Polygon mainnet**:
```bash
npx hardhat site:deploy --network polygon
```

**Note**: For testnet deployments (Sepolia), you can get free test ETH from faucets like [sepoliafaucet.com](https://sepoliafaucet.com). For Polygon mainnet, you'll need real MATIC tokens.

#### Infrastructure Addresses

WTTP Site uses the following infrastructure contracts (same addresses across all supported chains):

| Contract | Address | Description |
| :--- | :--- | :--- |
| **DPS** | `0xDA7Adb41ac559e689fE170aE4f2853a450e6E4Cc` | DataPointStorage - handles on-chain data storage |
| **DPR** | `0xDA7Ae59Fa1DB9B138dddaaFB6153B11B162Cfd8B` | DataPointRegistry - manages data point registration |
| **WTTPGateway** | `0x6A7E6a45573D9E51D53413B25399311B0df42687` | WTTP Gateway - provides HTTP-like interface |

These are vanity addresses deployed consistently across Localhost, Sepolia, and Polygon networks.

---

## ⚙️ Easy Configuration with Presets

Customize your site's behavior instantly using powerful preset flags. No need to write custom code for common configurations.

| Flag | Preset | Description |
| :--- | :--- | :--- |
| `--header-preset` | `static-website` | Sets standard caching and content type headers for a typical static site. |
| | `dynamic-api` | Disables caching and sets JSON content type for API-like use cases. |
| | `immutable` | Sets long-term caching for content that will never change. |
| `--cors-preset` | `allow-all` | Allows cross-origin requests from any domain. **Use with caution.** |
| | `same-origin` | Enforces a strict same-origin policy. |
| | `allow-wttp` | Allows requests from other WTTP-powered sites. |
| `--cache-preset` | `aggressive` | Sets a long `max-age` (1 year) for all resources. |
| | `standard` | Sets a moderate `max-age` (1 hour). This is the default. |
| | `none` | Disables caching entirely. |

**Example:** Deploy a site optimized for an immutable static asset collection.
```bash
npx hardhat site:deploy --header-preset immutable --cache-preset aggressive --network sepolia
```

---

## 🛠️ Build and Test Locally

To work with the contracts directly, you can build and test from the source.

```bash
# Compile the smart contracts
npm run build

# Run the full test suite
npm run test
```

## 📚 Full Documentation

For in-depth guides, tutorials, and advanced use cases, please visit our full documentation.

- **[User Guides](./docs/user-guide/)**: Learn about the core concepts, contract architecture, and blockchain basics.
- **[Tutorials](./docs/tutorials/)**: Follow step-by-step instructions for common tasks like uploading sites and managing permissions.
- **[Examples](./docs/examples/)**: Explore complete, working examples for static sites, blogs, file storage, and more.

## 🛡️ File Filtering with `.wttpignore`

WTTP automatically protects you from accidentally uploading sensitive files to the blockchain. When uploading directories, the system uses gitignore-style patterns to filter out files that shouldn't be deployed on-chain.

### Automatically Ignored Files

The following files and directories are **automatically ignored** for security:

- **Version Control**: `.git/`, `.gitignore`, `.gitattributes`
- **Environment Files**: `.env`, `.env.*` (API keys, secrets, etc.)
- **Dependencies**: `node_modules/`, `.npm/`, `.yarn/`
- **Editor Files**: `.vscode/`, `.idea/`, `*.swp`, `*.swo`, `*~`
- **System Files**: `.DS_Store`, `Thumbs.db`, `desktop.ini`
- **Temporary Files**: `.cache/`, `.temp/`, `.tmp/`, `*.log`
- **WTTP Files**: `*.wttpignore`

### Custom Ignore Patterns

Create a `.wttpignore` file in your project root to add custom patterns:

```bash
# Custom ignore patterns
secrets/
*.key
draft-*
temp-*

# Negation: include specific files even if they match other patterns
!important.md
!dist/production.js
```

The `.wttpignore` file uses the same syntax as `.gitignore`. See the included [`.wttpignore`](./.wttpignore) file for comprehensive examples.

### Disable Protection (⚠️ Not Recommended)

```bash
# WARNING: This disables default protections and could expose sensitive data
npx hardhat site:upload --site YOUR_SITE --source ./my-website --nodefaults true --network localhost
```

**Always test uploads on a local network first** to ensure no sensitive data is accidentally included.

---

## 📄 License

This project is licensed under the **AGPL-3.0**. See the [LICENSE](./LICENSE) file for details.
