# Understanding WTTP Smart Contracts

*How the magic happens: Breaking down WTTP's three-layer architecture*

## The Big Picture

WTTP uses a **three-layer architecture** where each layer handles a specific job. Think of it like a restaurant:

- **Permissions Layer**: The bouncer (who gets in?)
- **Storage Layer**: The kitchen (where's the food stored?)
- **Site Layer**: The waiter (how do customers interact?)

## Layer 1: BaseWTTPPermissions - "The Bouncer"

### What it does
Controls **who can do what** on your WTTP site.

### Real-world analogy
Like a bouncer at a club who checks IDs and decides who can enter, who can access VIP areas, and who gets kicked out.

### Key concepts

#### Roles (Who People Are)
```javascript
// Built-in roles:
DEFAULT_ADMIN    // Site owner - can do anything
SITE_ADMIN       // Site manager - can manage most things  
PUBLIC_ROLE      // Everyone - basic access
BLACKLIST_ROLE   // Banned users - explicitly denied access

// Custom roles (you create these):
EDITOR_ROLE      // Can edit content
VIEWER_ROLE      // Can only read content
```

#### How it works
```solidity
// Check if someone can do something:
if (hasRole(EDITOR_ROLE, userAddress)) {
    // User can edit content
} else {
    // Access denied
}
```

### Why this matters for you
- **Fine-grained control**: Give different people different permissions
- **Safety first**: DEFAULT_ADMIN can always fix broken configurations
- **Flexible**: Create custom roles for your specific needs

## Layer 2: BaseWTTPStorage - "The Kitchen"

### What it does
Manages **where your content lives** and how it's organized.

### Real-world analogy
Like a restaurant kitchen with organized storage areas, inventory management, and a system for tracking what's where.

### Key concepts

#### Content Chunking
```
Large file (100KB) → Split into chunks (32KB each)
                  ↓
[Chunk 1: 32KB] [Chunk 2: 32KB] [Chunk 3: 32KB] [Chunk 4: 4KB]
```

#### ESP Integration (Economic Storage Protocol)
```javascript
// When you store new content:
1. Content gets hashed (unique fingerprint)
2. If content already exists → you pay royalty to original publisher
3. If content is new → you become the publisher
4. Others who store same content later → pay you royalty
```

#### Metadata Management
Every piece of content has metadata:
```javascript
{
  size: "98304 bytes",           // How big is it?
  version: 3,                    // What version number?
  lastModified: "2024-01-15",    // When was it updated?
  mimeType: "text/html",         // What type of file?
  chunks: ["0x123...", "0x456..."] // Where are the pieces?
}
```

### Why this matters for you
- **Efficient storage**: Big files are broken into manageable pieces
- **Cost optimization**: Reusing content saves money for everyone
- **Versioning**: Keep track of changes over time
- **Economic incentives**: Earn money from content others reuse

## Layer 3: BaseWTTPSite - "The Waiter"

### What it does
Provides **HTTP-like methods** for interacting with your content.

### Real-world analogy
Like a waiter who takes your order, brings your food, and handles special requests - the interface between you and the kitchen.

### HTTP Methods (What You Can Do)

#### GET - Retrieve Content
```javascript
// Just like a regular web request:
const response = await site.GET({
  path: "/index.html"
});
// Returns: content data and metadata
```

#### PUT - Create/Replace Content
```javascript
// Upload new content:
await site.PUT({
  path: "/index.html",
  data: htmlContent,
  properties: { mimeType: "text/html" }
});
```

#### PATCH - Update Part of Content
```javascript
// Update specific chunks (useful for large files):
await site.PATCH({
  path: "/large-video.mp4",
  data: newChunkData,
  chunkIndex: 5  // Update the 6th chunk
});
```

#### DELETE - Remove Content
```javascript
// Remove content:
await site.DELETE({
  path: "/old-page.html"
});
```

#### HEAD - Get Metadata Only
```javascript
// Check if file exists and get info without downloading:
const metadata = await site.HEAD({
  path: "/index.html"
});
```

#### OPTIONS - Check Permissions
```javascript
// See what methods are allowed:
const allowed = await site.OPTIONS({
  path: "/admin-panel.html"
});
// Returns: which HTTP methods this user can use
```

#### DEFINE - Set Headers/Permissions
```javascript
// Configure how content behaves:
await site.DEFINE({
  path: "/api/data.json",
  headers: {
    cache: { maxAge: 3600 },
    cors: { allowOrigin: "*" },
    permissions: { readRole: PUBLIC_ROLE }
  }
});
```

### Status Codes (Just Like HTTP)
```javascript
200 // OK - everything worked
201 // Created - new content added
204 // No Content - empty response
304 // Not Modified - cached version is current
403 // Forbidden - no permission
404 // Not Found - content doesn't exist
405 // Method Not Allowed - can't use this HTTP method
```

## How the Layers Work Together

### Example: Uploading a Website

```javascript
// 1. Permissions layer checks: "Can this user upload?"
if (!hasRole(EDITOR_ROLE, userAddress)) {
  throw new Error("403 Forbidden");
}

// 2. Storage layer handles: "Where should this go?"
const chunks = splitIntoChunks(websiteFiles);
const dataPoints = await storeChunks(chunks);

// 3. Site layer responds: "Upload complete!"
return {
  status: 201,
  message: "Website uploaded successfully",
  dataPoints: dataPoints
};
```

### Example: Viewing a Website

```javascript
// 1. Site layer receives: GET /index.html
// 2. Permissions layer checks: "Can this user read?"
// 3. Storage layer fetches: content chunks
// 4. Site layer returns: assembled content
```

## Inheritance Chain

```
BaseWTTPPermissions (access control)
        ↓ extends
BaseWTTPStorage (content management)  
        ↓ extends
BaseWTTPSite (HTTP interface)
        ↓ implements
Your Custom Site (your specific features)
```

Each layer builds on the previous one, adding more functionality.

## Benefits of This Architecture

### For Developers
- **Familiar patterns**: HTTP methods you already know
- **Modular design**: Override only what you need
- **Clear separation**: Permissions ≠ Storage ≠ Interface

### For Users
- **Predictable behavior**: Works like web APIs
- **Secure by default**: Multiple layers of protection
- **Flexible permissions**: Fine-grained access control

### For the Ecosystem
- **Reusable components**: Build on proven foundations
- **Economic efficiency**: Shared storage reduces costs
- **Interoperability**: Standard interfaces across sites

## Next Steps

Now that you understand the architecture:

1. **🚀 Try it yourself**: [Deploy Your First Site](../tutorials/deploy-your-first-site.md)
2. **📁 Add content**: [Upload Website Files](../tutorials/upload-website-files.md)  
3. **🔐 Control access**: [Permission Management](../tutorials/permission-management.md)
4. **🔧 Advanced topics**: [API Reference](../api-reference/) (technical documentation)

---

**Got questions?** Check out our [Troubleshooting Guide](../tutorials/troubleshooting.md) or dive into [Common Use Cases](common-use-cases.md). 