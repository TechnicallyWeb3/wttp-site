# Static Website Example

> **🎯 Deploy a complete HTML/CSS/JavaScript website to WTTP**

**Difficulty**: Beginner | **Estimated Time**: 20 minutes

## 📋 What You'll Learn

- Deploy static files to WTTP blockchain storage
- Configure basic site permissions
- Access your site via WTTP protocol
- Understand file organization and structure

## 🔧 Prerequisites

Before starting, ensure you have completed [Blockchain Basics Setup](../../user-guide/blockchain-basics.md):

- ✅ MetaMask installed and configured
- ✅ Sepolia testnet added and funded with test ETH
- ✅ Environment variables set up (`.env` file)
- ✅ WTTP project dependencies installed

**Required Tools:**
- Node.js (v16+)
- npm or yarn
- Code editor (VS Code recommended)

## 📁 Project Structure

```
static-website/
├── README.md           # This file
├── package.json        # Dependencies and scripts
├── .env.example        # Environment variable template
├── deploy.js           # Deployment script
├── website/            # Your website files
│   ├── index.html      # Main page
│   ├── about.html      # About page
│   ├── style.css       # Stylesheet
│   ├── script.js       # JavaScript functionality
│   └── assets/         # Images and other assets
│       └── logo.png    # Example asset
└── config/
    └── site-config.js  # WTTP site configuration
```

## 🚀 Quick Start

### Step 1: Environment Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your details:**
   ```bash
   # .env
   PRIVATE_KEY=your_sepolia_private_key_here
   RPC_URL=https://sepolia.infura.io/v3/your_infura_key
   NETWORK=sepolia
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Review Website Content

Check the sample website in the `website/` directory:

- **index.html** - Homepage with navigation
- **about.html** - About page example
- **style.css** - Modern CSS styling
- **script.js** - Interactive functionality
- **assets/** - Static assets (images, etc.)

### Step 4: Deploy to WTTP

```bash
npm run deploy
```

**Expected Output:**
```bash
🚀 Deploying static website to WTTP...

✅ WTTP Site deployed successfully!
📍 Site Address: 0x1234...abcd
🌐 Site URL: wttp://0x1234...abcd
⛽ Gas Used: ~2,500,000 units
💰 Cost: FREE (testnet ETH)

📁 Files uploaded:
├── index.html (uploaded)
├── about.html (uploaded) 
├── style.css (uploaded)
├── script.js (uploaded)
└── assets/logo.png (uploaded)

🔗 Access your site: [WTTP Explorer Link]
```

### Step 5: Access Your Site

Your website is now live on the WTTP protocol! You can:

1. **View via WTTP Explorer** (link provided in deployment output)
2. **Access directly** using WTTP client tools
3. **Share the site address** with others

## 📄 File Details

### website/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My WTTP Website</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav>
        <h1>My WTTP Site</h1>
        <ul>
            <li><a href="index.html">Home</a></li>
            <li><a href="about.html">About</a></li>
        </ul>
    </nav>
    
    <main>
        <section class="hero">
            <h2>Welcome to My Decentralized Website!</h2>
            <p>This website is hosted entirely on the blockchain using WTTP.</p>
            <button onclick="showInfo()">Learn More</button>
        </section>
        
        <section class="features">
            <h3>Why WTTP?</h3>
            <div class="feature-grid">
                <div class="feature">
                    <h4>🌐 Decentralized</h4>
                    <p>No single point of failure</p>
                </div>
                <div class="feature">
                    <h4>🔒 Censorship Resistant</h4>
                    <p>Cannot be taken down</p>
                </div>
                <div class="feature">
                    <h4>♾️ Permanent</h4>
                    <p>Stored forever on blockchain</p>
                </div>
            </div>
        </section>
    </main>
    
    <footer>
        <p>Powered by WTTP Protocol</p>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>
```

### deploy.js (Template - Will be completed after Sam's fixes)
```javascript
// WTTP Static Website Deployment Script
require('dotenv').config();
const { ethers } = require('hardhat');

async function deployStaticWebsite() {
    console.log('🚀 Deploying static website to WTTP...');
    
    // Configuration
    const config = {
        siteName: "My Static Website",
        description: "A demo static website on WTTP",
        files: [
            './website/index.html',
            './website/about.html', 
            './website/style.css',
            './website/script.js',
            './website/assets/logo.png'
        ]
    };
    
    // Deployment logic will be implemented here
    // after Sam's infrastructure improvements
    
    console.log('✅ Website deployed successfully!');
}

deployStaticWebsite()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
```

## 🎨 Customization Guide

### Adding Your Own Content

1. **Replace website files** with your content:
   ```bash
   # Backup examples
   mv website website-examples
   
   # Add your files
   mkdir website
   cp your-website/* website/
   ```

2. **Update file list** in `deploy.js`:
   ```javascript
   files: [
       './website/index.html',
       './website/your-custom-file.html',
       // ... add your files
   ]
   ```

### Styling Options

The included CSS uses modern practices:
- **CSS Grid** for layouts
- **Flexbox** for components  
- **CSS Variables** for theming
- **Responsive design** for mobile

### Adding Interactivity

The `script.js` file demonstrates:
- **DOM manipulation**
- **Event handling**
- **Dynamic content**
- **WTTP-specific features**

## 🚨 Troubleshooting

### Common Issues

**❌ "Private key not found"**
```bash
# Solution: Check your .env file
cat .env | grep PRIVATE_KEY
```

**❌ "Insufficient funds"**
```bash
# Solution: Get testnet ETH from faucets
# Visit: https://sepoliafaucet.com/
```

**❌ "File too large"**
```bash
# Solution: WTTP has 32KB chunk limits
# Optimize images and minify CSS/JS
```

**❌ "Network connection failed"**
```bash
# Solution: Check RPC URL in .env
# Verify Sepolia network connectivity
```

### File Size Optimization

**Images:**
```bash
# Compress images
npm install -g imagemin-cli
imagemin website/assets/*.png --out-dir=website/assets/
```

**CSS/JS:**
```bash
# Minify CSS and JavaScript
npm install -g clean-css-cli uglify-js
cleancss -o website/style.min.css website/style.css
uglifyjs website/script.js -o website/script.min.js
```

## 📊 Cost Estimation

**Sepolia Testnet (FREE):**
- Site deployment: ~2,500,000 gas
- File uploads: ~50,000 gas per KB
- Permission changes: ~30,000 gas

**Mainnet Equivalent:**
- Total cost: ~$5-15 USD (varies by gas price)
- One-time deployment cost
- No ongoing hosting fees

## 🎓 Next Steps

**After completing this example:**

1. **Try**: [File Storage Example](../file-storage/) - Learn file management
2. **Build**: [Simple Blog](../simple-blog/) - Add content management
3. **Advanced**: [API Endpoints](../api-endpoints/) - Create dynamic APIs

## 📚 Additional Resources

- [WTTP Protocol Overview](../../user-guide/what-is-wttp.md)
- [Contract Architecture](../../user-guide/contract-architecture.md)
- [Permission Management](../../tutorials/permission-management.md)
- [Troubleshooting Guide](../../tutorials/troubleshooting.md)

---

> **💡 Pro Tip**: Start with the example website, then gradually replace files with your own content. This ensures everything works before making major changes! 