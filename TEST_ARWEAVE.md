# Quick Test: Arweave External Storage

## Quick Test (5 minutes)

### Step 1: Create Test Files

```bash
# Create a small file (won't match - < 1KB)
echo "Small file" > test-small.txt

# Create a medium file (won't match - < 1MB)
# Create a 500KB file
dd if=/dev/zero of=test-medium.bin bs=1024 count=512 2>/dev/null || echo "Creating test file..."

# Create a large file (will match - > 1MB)
# Create a 2MB file
dd if=/dev/zero of=test-large.bin bs=1024 count=2048 2>/dev/null || echo "Creating test file..."
```

**Windows PowerShell:**
```powershell
# Small file
"Small file" | Out-File -FilePath test-small.txt

# Medium file (500KB)
$bytes = New-Object byte[] 512KB
[System.IO.File]::WriteAllBytes("test-medium.bin", $bytes)

# Large file (2MB)
$bytes = New-Object byte[] 2MB
[System.IO.File]::WriteAllBytes("test-large.bin", $bytes)
```

### Step 2: Create Rules File

The file `test-arweave-rules.json` is already created with:

```json
[
  {
    "minSizeBytes": 1024,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  },
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

**What this does:**
- Rule 1: Images/videos > 1KB → Arweave
- Rule 2: Any file > 1MB → Arweave

### Step 3: Generate Manifest

```bash
npx hardhat site:manifest \
  --source . \
  --externalrules ./test-arweave-rules.json
```

### Step 4: Check Results

Open `wttp.manifest.json` and look for:

**Files that match (will use Arweave):**
```json
{
  "path": "./test-large.bin",
  "type": "application/octet-stream",
  "size": 2097152,
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

**Files that don't match (will use blockchain):**
```json
{
  "path": "./test-small.txt",
  "type": "text/plain",
  "size": 10,
  "status": "pending",
  "chunks": [
    {
      "address": "0x..."
    }
  ]
}
```

## Pattern Examples

### Example 1: Images Only (Any Size)

```json
[
  {
    "provider": "arweave",
    "mimeTypes": ["image/*"],
    "extensions": [".png", ".jpg", ".jpeg", ".gif"]
  }
]
```

### Example 2: Large Files Only (Any Type)

```json
[
  {
    "minSizeBytes": 10485760,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

### Example 3: Large Images and Videos

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  }
]
```

### Example 4: Specific Extensions

```json
[
  {
    "provider": "arweave",
    "extensions": [".mp4", ".mov", ".zip", ".pdf"]
  }
]
```

## Testing Different Scenarios

### Test Size-Based Rules

```json
[
  {
    "minSizeBytes": 1024,
    "provider": "arweave",
    "mimeTypes": ["*"]
  }
]
```

Create files:
- `tiny.txt` (100 bytes) → ❌ Won't match
- `small.bin` (2KB) → ✅ Will match
- `large.bin` (5MB) → ✅ Will match

### Test Type-Based Rules

```json
[
  {
    "provider": "arweave",
    "mimeTypes": ["image/*", "video/*"]
  }
]
```

Files:
- `photo.png` → ✅ Will match (image/*)
- `video.mp4` → ✅ Will match (video/*)
- `document.pdf` → ❌ Won't match
- `script.js` → ❌ Won't match

### Test Combined Rules

```json
[
  {
    "minSizeBytes": 1048576,
    "provider": "arweave",
    "mimeTypes": ["image/*"],
    "extensions": [".png", ".jpg"]
  }
]
```

Files:
- `small.png` (500KB) → ❌ Too small
- `large.png` (2MB) → ✅ Matches all criteria
- `large.gif` (2MB) → ❌ Extension not in list
- `large.jpg` (2MB) → ✅ Matches all criteria

## Verify Your Rules

### Check File Sizes

```bash
# Linux/Mac
ls -lh test-files/

# Windows PowerShell
Get-ChildItem | Select-Object Name, @{Name="Size(KB)";Expression={[math]::Round($_.Length/1KB,2)}}
```

### Check MIME Types

The manifest will show detected MIME types:

```json
{
  "type": "image/png",  // ← This is what gets matched
  "size": 2097152
}
```

### Check Rule Matching

After generating manifest, search for:

```bash
# Find files using Arweave
grep -A 5 "externalStorage" wttp.manifest.json

# Or in PowerShell
Select-String -Path wttp.manifest.json -Pattern "externalStorage" -Context 0,5
```

## Common Patterns

### Pattern: "All large files"

```json
[{"minSizeBytes": 10485760, "provider": "arweave", "mimeTypes": ["*"]}]
```

### Pattern: "All media files"

```json
[{"provider": "arweave", "mimeTypes": ["image/*", "video/*", "audio/*"]}]
```

### Pattern: "Large media files"

```json
[{"minSizeBytes": 1048576, "provider": "arweave", "mimeTypes": ["image/*", "video/*"]}]
```

### Pattern: "Any file > 1MB OR any image/video" (OR Logic)

```json
[
  {"minSizeBytes": 1048576, "provider": "arweave", "mimeTypes": ["*"]},
  {"provider": "arweave", "mimeTypes": ["image/*", "video/*"]}
]
```

**How it works:** Rules use OR logic - if ANY rule matches, file uses Arweave.
- ✅ File > 1MB → Matches first rule
- ✅ Image/video (any size) → Matches second rule
- ❌ Small text file → No match

### Pattern: "Specific file types"

```json
[{"provider": "arweave", "extensions": [".mp4", ".mov", ".zip"]}]
```

## Next Steps

1. ✅ Test with your own files
2. ✅ Adjust rules to match your needs
3. ✅ Generate manifest
4. ⏭️ Implement Arweave upload (separate step)
5. ⏭️ Update manifest with Arweave transaction IDs
6. ⏭️ Upload redirects to WTTP site

## See Also

- [Complete Arweave Guide](./ARWEAVE_STORAGE_GUIDE.md)
- [Manifest Documentation](./MANIFEST.md)
- [External Storage Rules Example](./external-storage-rules.example.json)

