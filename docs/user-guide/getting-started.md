<!--
© 2025 TechnicallyWeb3 – Licensed under AGPL-3.0
-->

# Getting Started with WTTP Site

Welcome to the future of web hosting. This guide will walk you through deploying a fully on-chain, decentralized website using WTTP Site. Thanks to a streamlined command-line interface (CLI) and intelligent defaults, you can get started without writing a single line of Solidity.

---

## 1. Installation

You have two ways to use WTTP Site.

### For Consumers (Recommended)

If you just want to deploy sites and upload files, install the package globally or locally in your project.

```bash
# Install globally to use the commands anywhere
npm install -g wttp-site

# Or install in your existing project
npm install wttp-site
```

This gives you access to the `hardhat` command, which is the main entry point for all WTTP tasks.

### For Developers

If you want to extend the contracts or contribute to the project, clone the repository directly.

```bash
git clone https://github.com/TechnicallyWeb3/wttp-site.git
cd wttp-site
npm install
```

#### Peer Dependencies

WTTP Site relies on `hardhat` and `ethers`. If you are installing it in a fresh project, you may need to install these as well:
```bash
npm install hardhat ethers
```

---

## 2. The "Just Works" Deployment

Deploying your on-chain website is now a single command. You don't need to provide any parameters to get a secure, functional site up and running.

```bash
# Deploy to Sepolia testnet (or any network configured in your hardhat.config.ts)
npx hardhat deploy:site --network sepolia
```

**What this command does for you:**
- **Finds Official Contracts**: It automatically locates the correct addresses for the ESP core contracts (`DataPointRegistry`) on the specified network.
- **Sets Secure Defaults**: Your user wallet is assigned as the `SITE_ADMIN`, giving you full control. Public access is disabled by default.
- **Deploys Your Site**: A new `Web3Site.sol` contract is deployed to the blockchain.
- **Returns the Address**: The CLI prints the address of your new on-chain site. **Save this address!**

**Expected Output:**
```
✅ Compiling contracts...
✅ Site contract deployed to: 0x... (Your new site address)
✅ Owner set to: 0x... (Your wallet address)
```
---

## 3. Configuring Your Site with Presets

For most common use cases, you don't need to write custom deployment scripts. You can configure caching, headers, and CORS rules directly from the command line using presets.

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

#### Example Usage

Deploy a site optimized to serve an immutable NFT collection with aggressive caching and open CORS policies.

```bash
npx hardhat deploy:site \
  --header-preset immutable \
  --cache-preset aggressive \
  --cors-preset allow-all \
  --network sepolia
```

You can also override any specific default. For example, to set a custom cache age:
```bash
# Set cache to 2 hours (7200 seconds)
npx hardhat deploy:site --max-age 7200 --network sepolia
```

---

## 4. Managing Website Content

WTTP provides simple tasks for uploading and retrieving files.

### `upload:directory`
The easiest way to upload a full website. This task recursively uploads all files from a local directory to your on-chain site.

```bash
# Uploads the contents of the `my-website` folder to the root of your on-chain site
npx hardhat upload:directory \
  --site <YOUR_SITE_ADDRESS> \
  --source ./my-website \
  --network sepolia
```
> **Critical Tip:** This command is idempotent. If you run it again, it will only upload new or changed files, saving you gas. It automatically handles content hashing and chunking.

### `upload:file`
To upload a single file.

```bash
# Upload a single index.html file
npx hardhat upload:file \
  --site <YOUR_SITE_ADDRESS> \
  --source ./index.html \
  --destination /index.html \
  --network sepolia
```

### `fetch`
To retrieve the raw content of an on-chain resource.

```bash
# Fetch the content of /index.html from your site
npx hardhat fetch \
  --site <YOUR_SITE_ADDRESS> \
  --path /index.html \
  --network sepolia
```

---

## 🎉 Congratulations!

You now have a live, on-chain website that is as decentralized and resilient as the Ethereum network itself.

### What's Next?
- **[Upload a Complete Website](../tutorials/upload-website-files.md)**: A deeper dive into the `upload:directory` task.
- **[Manage Permissions](../tutorials/permission-management.md)**: Learn how to grant access to others or make your site public.
- **[Explore Examples](../examples/)**: See real-world examples for blogs, file storage, and more.

---

## Quick Commands Reference

```bash
# Deploy new site
npx hardhat run scripts/deploy-site.js --network sepolia

# Upload file
npx hardhat run scripts/put-file.js --network sepolia

# Download file  
npx hardhat run scripts/get-file.js --network sepolia

# Update file
npx hardhat run scripts/patch-file.js --network sepolia

# Delete file
npx hardhat run scripts/delete-file.js --network sepolia

# Set permissions
npx hardhat run scripts/set-permissions.js --network sepolia

# Run tests (verify everything works)
npm test
```

---

## Need Help?

- 🐛 **Issues?** Check our [Troubleshooting Guide](../tutorials/troubleshooting.md)
- 💬 **Questions?** Join our [Discord community](https://discord.gg/wttp)
- 📚 **Deep dive?** Read the [Technical Documentation](../api-reference/)
- 🔧 **Contributing?** See our [Developer Guide](../contributing.md)

**Welcome to the decentralized web!** 🌐✨ 