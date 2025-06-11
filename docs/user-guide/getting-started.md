# Getting Started with WTTP

## Your First WTTP Site in 5 Steps

Ready to put your website on the blockchain? Let's walk through creating your first WTTP site step by step.

### Prerequisites

**What you need:**
- Node.js (v16 or higher)
- A wallet with some ETH for gas fees
- Basic familiarity with command line
- Your website files ready to upload

**No Solidity knowledge required!** WTTP handles the smart contract complexity for you.

---

## Step 1: Set Up Your Environment

```bash
# Clone the WTTP repository
git clone https://github.com/your-org/wttp-site
cd wttp-site

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

**Edit your `.env` file:**
```env
PRIVATE_KEY=your_wallet_private_key_here
NETWORK=sepolia  # or mainnet for production
```

> 🔒 **Security Note**: Never commit your private key to version control!

---

## Step 2: Deploy Your Site Contract

```bash
# Deploy a new WTTP site
npx hardhat run scripts/deploy-site.js --network sepolia
```

**What happens:**
- Creates your personal WTTP site contract
- You become the SITE_ADMIN automatically
- Returns your site address (save this!)

**Expected output:**
```
✅ WTTP Site deployed at: 0x742d35Cc6523C0532...
✅ You are the site admin
✅ Gas used: ~2.1M gas
```

---

## Step 3: Upload Your First File

Let's upload a simple HTML page:

**Create `hello.html`:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>My First WTTP Site</title>
</head>
<body>
    <h1>Hello, Decentralized Web!</h1>
    <p>This page is hosted on the blockchain using WTTP.</p>
</body>
</html>
```

**Upload it:**
```bash
# Upload using the PUT method (just like HTTP!)
npx hardhat run scripts/put-file.js --network sepolia
```

**The script will prompt you:**
```
Site address: 0x742d35Cc6523C0532...
File path: hello.html
Resource name: /index.html
```

**What happens behind the scenes:**
- File gets chunked into 32KB pieces (WTTP handles this)
- Each chunk stored securely on blockchain
- Metadata tracks all chunks for reassembly
- File becomes accessible via HTTP-like GET requests

---

## Step 4: Fetch Your Content

Retrieve your uploaded content:

```bash
# Get your file back (just like HTTP GET!)
npx hardhat run scripts/get-file.js --network sepolia
```

**The script prompts:**
```
Site address: 0x742d35Cc6523C0532...
Resource name: /index.html
```

**You'll see:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>My First WTTP Site</title>
</head>
<body>
    <h1>Hello, Decentralized Web!</h1>
    <p>This page is hosted on the blockchain using WTTP.</p>
</body>
</html>
```

---

## Step 5: Set Up Permissions

Control who can access your site:

```bash
# Make your site publicly readable
npx hardhat run scripts/set-permissions.js --network sepolia
```

**Permission options:**
- **Private**: Only you can read/write
- **Public Read**: Anyone can read, only you can write
- **Community**: Specific users can write
- **Open**: Anyone can read and write (use carefully!)

---

## 🎉 Congratulations!

You've successfully:
- ✅ Deployed a WTTP site contract
- ✅ Uploaded your first file to the blockchain
- ✅ Retrieved content using GET method
- ✅ Set up access permissions

**Your website is now living on the blockchain!**

---

## What's Next?

Now that you have the basics, explore more advanced features:

1. **[Upload a Complete Website](../tutorials/upload-website-files.md)** - Deploy multiple files and folders
2. **[Permission Management](../tutorials/permission-management.md)** - Fine-tune who can access what
3. **[Common Use Cases](common-use-cases.md)** - See what others are building
4. **[API Integration](../api-reference/)** - Connect your apps to WTTP

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