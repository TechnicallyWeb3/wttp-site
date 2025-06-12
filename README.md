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

### 1. Install the Package

```bash
npm install wttp-site
```

Or, to use the Hardhat tasks directly from the repository:
```bash
git clone https://github.com/TechnicallyWeb3/wttp-site.git
cd wttp-site
npm install
```

### 2. Deploy Your Site (Zero-Parameter Deployment)

Thanks to intelligent defaults, you can deploy a fully-configured site with a single command. It automatically uses the official ESP deployment on the target network and sets up secure defaults.

```bash
# Deploy to Sepolia testnet (or any configured network)
npx hardhat deploy:site --network sepolia
```
That's it! Your on-chain web server is now live.

### 3. Upload Your Website

Upload a directory of static files (HTML, CSS, JS) to your new on-chain site.

```bash
# The --site parameter is the address from the previous step
npx hardhat upload:directory --site <YOUR_SITE_CONTRACT_ADDRESS> --source ./path/to/your/website --network sepolia
```

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
npx hardhat deploy:site --header-preset immutable --cache-preset aggressive --network sepolia
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

## 📄 License

This project is licensed under the **AGPL-3.0**. See the [LICENSE](./LICENSE) file for details.
