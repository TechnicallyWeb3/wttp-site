# Simple Blog Example

> **🎯 Create and manage a blog with posts, comments, and content management on WTTP**

**Difficulty**: Intermediate | **Estimated Time**: 45 minutes

## 📋 What You'll Learn

- Create a complete blog system on WTTP
- Manage blog posts and content
- Implement user permissions for contributors
- Handle dynamic content and templates
- Build interactive comment systems

## 🔧 Prerequisites

Before starting, ensure you have completed:

- ✅ [Blockchain Basics Setup](../../user-guide/blockchain-basics.md)
- ✅ [Static Website Example](../static-website/) - Understanding basic deployment
- ✅ [File Storage Example](../file-storage/) - Understanding file management

**Required Knowledge:**
- Basic HTML/CSS/JavaScript
- Understanding of WTTP file structure
- Basic knowledge of content management

## 📁 Project Structure

```
simple-blog/
├── README.md              # This file
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variable template
├── scripts/
│   ├── deploy-blog.js     # Blog deployment script
│   ├── create-post.js     # New post creation
│   ├── manage-posts.js    # Post management utilities
│   └── setup-permissions.js # Permission configuration
├── templates/             # Blog templates
│   ├── index.html         # Blog homepage template
│   ├── post.html          # Individual post template
│   ├── archive.html       # Post archive template
│   └── admin.html         # Admin interface template
├── assets/               # Blog assets
│   ├── blog.css          # Blog-specific styling
│   ├── blog.js           # Blog functionality
│   └── admin.js          # Admin functionality
├── posts/                # Sample blog posts
│   ├── welcome-post.md   # Welcome post example
│   ├── wttp-guide.md     # WTTP guide post
│   └── tech-update.md    # Technology update post
└── config/
    └── blog-config.js    # Blog configuration
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
   BLOG_TITLE="My WTTP Blog"
   BLOG_DESCRIPTION="A decentralized blog powered by WTTP"
   AUTHOR_NAME="Your Name"
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Your Blog

Edit `config/blog-config.js`:
```javascript
module.exports = {
    title: process.env.BLOG_TITLE || "My WTTP Blog",
    description: process.env.BLOG_DESCRIPTION || "Decentralized blogging",
    author: process.env.AUTHOR_NAME || "Anonymous",
    postsPerPage: 5,
    enableComments: true,
    theme: "modern",
    categories: ["Technology", "Blockchain", "Web3", "Tutorials"]
};
```

### Step 4: Deploy Your Blog

```bash
npm run deploy-blog
```

**Expected Output:**
```bash
🚀 Deploying WTTP blog...

✅ Blog site deployed successfully!
📍 Blog Address: 0x1234...abcd
🌐 Blog URL: wttp://0x1234...abcd
⛽ Gas Used: ~3,200,000 units
💰 Cost: FREE (testnet ETH)

📁 Blog structure created:
├── index.html (homepage)
├── archive.html (post archive)
├── admin.html (admin interface)
├── assets/ (stylesheets and scripts)
└── posts/ (blog content)

📝 Sample posts uploaded:
├── welcome-post.md
├── wttp-guide.md  
└── tech-update.md

🔗 Access your blog: [WTTP Explorer Link]
👤 Admin panel: wttp://0x1234...abcd/admin.html
```

### Step 5: Create Your First Post

```bash
npm run create-post
```

**Interactive prompts:**
```bash
📝 Creating new blog post...

? Post title: My First WTTP Blog Post
? Post category: Technology
? Post summary: Learning to blog on the blockchain
? Author name: Your Name
? Publish immediately? Yes

