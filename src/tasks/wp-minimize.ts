import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";

interface FileUsage {
  path: string;
  usageCount: number;
  size: number;
}

interface MinimizeStats {
  totalFiles: number;
  usedFiles: number;
  unusedFiles: number;
  totalSize: number;
  usedSize: number;
  unusedSize: number;
  savings: number;
}

class WordPressMinimizer {
  private sitePath: string;
  private fileUsage: Map<string, FileUsage> = new Map();
  private htmlFiles: string[] = [];
  private cssFiles: string[] = [];
  private indexFileMap: Map<string, string> = new Map(); // Maps directory paths to index.html files

  constructor(sitePath: string) {
    this.sitePath = path.resolve(sitePath);
  }

  async analyze(): Promise<MinimizeStats> {
    console.log(`🔍 Analyzing WordPress site at: ${this.sitePath}`);
    
    // Find all files in the site
    await this.discoverFiles();
    
    // Crawl HTML files for references
    await this.crawlHtmlFiles();
    
    // Crawl CSS files for references  
    await this.crawlCssFiles();
    
    // Calculate statistics
    return this.calculateStats();
  }

  private async discoverFiles(): Promise<void> {
    const walkDir = (dir: string) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(this.sitePath, fullPath);
        
        if (file.isDirectory()) {
          walkDir(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          this.fileUsage.set(relativePath, {
            path: relativePath,
            usageCount: 0,
            size: stats.size
          });
          
          // Track HTML and CSS files for crawling
          if (file.name.endsWith('.html')) {
            this.htmlFiles.push(fullPath);
            
            // Map index.html files to their directory paths for reference matching
            if (file.name === 'index.html') {
              const dirPath = path.dirname(relativePath);
              // Map both the directory and directory with trailing slash
              if (dirPath === '.') {
                // Root index.html maps to empty path and root path
                this.indexFileMap.set('', relativePath);
                this.indexFileMap.set('.', relativePath);
              } else {
                this.indexFileMap.set(dirPath, relativePath);
                this.indexFileMap.set(dirPath + path.sep, relativePath);
              }
            }
          } else if (file.name.endsWith('.css')) {
            this.cssFiles.push(fullPath);
          }
        }
      }
    };
    
