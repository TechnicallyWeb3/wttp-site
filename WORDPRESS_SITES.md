# WordPress Site Optimization Guide

This guide explains how to use the WordPress optimization tools built for the WTTP project to minimize exported WordPress sites and replace problematic forms.

## Overview

When exporting WordPress sites using plugins like Simply Static, you often end up with:
- **Bloated file counts** (1000+ files for simple sites)
- **Unused assets** (stock photos, plugin files, theme assets)
- **Broken forms** (Ninja Forms, Contact Form 7, etc.)
- **Large file sizes** (100MB+ for basic sites)

Our tools solve these problems by analyzing actual usage and creating optimized, standalone sites.

## Tools Available

The WTTP project includes three specialized tools for WordPress site optimization:

### 1. `wp-minimize` - Site Minification Tool

Analyzes WordPress exports to identify and remove unused files.

#### Usage
```bash
# Analyze and create .wttpignore file (safe)
npx hardhat wp-minimize --path ./exported-site

# Show what would be done without changes
npx hardhat wp-minimize --path ./exported-site --dry-run

# Actually delete unused files (permanent)
npx hardhat wp-minimize --path ./exported-site --delete-files

# Enable debug output
npx hardhat wp-minimize --path ./exported-site --debug
```

#### How It Works

1. **Discovery Phase**
   - Scans all files in the WordPress export
   - Identifies HTML, CSS, and media files
   - Maps directory URLs to `index.html` files (e.g., `/services/` → `services/index.html`)

2. **Analysis Phase**
   - Crawls all HTML files for references (`src`, `href`, `srcset`, CSS `url()`)
   - Parses responsive image sets correctly
   - Tracks usage count for each file
   - Handles WordPress-specific URL patterns

3. **Optimization Phase**
   - Creates `.wttpignore` file listing unused files
   - OR deletes unused files directly (with `--delete-files`)
   - Reports space savings and file reduction statistics

#### Example Results
```
📊 Analysis Results:
- Total files: 1,465
- Used files: 72 (essential assets)
- Unused files: 1,393 (95.1% reduction)
- Space saved: 98.04 MB (88.6% reduction)
```

#### What Gets Removed
- Unused stock photos from media library
- WordPress plugin assets not referenced
- Theme files not actually used
- Duplicate image sizes not needed
- Administrative and backend files

#### What Gets Preserved
- All referenced HTML pages
- Actually used images and their variants
- Essential CSS and JavaScript
- Company logos and branding assets
- All content actually displayed on the site

### 2. `wp-ninja-fix` - Form Replacement Tool

Converts broken WordPress forms (Ninja Forms, etc.) into functional HTML forms with API integration.

### 3. `wp-routes` - Route Management Tool

Handles custom route redirects and link replacements in WordPress sites using a configuration-driven approach.

#### Usage
```bash
# First, create routes.json configuration in your site directory
# Example: {"routes": {"/home/": {"redirect": "/", "method": "both"}}}

# Preview what would be changed (safe)
npx hardhat wp-routes --path ./exported-site --dry-run

# Apply route changes
npx hardhat wp-routes --path ./exported-site

# Use custom config file location
npx hardhat wp-routes --path ./exported-site --config-file ./custom-routes.json

# Skip creating backup files
npx hardhat wp-routes --path ./exported-site --no-backup

# Skip creating client-side redirect script
npx hardhat wp-routes --path ./exported-site --no-redirect
```

#### How It Works

1. **Configuration Loading**
   - Reads `routes.json` from site directory (or custom location)
   - Defines source routes, target routes, and processing methods
   - Configures backup and redirect settings

2. **Link Replacement**
   - Scans all HTML files for matching route patterns
   - Updates `href` attributes, canonical URLs, and oEmbed references
   - Creates backup files with `.backup.html` extension
   - Avoids WordPress core files and assets

3. **Client-Side Redirects**
   - Generates JavaScript file for browser-level redirects
   - Handles cases where users directly visit old URLs
   - Preserves query parameters and hash fragments
   - Acts as safety net for any missed links

