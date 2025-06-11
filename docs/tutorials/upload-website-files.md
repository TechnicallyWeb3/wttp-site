# Upload a Complete Website to WTTP

## From Local Files to Blockchain in 30 Minutes

Ready to put your entire website on the blockchain? This tutorial walks you through uploading a complete website with multiple pages, assets, and proper folder structure.

---

## What You'll Learn

- ✅ Upload multiple HTML, CSS, and JavaScript files
- ✅ Handle images, fonts, and other assets
- ✅ Maintain folder structure and relative links
- ✅ Optimize for gas costs
- ✅ Set up proper routing and navigation

---

## Prerequisites

- WTTP site already deployed ([Getting Started Guide](../user-guide/getting-started.md))
- Website files ready on your local machine
- Basic understanding of web development

---

## Example: Portfolio Website

Let's upload a typical portfolio website with this structure:

```
my-portfolio/
├── index.html
├── about.html
├── contact.html
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── main.js
│   └── animations.js
├── images/
│   ├── profile.jpg
│   ├── project1.png
│   └── project2.png
└── assets/
    ├── resume.pdf
    └── fonts/
        └── custom-font.woff2
```

---

## Step 1: Prepare Your Files

### Optimize for Blockchain Storage

Before uploading, optimize your files to minimize gas costs:

```bash
# Install optimization tools
npm install -g imagemin-cli
npm install -g html-minifier
npm install -g clean-css-cli

# Optimize images
imagemin my-portfolio/images/* --out-dir=my-portfolio-optimized/images/

# Minify CSS
cleancss my-portfolio/css/style.css > my-portfolio-optimized/css/style.css

# Minify HTML (optional - makes debugging harder)
html-minifier --collapse-whitespace --remove-comments my-portfolio/index.html > my-portfolio-optimized/index.html
```

### Update File Paths

Ensure all links use relative paths (WTTP handles absolute paths differently):

```html
<!-- Good: Relative paths -->
<link rel="stylesheet" href="css/style.css">
<script src="js/main.js"></script>
<img src="images/profile.jpg" alt="Profile">

<!-- Avoid: Absolute paths -->
<link rel="stylesheet" href="/css/style.css">
```

---

## Step 2: Upload Files Systematically

### Option A: Individual File Upload (Recommended for Learning)

Upload files one by one to understand the process:

```bash
# Start with your main HTML file
npx hardhat run scripts/put-file.js --network sepolia
```

**Prompts:**
```
Site address: 0x742d35Cc6523C0532...
File path: my-portfolio/index.html
Resource name: /index.html
Content type: text/html
```

**Upload CSS files:**
```bash
npx hardhat run scripts/put-file.js --network sepolia
```

**Prompts:**
```
Site address: 0x742d35Cc6523C0532...
File path: my-portfolio/css/style.css  
Resource name: /css/style.css
Content type: text/css
```

**Upload JavaScript:**
```bash
npx hardhat run scripts/put-file.js --network sepolia
```

**Prompts:**
```
Site address: 0x742d35Cc6523C0532...
File path: my-portfolio/js/main.js
Resource name: /js/main.js
Content type: application/javascript
```

**Upload images:**
```bash
npx hardhat run scripts/put-file.js --network sepolia
```

**Prompts:**
```
Site address: 0x742d35Cc6523C0532...
File path: my-portfolio/images/profile.jpg
Resource name: /images/profile.jpg
Content type: image/jpeg
```

### Option B: Batch Upload Script (Faster for Large Sites)

Create a custom upload script for efficiency:

**Create `upload-site.js`:**

```javascript
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

async function uploadSite() {
  const siteAddress = "0x742d35Cc6523C0532..."; // Your site address
  const localPath = "./my-portfolio";
  
  const WTTPSite = await ethers.getContractAt("BaseWTTPSite", siteAddress);
  
  // Get all files recursively
  const files = getAllFiles(localPath);
  
  console.log(`Found ${files.length} files to upload`);
  
  for (const file of files) {
    const relativePath = path.relative(localPath, file);
    const resourceName = "/" + relativePath.replace(/\\/g, "/");
    const contentType = mime.lookup(file) || "application/octet-stream";
    const content = fs.readFileSync(file);
    
    console.log(`Uploading: ${resourceName}`);
    
    try {
      const tx = await WTTPSite.PUT(resourceName, content, contentType);
      await tx.wait();
      console.log(`✅ Uploaded: ${resourceName}`);
    } catch (error) {
      console.error(`❌ Failed: ${resourceName}`, error.message);
    }
  }
}

function getAllFiles(dirPath) {
  let files = [];
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

uploadSite().catch(console.error);
```

**Run the batch upload:**
```bash
node upload-site.js
```

---

## Step 3: Handle Large Files

### Files Over 32KB

WTTP automatically chunks large files, but you should be aware:

```javascript
// Large images or PDFs are automatically chunked
await wttpSite.PUT("/assets/large-image.jpg", largeImageBuffer, "image/jpeg");
// WTTP handles chunking transparently
```

### Multiple File Formats

**Common content types:**
```javascript
const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};
```

---

## Step 4: Test Your Website

### Verify File Upload

