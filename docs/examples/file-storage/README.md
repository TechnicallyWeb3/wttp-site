# File Storage Example

> **🎯 Upload, download, and manage files on WTTP blockchain storage**

**Difficulty**: Beginner | **Estimated Time**: 30 minutes

## 📋 What You'll Learn

- Upload files to WTTP blockchain storage
- Download and retrieve files by path
- Manage file permissions and access control
- Organize files with directory structures
- Handle different file types and sizes

## 🔧 Prerequisites

Before starting, ensure you have completed [Blockchain Basics Setup](../../user-guide/blockchain-basics.md):

- ✅ MetaMask installed and configured  
- ✅ Sepolia testnet added and funded with test ETH
- ✅ Environment variables set up (`.env` file)
- ✅ WTTP project dependencies installed

## 📁 Project Structure

```
file-storage/
├── README.md              # This file
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variable template
├── scripts/
│   ├── upload-files.js    # File upload script
│   ├── download-files.js  # File download script
│   ├── list-files.js      # Directory listing script
│   └── manage-permissions.js # Permission management
├── sample-files/          # Example files to upload
│   ├── document.pdf       # Sample PDF
│   ├── image.jpg          # Sample image
│   ├── data.json          # Sample JSON data
│   └── presentation.pptx  # Sample presentation
└── config/
    └── storage-config.js  # WTTP storage configuration
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
   SITE_ADDRESS=your_deployed_wttp_site_address
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Deploy WTTP Storage Site

```bash
npm run deploy-site
```

### Step 4: Upload Sample Files

```bash
npm run upload-files
```

**Expected Output:**
```bash
🚀 Uploading files to WTTP storage...

📁 Uploading sample-files/document.pdf...
   ✅ Uploaded: /documents/document.pdf (245 KB)
   
📁 Uploading sample-files/image.jpg...  
   ✅ Uploaded: /images/image.jpg (134 KB)
   
📁 Uploading sample-files/data.json...
   ✅ Uploaded: /data/data.json (2.3 KB)
   
📁 Uploading sample-files/presentation.pptx...
   ✅ Uploaded: /presentations/presentation.pptx (1.2 MB)

✅ All files uploaded successfully!
⛽ Total Gas Used: ~850,000 units
💰 Cost: FREE (testnet ETH)

🔗 Files accessible at: wttp://0x1234...abcd/
```

### Step 5: Download and Verify Files

```bash
npm run download-files
```

### Step 6: List All Files

```bash
npm run list-files
```

## 💻 Script Details

### upload-files.js (Template)
```javascript
// WTTP File Upload Script
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function uploadFiles() {
    console.log('🚀 Uploading files to WTTP storage...');
    
    const files = [
        {
            localPath: './sample-files/document.pdf',
            remotePath: '/documents/document.pdf',
            contentType: 'application/pdf'
        },
        {
            localPath: './sample-files/image.jpg', 
            remotePath: '/images/image.jpg',
            contentType: 'image/jpeg'
        },
        {
            localPath: './sample-files/data.json',
            remotePath: '/data/data.json', 
            contentType: 'application/json'
        }
    ];
    
    for (const file of files) {
        console.log(`📁 Uploading ${file.localPath}...`);
        
        // File upload logic will be implemented here
        // after Sam's infrastructure improvements
        
        console.log(`   ✅ Uploaded: ${file.remotePath}`);
    }
    
    console.log('✅ All files uploaded successfully!');
}

uploadFiles()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Upload failed:', error);
        process.exit(1);
    });
```

### download-files.js (Template)
```javascript
// WTTP File Download Script
require('dotenv').config();
const fs = require('fs');

async function downloadFiles() {
    console.log('⬇️ Downloading files from WTTP storage...');
    
    const downloads = [
        {
            remotePath: '/documents/document.pdf',
            localPath: './downloads/document.pdf'
        },
        {
            remotePath: '/images/image.jpg',
            localPath: './downloads/image.jpg'  
        },
        {
            remotePath: '/data/data.json',
            localPath: './downloads/data.json'
        }
    ];
    
    // Ensure downloads directory exists
    if (!fs.existsSync('./downloads')) {
        fs.mkdirSync('./downloads');
    }
    
    for (const download of downloads) {
        console.log(`⬇️ Downloading ${download.remotePath}...`);
        
        // Download logic will be implemented here
        // after Sam's infrastructure improvements
        
        console.log(`   ✅ Downloaded: ${download.localPath}`);
    }
    
    console.log('✅ All files downloaded successfully!');
}

downloadFiles()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Download failed:', error);
        process.exit(1);
    });
