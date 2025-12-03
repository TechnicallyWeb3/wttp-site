# Arweave External Storage Guide

The WTTP manifest system supports routing large files to Arweave (or other external storage providers) based on **file size**, **MIME type**, and **file extension** patterns.

## Supported Pattern Types

### 1. **File Size Patterns**
- `minSizeBytes` - Minimum file size to match
- `maxSizeBytes` - Maximum file size to match

### 2. **MIME Type Patterns**
- `mimeTypes` - Array of MIME types (supports wildcards)
- Examples: `["image/*"]`, `["video/mp4"]`, `["*"]`

### 3. **File Extension Patterns**
- `extensions` - Array of file extensions
- Examples: `[".png", ".jpg", ".mp4"]`

### 4. **Combined Patterns**
You can combine all three for precise matching!

## Creating External Storage Rules

### Example 1: Large Images and Videos to Arweave

Create `arweave-media-rules.json`:

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["image/*", "video/*"],
    "extensions": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".webm"]
  }
]
```

**Matches:** Images and videos larger than 1MB

### Example 2: All Large Files (Any Type)

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["*"]
  }
]
```

**Matches:** Any file type larger than 10MB

### Example 3: Specific File Types Only (No Size Limit)

```json
[
  {
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["video/*", "audio/*"],
    "extensions": [".mp4", ".mov", ".mp3", ".wav", ".flac"]
  }
]
```

**Matches:** All videos and audio files regardless of size

### Example 4: Size Range (Between Min and Max)

```json
[
  {
    "minSizeBytes": 1048576,
    "maxSizeBytes": 104857600,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["*"]
  }
]
```

**Matches:** Files between 1MB and 100MB

### Example 5: OR Logic - Combine Rules

**Question:** How do I match "any file > 1MB OR any image/*, video/*"?

**Answer:** Use multiple rules! Rules use OR logic - if ANY rule matches, the file uses external storage.

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

**Behavior:**
- ✅ File > 1MB (any type) → Matches first rule → Arweave
- ✅ Image/video (any size) → Matches second rule → Arweave
- ❌ Small text file → No match → Blockchain

**Note:** Rules are evaluated in order. First match wins! This means you can prioritize rules.

### Example 6: Multiple Rules with Priority

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"],
    "extensions": [".png", ".jpg", ".mp4"]
  },
  {
    "minSizeBytes": 52428800,
    "provider": "arweave",
    "mimeTypes": ["*"]
  },
  {
    "extensions": [".pdf"],
    "minSizeBytes": 5242880,
    "provider": "ipfs",
    "redirectCode": 302
  }
]
```

**Behavior:**
1. First rule: Images/videos > 10MB → Arweave
2. Second rule: Any file > 50MB → Arweave
3. Third rule: PDFs > 5MB → IPFS

**Note:** Rules are evaluated in order. First match wins!

## Testing External Storage Rules

### Step 1: Create Test Files

Let's create some test files of different sizes and types:

```bash
# Create a small text file (should NOT use external storage)
echo "Small file" > test-small.txt

# Create a medium image (if > 1MB, will use Arweave)
# You can use any image file here

# Create a large video file (will use Arweave)
# You can use any video file > 10MB
```

### Step 2: Create Rules File

Create `arweave-test-rules.json`:

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["image/*", "video/*"]
  },
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "redirectCode": 301,
    "mimeTypes": ["*"]
  }
]
```

### Step 3: Generate Manifest with Rules

```bash
npx hardhat site:manifest \
  --source ./test-upload-demo \
  --externalrules ./arweave-test-rules.json
```

### Step 4: Check Manifest Output

Files matching external storage rules will appear like this:

```json
{
  "path": "./large-video.mp4",
  "type": "video/mp4",
  "size": 50000000,
  "externalStorage": "arweave",
  "status": "pending",
  "redirect": {
    "code": 301,
    "location": "ar://[pending]"
  },
  "chunks": []
}
```

**Note:** Arweave uses `ar://` protocol (not `arweave://`)

Files NOT matching rules will have chunks:

```json
{
  "path": "./index.html",
  "type": "text/html",
  "size": 508,
  "status": "pending",
  "chunks": [
    {
      "address": "0xc1bdf875143c2e10579f93fef09dfdf47d1a9d08a50e01460688c5f487525baa"
    }
  ]
}
```

## Complete Testing Example

### Setup Test Directory

```bash
# Create test directory
mkdir arweave-test
cd arweave-test

# Create small file (won't match)
echo "Small file" > small.txt

# Create medium file (won't match if < 1MB)
dd if=/dev/zero of=medium.bin bs=1024 count=512  # 512KB

# Create large file (will match)
dd if=/dev/zero of=large.bin bs=1024 count=10240  # 10MB

# Create image file (will match if > 1MB)
# Copy any large image here
```

### Create Rules

`arweave-rules.json`:

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  },
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

### Generate Manifest

```bash
npx hardhat site:manifest \
  --source ./arweave-test \
  --externalrules ./arweave-rules.json
```

### Expected Results

```json
{
  "siteData": {
    "files": [
      {
        "path": "./small.txt",
        "type": "text/plain",
        "size": 10,
        "status": "pending",
        "chunks": [
          {
            "address": "0x..."
          }
        ]
      },
      {
        "path": "./medium.bin",
        "type": "application/octet-stream",
        "size": 524288,
        "status": "pending",
        "chunks": [
          {
            "address": "0x..."
          }
        ]
      },
      {
        "path": "./large.bin",
        "type": "application/octet-stream",
        "size": 10485760,
        "externalStorage": "arweave",
        "status": "pending",
        "redirect": {
          "code": 301,
          "location": "arweave://[pending]"
        },
        "chunks": []
      }
    ]
  }
}
```

