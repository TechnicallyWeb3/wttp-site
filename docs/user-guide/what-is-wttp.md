<!--
© 2025 TechnicallyWeb3 – Licensed under AGPL-3.0
-->

# WTTP: Your Website on the Blockchain

*Finally, a way to host websites that can't be censored, taken down, or controlled by anyone but you.*

## What is WTTP? (In Simple Terms)

**WTTP (Web3 Transfer Protocol)** is like having your own web server, but instead of renting space from hosting companies, your website lives directly on the blockchain.

### Think of it like this:
- **Traditional hosting**: Your website files sit on someone else's computer (server)
- **WTTP hosting**: Your website files are stored directly on the blockchain, accessible forever

## What WTTP Does for You

### 🌐 HTTP-like Functionality
- Use familiar web methods: `GET`, `PUT`, `POST`, `DELETE`
- Upload files just like you would to any web server
- Fetch content using standard HTTP-style requests
- Set up APIs and endpoints that work like regular web services

### 🛡️ True Ownership
- **No hosting bills**: Pay once to store, access forever
- **No takedowns**: Nobody can remove your content
- **No platform risk**: Your site exists as long as the blockchain does
- **Full control**: You decide who can access what

### 💰 Economic Incentives
- **Earn from your content**: Get paid when others reference your data
- **Shared storage costs**: Reusing content is cheaper for everyone
- **Publisher royalties**: Original creators earn from content reuse

## Why This Matters

### For Web Developers
```javascript
// Instead of this (traditional hosting):
fetch('https://mysite.com/api/data')

// You can do this (WTTP):
fetch('wttp://mysite.eth/api/data')
```

### For Content Creators
- **Permanent archives**: Your content never disappears
- **Revenue streams**: Earn from content that gets referenced
- **Global distribution**: Accessible from anywhere with blockchain access

### For Users
- **Censorship resistance**: Important information can't be silenced
- **Always available**: No server downtime or maintenance windows
- **Verifiable content**: Cryptographically guaranteed data integrity

## How It Works (Simplified)

### 1. Your Content → Blockchain Storage
```
Your HTML/CSS/JS files → Chunked into 32KB pieces → Stored on blockchain
```

### 2. Smart Contract = Your Web Server
```
Smart Contract handles:
├── GET requests (serve content)
├── PUT requests (upload new content)
├── Permission management (who can access what)
└── HTTP-like responses (status codes, headers, etc.)
```

### 3. Economic Model
```
First time storing content: You pay
Someone else stores same content: They pay you ~0.1% royalty
After ~1100 reuses: Original storage cost recovered
```

## Real-World Examples

### Static Website
Perfect for:
- Personal blogs
- Portfolio sites
- Documentation sites
- Landing pages

### Decentralized APIs
Build APIs that:
- Can't be rate-limited by platforms
- Have guaranteed uptime
- Are owned entirely by you

### Content Archives
Store:
- Important documents
- Research papers
- Historical records
- Creative works

## Getting Started Roadmap

1. **📖 Learn the basics** ← *You are here*
2. **🏗️ Understand the architecture** → [Contract Architecture Guide](contract-architecture.md)
3. **🚀 Deploy your first site** → [Getting Started Tutorial](../tutorials/deploy-your-first-site.md)
4. **📁 Upload content** → [Upload Files Tutorial](../tutorials/upload-website-files.md)
5. **🔐 Set permissions** → [Permission Management](../tutorials/permission-management.md)

## Common Questions

### "Is this like IPFS?"
WTTP focuses on HTTP-like functionality with economic incentives, while IPFS is primarily about distributed file storage. WTTP gives you a blockchain-based web server with familiar web development patterns.

### "How much does it cost?"
You pay gas fees for storage and transactions. The economic model means frequently accessed content becomes profitable for original publishers.

### "Can I use my existing web development skills?"
Absolutely! WTTP uses HTTP-like methods and familiar patterns. If you know how to make API calls, you can work with WTTP.

### "What about performance?"
Initial storage requires blockchain transactions, but retrieval can be optimized through gateways and caching. Best for content that doesn't need instant updates.

---

**Ready to dive deeper?** Continue with [Understanding WTTP Smart Contracts](contract-architecture.md) to learn how the technical pieces fit together. 