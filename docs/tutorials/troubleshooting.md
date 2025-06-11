# WTTP Troubleshooting Guide

## Quick Solutions for Common Issues

Having trouble with WTTP? You're not alone! This guide covers the most common issues new developers face.

---

## 🚨 Quick Diagnostics

**Start here when something goes wrong:**

```bash
# Check your setup
npx hardhat --version
node --version

# Test wallet connection  
npx hardhat accounts --network sepolia

# Verify site is working
npx hardhat run scripts/test-site.js --network sepolia
```

---

## ⛽ Gas & Transaction Problems

### "Transaction failed - out of gas"

**What it means**: Not enough gas to complete the transaction.

**Quick fix**:
```javascript
// Increase gas limit
const tx = await wttpSite.PUT("/file.html", data, "text/html", {
  gasLimit: 3000000
});
```

**Better solution**: Optimize your files first
- Compress images 
- Minify CSS/JS
- Test with small files

### "Insufficient funds for gas"

**What it means**: Your wallet needs more ETH.

**For testnet (Sepolia)**:
- Get free ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

**For mainnet**:
- Buy ETH from an exchange
- Transfer to your wallet

---

## 🔐 Permission Issues

### "AccessControl: account is missing role"

**What it means**: You don't have permission for that action.

**Quick check**:
```bash
# See who has what permissions
npx hardhat run scripts/list-permissions.js --network sepolia
```

**Fix permissions**:
```bash
# Grant yourself editor role
npx hardhat run scripts/manage-users.js --network sepolia
# Choose: grant-role → CONTENT_EDITOR → your_address
```

### "Cannot read resource - access denied"

**What it means**: The file is private.

**Make it public**:
```javascript
await wttpSite.grantRole(PUBLIC_ROLE, ethers.constants.AddressZero);
```

---

## 📁 File Upload Problems

### "File not found" after upload

**Common causes**:
1. **Path inconsistency**:
```javascript
// Wrong
await wttpSite.PUT("/index.html", data);
const content = await wttpSite.GET("index.html");  // Missing slash!

// Right  
await wttpSite.PUT("/index.html", data);
const content = await wttpSite.GET("/index.html");  // Both have slash
```

2. **Case sensitivity**:
```javascript
// These are different files!
await wttpSite.PUT("/Image.jpg", data);      // Capital I
const content = await wttpSite.GET("/image.jpg");  // lowercase i
```

### "Invalid content type"

**Fix**: Use correct MIME types
```javascript
// Common content types
const types = {
  '.html': 'text/html',
  '.css': 'text/css', 
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};

await wttpSite.PUT("/style.css", cssData, "text/css");
```

---

## 🌐 Network Connection Issues

### "Network connection failed"

**Check your config**:
```javascript
// In hardhat.config.js
networks: {
  sepolia: {
    url: "https://sepolia.infura.io/v3/YOUR_KEY_HERE",
    accounts: [process.env.PRIVATE_KEY]
  }
}
```

**Try different endpoints**:
- Infura: `https://sepolia.infura.io/v3/YOUR_KEY`
- Alchemy: `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY`
- Public: `https://rpc.sepolia.org`

### "Nonce too low"

**Quick fix**:
```javascript
const nonce = await ethers.provider.getTransactionCount(yourAddress);
const tx = await wttpSite.PUT("/file.html", data, "text/html", { nonce });
```

---

## 💻 Setup Issues

### "Cannot find module 'hardhat'"

**Install missing packages**:
```bash
npm install --save-dev hardhat
npm install ethers
npm install dotenv
```

### "Command not found: hardhat"

**Use npx**:
```bash
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network sepolia
```

---

## 🔧 Deployment Problems

### "Contract deployment failed"

**Common fixes**:

1. **Increase gas**:
```javascript
const site = await WTTPSite.deploy({ gasLimit: 5000000 });
```

2. **Check constructor parameters**:
```javascript
const site = await WTTPSite.deploy(
  yourAddress,     // Admin address
  "My Site",       // Site name  
  "Description"    // Site description
);
```

---

## 📱 Frontend Issues

### "User rejected transaction"

**Handle gracefully**:
```javascript
try {
  const tx = await wttpSite.PUT("/file.html", data, "text/html");
  console.log("Success!");
} catch (error) {
  if (error.code === 4001) {
    console.log("User cancelled transaction");
  } else {
    console.error("Transaction failed:", error.message);
  }
}
```

---

## 🆘 Still Need Help?

### Before Asking for Help

1. **Copy the exact error message**
2. **Note what you were trying to do**
3. **Include your code snippet**

### Where to Get Help

- 💬 [Discord Community](https://discord.gg/wttp)
- 📚 [GitHub Issues](https://github.com/wttp/wttp-site/issues)
- 🔍 [Stack Overflow](https://stackoverflow.com/questions/tagged/wttp)

### What to Include

```
Problem: Can't upload files to my site
Error: "AccessControl: account is missing role"
Network: sepolia
What I tried: npx hardhat run scripts/put-file.js --network sepolia
Code: await wttpSite.PUT("/test.html", "<html>test</html>", "text/html");
Expected: File should upload successfully
Actual: Transaction fails with permission error
```

---

## 🎯 Prevention Tips

1. **Always test on testnet first**
2. **Start with small files**
3. **Double-check file paths**
4. **Keep your private key secure**
5. **Monitor gas prices**

**Remember**: Everyone runs into these issues when starting with blockchain! The community is here to help. 🤝

**Don't give up—you're learning!** 🚀 