✅ Post created: /posts/my-first-wttp-blog-post.md
🌐 Published at: wttp://your-blog/posts/my-first-wttp-blog-post.html
```

## 📄 Blog Structure

### Homepage Template (templates/index.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{BLOG_TITLE}} - Decentralized Blog</title>
    <link rel="stylesheet" href="assets/blog.css">
</head>
<body>
    <header class="blog-header">
        <h1>{{BLOG_TITLE}}</h1>
        <p>{{BLOG_DESCRIPTION}}</p>
        <nav>
            <a href="index.html">Home</a>
            <a href="archive.html">Archive</a>
            <a href="admin.html">Admin</a>
        </nav>
    </header>
    
    <main class="blog-content">
        <section class="recent-posts">
            <h2>Recent Posts</h2>
            {{RECENT_POSTS}}
        </section>
        
        <section class="categories">
            <h3>Categories</h3>
            {{CATEGORY_LIST}}
        </section>
    </main>
    
    <footer class="blog-footer">
        <p>Powered by WTTP Protocol | Author: {{AUTHOR_NAME}}</p>
    </footer>
    
    <script src="assets/blog.js"></script>
</body>
</html>
```

### Post Template (templates/post.html)
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{POST_TITLE}} - {{BLOG_TITLE}}</title>
    <link rel="stylesheet" href="../assets/blog.css">
</head>
<body>
    <header class="blog-header">
        <h1><a href="../index.html">{{BLOG_TITLE}}</a></h1>
        <nav>
            <a href="../index.html">Home</a>
            <a href="../archive.html">Archive</a>
        </nav>
    </header>
    
    <article class="blog-post">
        <header class="post-header">
            <h1>{{POST_TITLE}}</h1>
            <div class="post-meta">
                <span class="author">By {{POST_AUTHOR}}</span>
                <span class="date">{{POST_DATE}}</span>
                <span class="category">{{POST_CATEGORY}}</span>
            </div>
        </header>
        
        <div class="post-content">
            {{POST_CONTENT}}
        </div>
        
        <footer class="post-footer">
            <div class="tags">
                {{POST_TAGS}}
            </div>
            <div class="share">
                <button onclick="sharePost()">Share Post</button>
                <button onclick="copyLink()">Copy Link</button>
            </div>
        </footer>
    </article>
    
    <section class="comments" id="comments">
        <h3>Comments</h3>
        {{COMMENTS_SECTION}}
    </section>
    
    <script src="../assets/blog.js"></script>
</body>
</html>
```

## ✍️ Content Management

### Creating Posts

**Method 1: Using the script**
```bash
npm run create-post
```

**Method 2: Manual creation**
Create a new `.md` file in `posts/`:
```markdown
---
title: "My New Post"
date: "2024-01-15"
author: "Your Name"
category: "Technology"
tags: ["WTTP", "Blockchain", "Web3"]
summary: "A brief summary of the post"
published: true
---

# My New Post

Your post content goes here...

## Heading 2

More content with **bold** and *italic* text.

[Link to WTTP](https://wttp.example.com)

```javascript
// Code example
console.log("Hello WTTP!");
```

Your markdown content is automatically converted to HTML when deployed.
```

### Managing Posts

```bash
# List all posts
npm run list-posts

# Update existing post
npm run update-post -- "post-slug"

# Delete post
npm run delete-post -- "post-slug"

# Publish/unpublish
npm run toggle-publish -- "post-slug"
```

## 🔐 Permission Management

### Setting Up Blog Permissions

```bash
# Set up basic permissions
npm run setup-permissions
```

**Permission Roles:**
- **BLOG_ADMIN**: Full blog management access
- **BLOG_AUTHOR**: Can create and edit posts
- **BLOG_MODERATOR**: Can moderate comments
- **PUBLIC_READER**: Can read published posts

### Adding Contributors

```bash
# Add new author
npm run add-author -- 0x1234...abcd "Author Name"

# Add moderator
npm run add-moderator -- 0x5678...efgh "Moderator Name"

# Remove permissions
npm run remove-permission -- 0x1234...abcd BLOG_AUTHOR
```

## 🎨 Customization

### Themes and Styling

**Available themes:**
- `modern` - Clean, modern design
- `classic` - Traditional blog layout
- `minimal` - Minimalist approach
- `dark` - Dark mode optimized

**Switching themes:**
```bash
npm run set-theme -- modern
npm run deploy-theme
```

### Custom CSS

Edit `assets/blog.css` to customize:
```css
/* Custom blog styling */
:root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    --background-color: #ffffff;
    --text-color: #333333;
}

