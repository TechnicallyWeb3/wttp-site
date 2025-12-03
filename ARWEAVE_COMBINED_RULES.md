# Arweave Combined Rules - Quick Reference

## Your Question: "Any file > 1MB OR any image/*, video/*"

**Answer:** Yes! Use multiple rules - they work with OR logic.

## Solution

Create `arweave-combined-rules.json`:

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["*"]
  },
  {
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  }
]
```

**How it works:**
- ✅ **Rule 1:** Any file > 1MB → Arweave
- ✅ **Rule 2:** Any image or video (any size) → Arweave
- ❌ Small text files → No match → Blockchain

## Testing

```bash
npx hardhat site:manifest \
  --source ./your-site \
  --externalrules ./arweave-combined-rules.json
```

## What You'll See

Files matching **Rule 1** (large files):
```json
{
  "path": "./large-document.pdf",
  "type": "application/pdf",
  "size": 5000000,
  "externalStorage": "arweave",
  "redirect": {
    "location": "ar://[pending]"
  }
}
```

Files matching **Rule 2** (images/videos):
```json
{
  "path": "./small-image.png",
  "type": "image/png",
  "size": 50000,
  "externalStorage": "arweave",
  "redirect": {
    "location": "ar://[pending]"
  }
}
```

Files matching **neither**:
```json
{
  "path": "./script.js",
  "type": "application/javascript",
  "size": 5000,
  "chunks": [
    {"address": "0x..."}
  ]
}
```

## Rule Combination Logic

### OR Logic (Multiple Rules)
Rules are evaluated in order. **First match wins.**

```json
[
  {"condition1": "value1"},
  {"condition2": "value2"}
]
```

**Result:** File matches if condition1 OR condition2 is true.

### AND Logic (Within a Rule)
All conditions in a single rule must match.

```json
[
  {
    "minSizeBytes": 1048576,
    "mimeTypes": ["image/*"]
  }
]
```

**Result:** File must be > 1MB AND be an image.

## Common Combinations

### Pattern: "Large files OR media files"
```json
[
  {"minSizeBytes": 1048576, "mimeTypes": ["*"]},
  {"mimeTypes": ["image/*", "video/*", "audio/*"]}
]
```

### Pattern: "Large files OR specific types"
```json
[
  {"minSizeBytes": 10485760, "mimeTypes": ["*"]},
  {"mimeTypes": ["application/zip", "application/pdf"]}
]
```

### Pattern: "Large media OR all videos"
```json
[
  {"minSizeBytes": 1048576, "mimeTypes": ["image/*", "video/*"]},
  {"mimeTypes": ["video/*"]}
]
```

## Protocol Fix

✅ **Fixed:** Arweave now uses `ar://` protocol (not `arweave://`)

The manifest will show:
```json
{
  "redirect": {
    "location": "ar://[pending]"
  }
}
```

## Files Created

- ✅ `arweave-combined-rules.json` - Ready-to-use example
- ✅ Code updated to use `ar://` protocol
- ✅ Documentation updated

## Quick Test

```bash
# Use the combined rules
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --externalrules ./arweave-combined-rules.json

# Check the manifest
cat ./test-upload-demo/wttp.manifest.json | grep -A 5 "externalStorage"
```

## Summary

✅ **Can combine rules?** Yes - use multiple rules for OR logic  
✅ **Protocol fixed?** Yes - now uses `ar://` instead of `arweave://`  
✅ **Pattern supported?** Yes - "any file > 1MB OR any image/*, video/*" works!