```bash
# Test your main page
npx hardhat run scripts/get-file.js --network sepolia
```

**Prompts:**
```
Site address: 0x742d35Cc6523C0532...
Resource name: /index.html
```

**You should see your HTML content returned.**

### Check Assets Loading

```bash
# Verify CSS file
npx hardhat run scripts/get-file.js --network sepolia
# Resource: /css/style.css

# Verify JavaScript
npx hardhat run scripts/get-file.js --network sepolia  
# Resource: /js/main.js

# Verify images
npx hardhat run scripts/get-file.js --network sepolia
# Resource: /images/profile.jpg
```

### Test Navigation

Upload all pages and test internal links:

```html
<!-- In index.html -->
<nav>
  <a href="/about.html">About</a>
  <a href="/contact.html">Contact</a>
</nav>
```

---

## Step 5: Update and Maintain

### Update Content

Use PATCH for content updates:

```bash
# Update a single page
npx hardhat run scripts/patch-file.js --network sepolia
```

**Example: Update your about page**
```
Site address: 0x742d35Cc6523C0532...
Resource name: /about.html
New content: <updated HTML content>
```

### Add New Pages

```bash
# Add a new blog post
npx hardhat run scripts/put-file.js --network sepolia
```

```
Resource name: /blog/my-first-post.html
Content: <new blog post HTML>
```

### Version Control

WTTP maintains version history automatically:

```javascript
// Get previous version
const oldVersion = await wttpSite.GET("/index.html", { version: 1 });
const currentVersion = await wttpSite.GET("/index.html"); // Latest version
```

---

## Gas Cost Optimization

### Estimate Costs Before Upload

```javascript
// Estimate gas for file upload
const content = fs.readFileSync("index.html");
const gasEstimate = await wttpSite.estimateGas.PUT("/index.html", content, "text/html");
console.log(`Estimated gas: ${gasEstimate.toString()}`);
```

### Typical Costs (Ethereum Mainnet)

- **Small HTML file (5KB)**: ~0.02 ETH
- **CSS file (10KB)**: ~0.04 ETH  
- **JavaScript (15KB)**: ~0.06 ETH
- **Image (50KB)**: ~0.2 ETH
- **Complete small site**: ~0.5-2 ETH

### Cost-Saving Tips

1. **Optimize images**: Use WebP format, compress properly
2. **Minify code**: Remove unnecessary whitespace and comments
3. **Combine files**: Merge multiple CSS/JS files when possible
4. **Use external CDNs**: For common libraries (but reduces decentralization)
5. **Upload during low gas times**: Monitor gas prices

---

## Common Issues & Solutions

### Problem: Links Don't Work

**Issue:** Absolute paths not resolving correctly
```html
<!-- Problem -->
<link href="/css/style.css" rel="stylesheet">
```

**Solution:** Use relative paths or proper WTTP routing
```html
<!-- Solution -->
<link href="css/style.css" rel="stylesheet">
```

### Problem: Images Not Loading

**Issue:** Wrong content type or path
```javascript
// Wrong
await wttpSite.PUT("/images/photo.jpg", imageData, "text/plain");
```

**Solution:** Use correct MIME type
```javascript
// Correct
await wttpSite.PUT("/images/photo.jpg", imageData, "image/jpeg");
```

### Problem: Site Loads Slowly

**Issue:** Large files causing slow blockchain reads

**Solution:** Optimize file sizes and use progressive loading
```javascript
// Load critical CSS first
await wttpSite.PUT("/css/critical.css", criticalCSS, "text/css");
// Load non-critical CSS later
await wttpSite.PUT("/css/non-critical.css", nonCriticalCSS, "text/css");
```

---

## Advanced Techniques

### Dynamic Content Loading

```javascript
// Load content dynamically
async function loadPage(pageName) {
  const content = await wttpSite.GET(`/pages/${pageName}.html`);
  document.getElementById('content').innerHTML = content;
}
```

### Progressive Web App (PWA) Support

```javascript
// Service worker for offline support
self.addEventListener('fetch', async (event) => {
  if (event.request.url.includes('wttp://')) {
    event.respondWith(
      // Fetch from WTTP first, fallback to cache
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
```

### Integration with Build Tools

```javascript
// Webpack plugin for WTTP deployment
class WTTPDeployPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tapAsync('WTTPDeployPlugin', async (compilation, callback) => {
      // Deploy all built assets to WTTP
      await deployToWTTP(compilation.assets);
      callback();
    });
  }
}
```

---

## Next Steps

🎉 **Congratulations!** Your website is now living permanently on the blockchain.

**What's next?**

1. **[Set Up Permissions](permission-management.md)** - Control who can access your site
2. **[Custom Domain Setup](custom-domains.md)** - Use your own domain name
3. **[Performance Optimization](performance-optimization.md)** - Make your site faster
4. **[Analytics & Monitoring](analytics.md)** - Track your site's usage

**Join the Community:**
- Share your WTTP site in our [Discord](https://discord.gg/wttp)
- Add your project to our [Community Showcase](https://community.wttp.dev)
- Help others in our [Developer Forum](https://forum.wttp.dev)

**Welcome to the permanent web!** 🌐✨ 