.blog-header {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 2rem;
    text-align: center;
}

.blog-post {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
```

## 💬 Comments System

### Enabling Comments

Comments are stored on-chain and require gas fees:

```javascript
// Comment configuration
const commentConfig = {
    enabled: true,
    moderation: true,           // Require approval
    maxLength: 500,            // Character limit
    allowAnonymous: false,     // Require wallet connection
    gasLimit: 100000          // Gas limit per comment
};
```

### Comment Management

```bash
# Approve pending comments
npm run approve-comments

# Moderate comments
npm run moderate-comments

# Delete spam comments
npm run delete-comment -- comment-id
```

## 🚨 Troubleshooting

### Common Issues

**❌ "Post creation failed"**
```bash
# Check markdown syntax
npm run validate-post -- posts/my-post.md

# Verify file permissions
ls -la posts/
```

**❌ "Template rendering failed"**
```bash
# Verify template variables
npm run check-templates

# Test template compilation
npm run test-templates
```

**❌ "Permission denied for posting"**
```bash
# Check your author permissions
npm run check-permissions

# Add yourself as author
npm run add-author -- YOUR_ADDRESS "Your Name"
```

### Content Issues

**Fixing broken links:**
```bash
# Check for broken internal links
npm run check-links

# Validate markdown content
npm run validate-content
```

**Image upload issues:**
```bash
# Optimize images before upload
npm run optimize-images -- posts/images/

# Check image file sizes
npm run check-image-sizes
```

## 📊 Analytics and Monitoring

### Blog Statistics

```bash
# View blog statistics
npm run blog-stats
```

**Example output:**
```bash
📊 Blog Statistics:

📝 Posts: 15 published, 3 drafts
👀 Views: 1,247 total (estimated)
💬 Comments: 89 approved, 12 pending
👥 Authors: 3 active contributors
📅 Last updated: 2024-01-15
⛽ Gas used (last 30 days): 450,000 units
```

### Content Performance

```bash
# Most popular posts
npm run popular-posts

# Recent activity
npm run recent-activity

# Comment activity
npm run comment-stats
```

## 📊 Cost Analysis

**Sepolia Testnet (FREE):**
- Blog deployment: ~3,200,000 gas
- New post: ~100,000 gas
- Comment: ~50,000 gas
- Permission change: ~30,000 gas

**Mainnet Equivalent Costs:**
- Blog setup: ~$8-25 USD
- New post: ~$0.25-1.00 USD
- Comment: ~$0.12-0.50 USD
- Monthly operation: ~$5-15 USD

## 🎓 Advanced Features

### RSS Feed Generation

```bash
# Generate RSS feed
npm run generate-rss

# Deploy RSS feed  
npm run deploy-rss
```

### SEO Optimization

```bash
# Generate sitemaps
npm run generate-sitemap

# Optimize meta tags
npm run optimize-seo
```

### Content Backup

```bash
# Backup all content
npm run backup-content -- ./backups/

# Restore from backup
npm run restore-content -- ./backups/blog-backup.zip
```

## 🎯 Next Steps

**After completing this example:**

1. **Try**: [API Endpoints](../api-endpoints/) - Add dynamic functionality
2. **Build**: [Document Archive](../document-archive/) - Permanent content storage  
3. **Advanced**: [NFT Metadata](../nft-metadata/) - Monetize your content

## 📚 Additional Resources

- [WTTP Content Management](../../user-guide/common-use-cases.md#blogging-platform)
- [Permission System Deep Dive](../../tutorials/permission-management.md)
- [Markdown Guide](https://www.markdownguide.org/)
- [Blog SEO Best Practices](../../user-guide/common-use-cases.md#seo-optimization)

---

> **💡 Pro Tip**: Start with a few sample posts to understand the workflow, then gradually add more advanced features like comments and multiple authors! 