#### Configuration Format (`routes.json`)

```json
{
  "routes": {
    "/home/": {
      "redirect": "/",
      "description": "Home page redirects to root",
      "method": "both"
    },
    "/old-services/": {
      "redirect": "/services/",
      "description": "Legacy services page",
      "method": "replace"
    }
  },
  "settings": {
    "backupOriginals": true,
    "updateCanonicalUrls": true,
    "updateOembedUrls": true,
    "clientSideRedirects": true,
    "preserveQueryParams": true,
    "preserveHashFragments": true
  },
  "patterns": {
    "linkAttributes": ["href"],
    "urlPatterns": [
      "href=\"{from}\"",
      "href='{from}'",
      "canonical.*{from}",
      "oembed.*{from}"
    ],
    "excludePatterns": [
      "wp-admin", "wp-content", "wp-includes",
      ".js", ".css", ".png", ".jpg", ".gif", ".svg"
    ]
  }
}
```

#### Route Methods

- **`replace`**: Only update links in HTML files
- **`redirect`**: Only create client-side redirects  
- **`both`**: Update links AND create redirects (recommended)

#### Generated Files

- **Backup Files**: `*.backup.html` (automatically added to `.wttpignore`)
- **Redirect Script**: `wp-content/themes/route-redirects.js`

#### Example Results
```
🔄 Processing routes for ./mancino
📋 Found 1 route(s) to process
📄 Found 7 HTML files to process
  ✨ contact-us\index.html: 2 link(s) updated
  ✨ services\index.html: 2 link(s) updated
  ✨ index.html: 2 link(s) updated
📜 Created client-side redirect script

📊 Processing Statistics:
   📄 Files processed: 7
   🔗 Links replaced: 14
   📜 Redirects created: 1
   💾 Backups created: 7
```

#### Usage Examples

**Basic Home Page Redirect**
```json
{
  "routes": {
    "/home/": {"redirect": "/", "method": "both"}
  }
}
```

**Multiple Route Management**
```json
{
  "routes": {
    "/home/": {"redirect": "/"},
    "/blog/": {"redirect": "/news/"},
    "/old-contact/": {"redirect": "/contact-us/"}
  }
}
```

**Link-Only Updates (No Redirects)**
```json
{
  "routes": {
    "/temp-page/": {"redirect": "/permanent/", "method": "replace"}
  },
  "settings": {"clientSideRedirects": false}
}
```

#### How It Works

1. **Form Detection**
   - Scans HTML files for Ninja Forms containers
   - Extracts form configuration from embedded JavaScript
   - Identifies field types, labels, and validation rules

2. **Backup Creation**
   - Creates `.backup.html` files before making changes
   - Ensures you can always restore original files

3. **Form Replacement**
   - Removes WordPress form markup and scripts
   - Generates clean HTML forms with proper structure
   - Adds JavaScript for API integration

#### Generated Form Structure

The tool creates forms that:
- Use semantic HTML5 form elements
- Include proper labels and accessibility attributes
- Have CSS classes for styling
- Submit to your custom API endpoint

```html
<div id="custom-form-1" class="custom-contact-form">
  <h3>Contact Me</h3>
  <form id="contact-form-1" class="contact-form" onsubmit="return submitContactForm(event, '1')">
    <div class="form-field">
      <label for="name-1">Name *</label>
      <input type="text" id="name-1" name="name" required>
    </div>
    <!-- Additional fields... -->
  </form>
</div>
```

#### API Integration

Forms submit to: `notify.mancino.ca/api/form-response?url=[url.host]&response=[formObject]`

The JavaScript automatically:
- Prevents default form submission
- Serializes form data to JSON
- Sends POST request to your API
- Shows success/error messages
- Handles loading states

## File Management

### Backup Strategy
- `wp-ninja-fix` creates `.backup.html` files automatically
- `wp-minimize` with `--delete-files` is permanent (use `--dry-run` first)
- Always test on a copy of your WordPress export

### Ignore Patterns
Both tools automatically ignore:
- Files with `backup` in the name
- `*.backup.html` files
- Hidden files and directories