    walkDir(this.sitePath);
    console.log(`📁 Found ${this.fileUsage.size} files to analyze`);
  }

  private async crawlHtmlFiles(): Promise<void> {
    console.log(`🔍 Crawling ${this.htmlFiles.length} HTML files...`);
    
    for (const htmlFile of this.htmlFiles) {
      const content = fs.readFileSync(htmlFile, 'utf-8');
      this.findReferencesInHtml(content);
    }
  }

  private findReferencesInHtml(content: string): void {
    // Patterns to match various types of file references
    const patterns = [
      // src attributes
      /src=["']([^"']+)["']/gi,
      // href attributes  
      /href=["']([^"']+)["']/gi,
      // CSS background-image
      /background-image:\s*url\(["']?([^"')]+)["']?\)/gi,
      // CSS url() references
      /url\(["']?([^"')]+)["']?\)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1];
        this.processReference(url);
      }
    }

    // Handle srcset which can have multiple URLs
    const srcsetPattern = /srcset=["']([^"']+)["']/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetPattern.exec(content)) !== null) {
      const srcsetValue = srcsetMatch[1];
      // Parse srcset format: "url1 size1, url2 size2, ..."
      const srcsetUrls = srcsetValue.split(',').map(item => {
        // Each item is "url width" or "url density"
        const parts = item.trim().split(/\s+/);
        return parts[0]; // Return just the URL part
      }).filter(url => url && url.length > 0);
      
      srcsetUrls.forEach(url => this.processReference(url));
    }
  }

  private async crawlCssFiles(): Promise<void> {
    console.log(`🎨 Crawling ${this.cssFiles.length} CSS files...`);
    
    for (const cssFile of this.cssFiles) {
      const content = fs.readFileSync(cssFile, 'utf-8');
      this.findReferencesInCss(content);
    }
  }

  private findReferencesInCss(content: string): void {
    // CSS url() references
    const urlPattern = /url\(["']?([^"')]+)["']?\)/gi;
    let match;
    while ((match = urlPattern.exec(content)) !== null) {
      const url = match[1];
      this.processReference(url);
    }
  }

  private processReference(url: string): void {
    // Skip external URLs, data URLs, and anchors
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:') || url.startsWith('#') || url.startsWith('mailto:')) {
      return;
    }

    // Remove query parameters and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Convert to relative path from site root
    let relativePath = cleanUrl;
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }

    // Normalize path separators for Windows
    relativePath = relativePath.replace(/\//g, path.sep);

    // First try direct file match
    let usage = this.fileUsage.get(relativePath);
    if (usage) {
      usage.usageCount++;
      return;
    }

    // If no direct match, check if this might be a directory reference to an index.html
    // Remove trailing path separator if present
    const normalizedPath = relativePath.endsWith(path.sep) ? relativePath.slice(0, -1) : relativePath;
    
    // Check if this directory path maps to an index.html file
    const indexFile = this.indexFileMap.get(normalizedPath) || this.indexFileMap.get(normalizedPath + path.sep);
    if (indexFile) {
      const indexUsage = this.fileUsage.get(indexFile);
      if (indexUsage) {
        indexUsage.usageCount++;
        if (process.env.DEBUG_WP_MINIMIZE) {
          console.log(`📂 Directory reference "${url}" mapped to index file: ${indexFile}`);
        }
        return;
      }
    }

    // Debug: log missing references to understand the issue
    if (process.env.DEBUG_WP_MINIMIZE) {
      console.log(`🔍 Reference not found: "${relativePath}" (original: "${url}")`);
    }
  }

  private calculateStats(): MinimizeStats {
    let totalFiles = 0;
    let usedFiles = 0;
    let unusedFiles = 0;
    let totalSize = 0;
    let usedSize = 0;
    let unusedSize = 0;

    for (const usage of this.fileUsage.values()) {
      totalFiles++;
      totalSize += usage.size;
      
      if (usage.usageCount > 0) {
        usedFiles++;
        usedSize += usage.size;
      } else {
        unusedFiles++;
        unusedSize += usage.size;
      }
    }

    const savings = (unusedSize / totalSize) * 100;

    return {
      totalFiles,
      usedFiles,
      unusedFiles,
      totalSize,
      usedSize,
      unusedSize,
      savings
    };
  }

  getUnusedFiles(): FileUsage[] {
    return Array.from(this.fileUsage.values()).filter(usage => usage.usageCount === 0);
  }

  getUsedFiles(): FileUsage[] {
    return Array.from(this.fileUsage.values()).filter(usage => usage.usageCount > 0);
  }

  async generateWttpIgnore(): Promise<string> {
    const unusedFiles = this.getUnusedFiles();
    
    const header = [
      "# WordPress Minimizer - Generated .wttpignore",
      `# Generated on: ${new Date().toISOString()}`,
      `# Unused files: ${unusedFiles.length}`,
      `# Space savings: ${this.formatBytes(unusedFiles.reduce((sum, f) => sum + f.size, 0))}`,
      "",
      "# Unused files (safe to ignore):"
    ];

    const ignorePatterns = unusedFiles.map(file => file.path);
    
    return [...header, ...ignorePatterns].join('\n');
  }

  async deleteUnusedFiles(): Promise<void> {
    const unusedFiles = this.getUnusedFiles();
    let deletedCount = 0;
    let deletedSize = 0;

    console.log(`🗑️  Deleting ${unusedFiles.length} unused files...`);
    
    for (const file of unusedFiles) {
      const fullPath = path.join(this.sitePath, file.path);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedCount++;
          deletedSize += file.size;
        }
      } catch (error) {
        console.warn(`⚠️  Could not delete ${file.path}: ${error}`);
      }
    }

    console.log(`✅ Deleted ${deletedCount} files, saved ${this.formatBytes(deletedSize)}`);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  printReport(stats: MinimizeStats): void {
    console.log('\n📊 WordPress Site Analysis Report');
    console.log('═'.repeat(50));
    console.log(`📁 Total files: ${stats.totalFiles}`);
    console.log(`✅ Used files: ${stats.usedFiles}`);
    console.log(`❌ Unused files: ${stats.unusedFiles}`);
    console.log(`📦 Total size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`💾 Used size: ${this.formatBytes(stats.usedSize)}`);
    console.log(`🗑️  Unused size: ${this.formatBytes(stats.unusedSize)}`);
    console.log(`💰 Potential savings: ${stats.savings.toFixed(1)}%`);
    
    if (stats.unusedFiles > 0) {
      console.log('\n🔍 Top unused files by size:');
      const unusedFiles = this.getUnusedFiles()
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);
      
      for (const file of unusedFiles) {
        console.log(`   ${this.formatBytes(file.size).padStart(8)} - ${file.path}`);
      }
    }
  }
}

task("wp-minimize", "Minimize WordPress site by identifying unused files")
  .addParam("path", "Path to WordPress site directory")
  .addFlag("deleteFiles", "Delete unused files instead of creating .wttpignore")
  .addFlag("dryRun", "Show what would be done without making changes")
  .addFlag("debug", "Enable debug output to see reference processing")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { path: sitePath, deleteFiles, dryRun, debug } = taskArgs;

    if (debug) {
      process.env.DEBUG_WP_MINIMIZE = "true";
    }

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site path does not exist: ${sitePath}`);
    }

    const minimizer = new WordPressMinimizer(sitePath);
    
    try {
      // Analyze the site
      const stats = await minimizer.analyze();
      
      // Print report
      minimizer.printReport(stats);
      
      if (stats.unusedFiles === 0) {
        console.log('\n🎉 Site is already optimized! No unused files found.');
        return;
      }

      if (dryRun) {
        console.log('\n🔍 Dry run mode - no changes will be made');
        return;
      }

      if (deleteFiles) {
        // Delete unused files
        console.log('\n⚠️  WARNING: This will permanently delete unused files!');
        console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        await minimizer.deleteUnusedFiles();
        
      } else {
        // Generate .wttpignore file
        const ignoreContent = await minimizer.generateWttpIgnore();
        const ignorePath = path.join(sitePath, '.wttpignore');
        
        fs.writeFileSync(ignorePath, ignoreContent);
        console.log(`\n📝 Generated .wttpignore file: ${ignorePath}`);
        console.log('💡 Tip: Use --delete-files flag to permanently remove unused files');
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  });

export {};