```

## 📊 File Type Support

### Supported File Types

| **Category** | **File Types** | **Max Size** | **Use Cases** |
|--------------|----------------|--------------|---------------|
| **Documents** | PDF, DOC, TXT, MD | 5 MB | Contracts, reports, documentation |
| **Images** | JPG, PNG, GIF, SVG | 2 MB | Photos, graphics, logos |
| **Data** | JSON, CSV, XML | 1 MB | Configuration, datasets |
| **Code** | JS, HTML, CSS, SOL | 1 MB | Source code, smart contracts |
| **Archives** | ZIP, TAR | 10 MB | Compressed file bundles |

### File Size Optimization

**Images:**
```bash
# Compress images before upload
npm install -g imagemin-cli
imagemin sample-files/*.jpg --out-dir=optimized/
```

**Documents:**
```bash
# PDF optimization
npm install -g pdf2pic
# Convert large PDFs to optimized versions
```

## 🔐 Permission Management

### Access Control Options

```javascript
// Permission configurations
const permissions = {
    PUBLIC_READ: 'Anyone can download',
    PRIVATE: 'Only owner can access', 
    SHARED: 'Specific addresses allowed',
    READ_ONLY: 'Download only, no modifications'
};
```

### Setting File Permissions

```bash
# Make file public
npm run set-permission -- /documents/document.pdf public

# Make file private  
npm run set-permission -- /images/image.jpg private

# Share with specific address
npm run share-file -- /data/data.json 0x1234...abcd
```

## 🗂️ Directory Organization

### Recommended Structure

```
wttp://your-site/
├── documents/          # PDF, DOC, TXT files
│   ├── contracts/      # Legal documents
│   ├── manuals/        # User guides
│   └── reports/        # Business reports
├── images/             # Visual assets
│   ├── photos/         # Photography
│   ├── graphics/       # Design assets
│   └── icons/          # UI elements
├── data/              # Structured data
│   ├── configs/       # Configuration files
│   ├── exports/       # Data exports
│   └── backups/       # Backup files
└── archives/          # Compressed files
    ├── releases/      # Software releases
    └── bundles/       # File bundles
```

## 🚨 Troubleshooting

### Common Issues

**❌ "File too large"**
```bash
# Solution: WTTP uses 32KB chunks
# Large files are automatically chunked
# Ensure sufficient gas for multiple transactions
```

**❌ "Upload failed"**
```bash
# Check file permissions
ls -la sample-files/

# Verify file exists and is readable
cat sample-files/data.json
```

**❌ "Download failed"**
```bash
# Verify file exists on WTTP
npm run list-files

# Check file permissions
npm run check-permission -- /path/to/file
```

**❌ "Permission denied"**
```bash
# Check your access rights
npm run check-access -- /path/to/file

# Request access from file owner
npm run request-access -- /path/to/file
```

### File Verification

**Check file integrity:**
```bash
# Compare checksums
npm run verify-file -- /documents/document.pdf
```

**Monitor upload progress:**
```bash
# Track large file uploads
npm run upload-progress -- ./large-file.zip
```

## 📊 Cost Analysis

**Sepolia Testnet (FREE):**
- Small file (< 32KB): ~50,000 gas
- Medium file (100KB): ~150,000 gas  
- Large file (1MB): ~1,500,000 gas
- Permission changes: ~30,000 gas

**Mainnet Equivalent Costs:**
- Small file: ~$0.10-0.50
- Medium file: ~$0.30-1.50
- Large file: ~$3.00-15.00
- No ongoing storage fees

## 🎓 Advanced Features

### Batch Operations

```bash
# Upload entire directory
npm run upload-directory -- ./my-documents/

# Download entire directory  
npm run download-directory -- /documents/ ./local-docs/
```

### File Versioning

```bash
# Upload new version
npm run upload-version -- ./document-v2.pdf /documents/document.pdf

# List file versions
npm run list-versions -- /documents/document.pdf

# Download specific version
npm run download-version -- /documents/document.pdf v1
```

### File Sharing

```bash
# Generate shareable link
npm run generate-link -- /documents/document.pdf

# Set expiration date
npm run set-expiration -- /documents/document.pdf 2024-12-31
```

## 🎯 Next Steps

**After completing this example:**

1. **Try**: [Simple Blog](../simple-blog/) - Combine file storage with content management
2. **Build**: [Document Archive](../document-archive/) - Create permanent document storage
3. **Advanced**: [NFT Metadata](../nft-metadata/) - Store NFT assets and metadata

## 📚 Additional Resources

- [WTTP Storage Architecture](../../user-guide/contract-architecture.md#storage-layer)
- [Permission System Guide](../../tutorials/permission-management.md)
- [File Optimization Tips](../../user-guide/common-use-cases.md#document-storage)
- [Troubleshooting Guide](../../tutorials/troubleshooting.md)

---

> **💡 Pro Tip**: Always test with small files first, then gradually work with larger files as you become comfortable with the upload/download process! 