## Best Practices

### 1. WordPress Export Preparation
```bash
# 1. Export your WordPress site using Simply Static or similar
# 2. Test the export works in a local server
# 3. Copy the export to a safe location for backup
cp -r wordpress-export wordpress-export-backup
```

### 2. Optimization Workflow
```bash
# 1. First, check what would be removed (dry run)
npx hardhat wp-minimize --path ./wordpress-export --dry-run

# 2. Fix forms first (creates backups)
npx hardhat wp-ninja-fix --path ./wordpress-export

# 3. Handle route redirects (if needed)
# Create routes.json configuration first, then:
npx hardhat wp-routes --path ./wordpress-export --dry-run
npx hardhat wp-routes --path ./wordpress-export

# 4. Then minimize (creates .wttpignore)
npx hardhat wp-minimize --path ./wordpress-export

# 5. Test the site works properly
# 6. If satisfied, actually delete files
npx hardhat wp-minimize --path ./wordpress-export --delete-files
```

### 3. Testing After Optimization
- Start a local server: `python -m http.server 8000`
- Navigate to `http://localhost:8000/wordpress-export`
- Test all pages and forms
- Verify images load correctly
- Check responsive image sets

## Common Issues & Solutions

### Form Not Working After Replacement
- Check browser console for JavaScript errors
- Verify API endpoint is accessible
- Ensure form field names match expected format

### Images Missing After Minification
- Run with `--debug` to see what references were found
- Check if images use absolute URLs (not caught by tool)
- Verify image paths are relative to site root

### Too Many Files Removed
- Check `.wttpignore` file before using `--delete-files`
- Some WordPress themes use dynamic CSS loading not detectable
- Add critical files back manually if needed

### Site Broken After Optimization
- Restore from backup: `cp -r wordpress-export-backup/* wordpress-export/`
- Re-run with `--dry-run` to understand what's being changed
- Exclude specific directories if needed

### Route Redirects Not Working
- Check that `routes.json` syntax is valid JSON
- Verify the redirect script was created in `wp-content/themes/`
- Ensure client-side redirects are enabled in settings
- Test with browser network tools to see redirect behavior

## Integration with WTTP

After optimization, your WordPress site is ready for WTTP deployment:

```bash
# Deploy optimized site
npx hardhat upload --site ./wordpress-export

# The forms will work with your notification API
# File sizes will be dramatically reduced
# Load times will be much faster
```

## Performance Impact

### Before Optimization
- **File Count**: 1,000+ files
- **Size**: 100+ MB
- **Load Time**: 3-5 seconds
- **Forms**: Broken (WordPress dependency)

### After Optimization
- **File Count**: 50-100 files (90%+ reduction)
- **Size**: 10-20 MB (80%+ reduction)
- **Load Time**: Under 1 second
- **Forms**: Fully functional with API integration

## Technical Details

### File Analysis Algorithm
1. **Reference Discovery**: Uses regex patterns to find all file references
2. **Path Normalization**: Converts URLs to filesystem paths
3. **Directory Mapping**: Maps directory URLs to index files
4. **Usage Tracking**: Counts references per file
5. **Responsive Images**: Handles srcset attributes correctly

### Form Parsing Logic
1. **JavaScript Extraction**: Finds Ninja Forms configuration in `<script>` tags
2. **Field Mapping**: Converts WordPress field types to HTML5 inputs
3. **Validation Rules**: Preserves required field markers
4. **API Integration**: Adds custom submission handling

## Troubleshooting

### Enable Debug Mode
```bash
npx hardhat wp-minimize --path ./site --debug
```
This shows:
- Which files are being discovered
- What references are found
- Directory-to-file mappings
- Why files are marked as unused

### Manual Review
Always review the `.wttpignore` file before permanent deletion:
```bash
# Check what would be ignored
cat ./site/.wttpignore | head -20

# Count files to be removed
wc -l ./site/.wttpignore
```

---

These tools transform bloated WordPress exports into lean, fast, functional websites ready for modern deployment.