## Pattern Matching Logic

The system uses **AND** logic within a rule and **OR** logic across rules:

### Within a Rule (AND)
All specified conditions must match:
- If `minSizeBytes` is set → file must be >= that size
- If `maxSizeBytes` is set → file must be <= that size
- If `mimeTypes` is set → file must match one of the types
- If `extensions` is set → file must have one of the extensions

### Across Rules (OR)
First matching rule wins:

```json
[
  {
    "minSizeBytes": 1048576,
    "mimeTypes": ["image/*"]
  },
  {
    "minSizeBytes": 10485760,
    "mimeTypes": ["*"]
  }
]
```

A 5MB image matches the first rule.  
A 15MB text file matches the second rule.

## MIME Type Wildcards

### Supported Patterns

- `"image/*"` - Matches all image types (image/png, image/jpeg, etc.)
- `"video/*"` - Matches all video types
- `"audio/*"` - Matches all audio types
- `"*"` - Matches all MIME types
- `"text/html"` - Exact match

### Examples

```json
{
  "mimeTypes": ["image/*", "video/*"]
}
```

Matches:
- ✅ `image/png`
- ✅ `image/jpeg`
- ✅ `video/mp4`
- ✅ `video/webm`
- ❌ `text/html`
- ❌ `application/javascript`

## File Size Reference

Common size thresholds:

```json
{
  "1KB": 1024,
  "10KB": 10240,
  "100KB": 102400,
  "1MB": 1048576,
  "5MB": 5242880,
  "10MB": 10485760,
  "50MB": 52428800,
  "100MB": 104857600,
  "500MB": 524288000,
  "1GB": 1073741824
}
```

## Real-World Examples

### Example 1: Media-Heavy Website

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*", "audio/*"],
    "extensions": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mov", ".mp3", ".wav"]
  }
]
```

**Use case:** Blog with lots of images and videos

### Example 2: Large File Archive

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

**Use case:** File hosting service - anything > 10MB goes to Arweave

### Example 3: Selective by Type

```json
[
  {
    "provider": "arweave",
    "mimeTypes": ["video/*", "application/zip", "application/x-tar"],
    "extensions": [".mp4", ".mov", ".zip", ".tar", ".gz"]
  },
  {
    "minSizeBytes": 52428800,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

**Use case:** Videos and archives always to Arweave, other files only if > 50MB

## Integration with Upload Process

### Current Status

The manifest system **identifies** which files should use external storage, but the actual upload to Arweave is handled separately.

### Manifest Output

Files marked for external storage have:
- `externalStorage: "arweave"`
- `redirect.location: "arweave://[pending]"`
- Empty `chunks` array

### Next Steps

1. **Generate manifest** (identifies external files)
2. **Upload to Arweave** (separate process - use Arweave SDK)
3. **Update manifest** with actual Arweave transaction ID
4. **Upload redirect** to WTTP site

### Example Workflow

```typescript
// 1. Load manifest
const manifest = JSON.parse(fs.readFileSync('wttp.manifest.json', 'utf-8'));

// 2. Find files for Arweave
const arweaveFiles = manifest.siteData.files.filter(
  file => file.externalStorage === 'arweave'
);

// 3. Upload to Arweave (using Arweave SDK)
for (const file of arweaveFiles) {
  const fileData = fs.readFileSync(file.path);
  const txId = await arweaveUpload(fileData);
  
  // 4. Update manifest
  file.redirect.location = `ar://${txId}`;
  file.status = 'complete';
}

// 5. Save updated manifest
fs.writeFileSync('wttp.manifest.json', JSON.stringify(manifest, null, 2));

// 6. Upload redirects to WTTP
for (const file of arweaveFiles) {
  await uploadRedirect(file.path, file.redirect);
}
```

## Testing Checklist

- [ ] Create test files of different sizes
- [ ] Create rules file with patterns
- [ ] Generate manifest with `--externalrules`
- [ ] Verify files match expected rules
- [ ] Check manifest output format
- [ ] Test with different file types
- [ ] Test with different file sizes
- [ ] Test rule priority (order matters)

## Troubleshooting

### Files Not Matching Rules

**Check:**
1. File size meets `minSizeBytes` requirement
2. MIME type matches pattern (use `*` for wildcard)
3. File extension in `extensions` array (if specified)
4. Rule order (first match wins)

### Debug Output

Add logging to see what's being matched:

```bash
npx hardhat site:manifest \
  --source ./test \
  --externalrules ./rules.json \
  --network hardhat
```

Look for console output:
```
📦 File will use external storage: arweave
```

### Verify File Sizes

```bash
# Check file sizes
ls -lh test-files/

# Or in PowerShell
Get-ChildItem test-files/ | Select-Object Name, Length
```

## Next Steps

1. **Test with your files** - Create rules matching your use case
2. **Generate manifest** - See which files are marked for Arweave
3. **Implement Arweave upload** - Use Arweave SDK to upload files
4. **Update manifest** - Record Arweave transaction IDs
5. **Upload redirects** - Create redirects on WTTP site

## See Also

- [Manifest Documentation](./MANIFEST.md)
- [Usage Examples](./MANIFEST_EXAMPLE.md)
- [External Storage Rules Example](./external-storage-rules.example.json)

