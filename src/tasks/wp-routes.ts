import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";

interface RouteConfig {
  redirect: string;
  description?: string;
  method?: "replace" | "redirect" | "both";
}

interface RoutesConfiguration {
  routes: { [from: string]: RouteConfig };
  settings: {
    backupOriginals: boolean;
    updateCanonicalUrls: boolean;
    updateOembedUrls: boolean;
    clientSideRedirects: boolean;
    preserveQueryParams: boolean;
    preserveHashFragments: boolean;
  };
  patterns: {
    linkAttributes: string[];
    urlPatterns: string[];
    excludePatterns: string[];
  };
}

interface ProcessingStats {
  filesProcessed: number;
  linksReplaced: number;
  redirectsCreated: number;
  backupsCreated: number;
  errors: string[];
}

class WordPressRouteProcessor {
  private sitePath: string;
  private config: RoutesConfiguration;
  private dryRun: boolean;
  private backup: boolean;
  private stats: ProcessingStats;

  constructor(sitePath: string, configPath?: string, dryRun = false, backup = true) {
    this.sitePath = sitePath;
    this.dryRun = dryRun;
    this.backup = backup;
    this.stats = {
      filesProcessed: 0,
      linksReplaced: 0,
      redirectsCreated: 0,
      backupsCreated: 0,
      errors: []
    };

    // Load configuration
    const routesConfigPath = configPath || path.join(sitePath, 'routes.json');
    if (!fs.existsSync(routesConfigPath)) {
      throw new Error(`Routes configuration not found: ${routesConfigPath}`);
    }

    try {
      const configContent = fs.readFileSync(routesConfigPath, 'utf-8');
      this.config = JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Failed to parse routes configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processRoutes(): Promise<ProcessingStats> {
    console.log(`🔄 Processing routes for ${this.sitePath}`);
    console.log(`📋 Found ${Object.keys(this.config.routes).length} route(s) to process`);

    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
    }

    // Process HTML files
    await this.processHtmlFiles();

    // Create client-side redirect script if enabled
    if (this.config.settings.clientSideRedirects) {
      await this.createClientRedirectScript();
    }

    this.printStats();
    return this.stats;
  }

  private async processHtmlFiles(): Promise<void> {
    const htmlFiles = this.findHtmlFiles(this.sitePath);
    console.log(`📄 Found ${htmlFiles.length} HTML files to process`);

    for (const filePath of htmlFiles) {
      await this.processHtmlFile(filePath);
    }
  }

  private findHtmlFiles(dirPath: string): string[] {
    const htmlFiles: string[] = [];
    
    const scanDirectory = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip certain directories
          if (!this.shouldSkipDirectory(entry.name)) {
            scanDirectory(fullPath);
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    };

    scanDirectory(dirPath);
    return htmlFiles;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', '.backup', 'wp-admin'];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private async processHtmlFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      let modifiedContent = content;
      let fileChanged = false;

      // Process each route
      for (const [fromRoute, routeConfig] of Object.entries(this.config.routes)) {
        if (routeConfig.method === "redirect") {
          // Skip link replacement for redirect-only routes
          continue;
        }

        const replacements = this.findAndReplaceLinks(modifiedContent, fromRoute, routeConfig.redirect);
        modifiedContent = replacements.content;
        
        if (replacements.replacementCount > 0) {
          fileChanged = true;
          this.stats.linksReplaced += replacements.replacementCount;
          
          console.log(`  ✨ ${path.relative(this.sitePath, filePath)}: ${replacements.replacementCount} link(s) updated`);
        }
      }

      if (fileChanged) {
        this.stats.filesProcessed++;
        
        if (!this.dryRun) {
          // Create backup if enabled
          if (this.backup && this.config.settings.backupOriginals) {
            await this.createBackup(filePath, content);
          }

          // Write modified content
          fs.writeFileSync(filePath, modifiedContent, 'utf-8');
        }
      }

    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.stats.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  private findAndReplaceLinks(content: string, fromRoute: string, toRoute: string): { content: string; replacementCount: number } {
    let modifiedContent = content;
    let replacementCount = 0;

    // Generate replacement patterns based on configuration
    const patterns = this.config.patterns.urlPatterns.map(pattern => 
      pattern.replace('{from}', this.escapeRegex(fromRoute))
    );

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = modifiedContent.match(regex);
      
      if (matches) {
        modifiedContent = modifiedContent.replace(regex, (match) => {
          // Check if this match should be excluded
          if (this.shouldExcludeMatch(match)) {
            return match;
          }
          
          replacementCount++;
          return match.replace(fromRoute, toRoute);
        });
      }
    }

    return { content: modifiedContent, replacementCount };
  }

  private shouldExcludeMatch(match: string): boolean {
    return this.config.patterns.excludePatterns.some(pattern => 
      match.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async createBackup(filePath: string, content: string): Promise<void> {
    try {
      const backupPath = `${filePath}.backup.html`;
      fs.writeFileSync(backupPath, content, 'utf-8');
      this.stats.backupsCreated++;
      
      // Add to .wttpignore if it exists
      await this.addToWttpIgnore(backupPath);
    } catch (error) {
      const errorMsg = `Failed to create backup for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.stats.errors.push(errorMsg);
    }
  }

  private async addToWttpIgnore(backupPath: string): Promise<void> {
    try {
      const wttpIgnorePath = path.join(this.sitePath, '.wttpignore');
      const relativePath = path.relative(this.sitePath, backupPath);
      
      if (fs.existsSync(wttpIgnorePath)) {
        const ignoreContent = fs.readFileSync(wttpIgnorePath, 'utf-8');
        if (!ignoreContent.includes(relativePath)) {
          fs.appendFileSync(wttpIgnorePath, `\n# Route processing backup\n${relativePath}\n`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not update .wttpignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createClientRedirectScript(): Promise<void> {
    const scriptContent = this.generateRedirectScript();
    const scriptPath = path.join(this.sitePath, 'wp-content', 'themes', 'route-redirects.js');
    
    if (!this.dryRun) {
      // Ensure directory exists
      const scriptDir = path.dirname(scriptPath);
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
      }
      
      fs.writeFileSync(scriptPath, scriptContent, 'utf-8');
      this.stats.redirectsCreated = Object.keys(this.config.routes).length;
      console.log(`📜 Created client-side redirect script: ${path.relative(this.sitePath, scriptPath)}`);
    } else {
      console.log(`📜 Would create client-side redirect script: ${path.relative(this.sitePath, scriptPath)}`);
    }
  }

  private generateRedirectScript(): string {
    const routes = Object.entries(this.config.routes)
      .filter(([_, config]) => config.method !== "replace")
      .map(([from, config]) => `  '${from}': '${config.redirect}'`);

    return `/**
 * WordPress Route Redirects
 * Auto-generated by wp-routes task
 */
(function() {
  'use strict';
  
  const routes = {
${routes.join(',\n')}
  };
  
  const settings = ${JSON.stringify(this.config.settings, null, 4)};
  
  function handleRedirect() {
    const currentPath = window.location.pathname;
    const targetRoute = routes[currentPath];
    
    if (targetRoute) {
      let redirectUrl = targetRoute;
      
      // Preserve query parameters if enabled
      if (settings.preserveQueryParams && window.location.search) {
        redirectUrl += window.location.search;
      }
      
      // Preserve hash fragments if enabled
      if (settings.preserveHashFragments && window.location.hash) {
        redirectUrl += window.location.hash;
      }
      
      // Perform redirect
      if (redirectUrl !== window.location.pathname + window.location.search + window.location.hash) {
        window.location.replace(redirectUrl);
      }
    }
  }
  
  // Run redirect check immediately
  handleRedirect();
  
  // Also run on DOM content loaded for safety
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleRedirect);
  }
})();
`;
  }

  private printStats(): void {
    console.log('\n📊 Processing Statistics:');
    console.log(`   📄 Files processed: ${this.stats.filesProcessed}`);
    console.log(`   🔗 Links replaced: ${this.stats.linksReplaced}`);
    console.log(`   📜 Redirects created: ${this.stats.redirectsCreated}`);
    console.log(`   💾 Backups created: ${this.stats.backupsCreated}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      this.stats.errors.forEach(error => console.log(`   ${error}`));
    }
  }

  async dryRunAnalysis(): Promise<void> {
    console.log('\n🔍 DRY RUN ANALYSIS');
    console.log('==================');
    
    const htmlFiles = this.findHtmlFiles(this.sitePath);
    console.log(`\n📄 Would process ${htmlFiles.length} HTML files:`);
    
    let totalLinks = 0;
    
    for (const filePath of htmlFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        let fileLinks = 0;
        
        for (const [fromRoute, routeConfig] of Object.entries(this.config.routes)) {
          if (routeConfig.method === "redirect") continue;
          
          const replacements = this.findAndReplaceLinks(content, fromRoute, routeConfig.redirect);
          fileLinks += replacements.replacementCount;
        }
        
        if (fileLinks > 0) {
          console.log(`   ✨ ${path.relative(this.sitePath, filePath)}: ${fileLinks} link(s) would be updated`);
          totalLinks += fileLinks;
        }
      } catch (error) {
        console.log(`   ❌ ${path.relative(this.sitePath, filePath)}: Error reading file`);
      }
    }
    
    console.log(`\n📋 Summary:`);
    console.log(`   🔗 Total links that would be replaced: ${totalLinks}`);
    console.log(`   📜 Client-side redirects that would be created: ${Object.keys(this.config.routes).length}`);
    
    if (this.config.settings.backupOriginals) {
      console.log(`   💾 Backup files that would be created: ${totalLinks > 0 ? htmlFiles.filter(f => {
        const content = fs.readFileSync(f, 'utf-8');
        return Object.entries(this.config.routes).some(([from, config]) => {
          if (config.method === "redirect") return false;
          return this.findAndReplaceLinks(content, from, config.redirect).replacementCount > 0;
        });
      }).length : 0}`);
    }
  }
}

task("wp-routes", "Process WordPress site routes using routes.json configuration")
  .addParam("path", "Path to WordPress site directory")
  .addOptionalParam("configFile", "Path to routes.json configuration file (defaults to {path}/routes.json)")
  .addFlag("dryRun", "Show what would be done without making changes")
  .addFlag("noBackup", "Skip creating backup files")
  .addFlag("noRedirect", "Skip creating client-side redirect script")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { path: sitePath, configFile, dryRun, noBackup, noRedirect } = taskArgs;

    if (!fs.existsSync(sitePath)) {
      throw new Error(`Site path does not exist: ${sitePath}`);
    }

    try {
      const processor = new WordPressRouteProcessor(
        sitePath, 
        configFile, 
        dryRun, 
        !noBackup
      );

      // Temporarily disable client redirects if requested
      if (noRedirect) {
        const routesConfigPath = configFile || path.join(sitePath, 'routes.json');
        const configContent = JSON.parse(fs.readFileSync(routesConfigPath, 'utf-8'));
        configContent.settings.clientSideRedirects = false;
        processor['config'] = configContent;
      }
      
      if (dryRun) {
        await processor.dryRunAnalysis();
        return;
      }

      const stats = await processor.processRoutes();
      
      if (stats.filesProcessed === 0 && stats.redirectsCreated === 0) {
        console.log('\n✅ No changes needed - all routes are already correct!');
      } else {
        console.log('\n✅ Route processing completed successfully!');
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
      throw error;
    }
  });

export {};
