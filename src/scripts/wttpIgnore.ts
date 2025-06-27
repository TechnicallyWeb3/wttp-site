import fs from "fs";
import path from "path";

// Default ignore patterns that should always be applied
const DEFAULT_IGNORE_PATTERNS = [
  ".git/",
  ".git/**",
  ".env",
  ".env.*",
  ".DS_Store",
  "Thumbs.db",
  "*.log",
  ".npm/",
  ".yarn/",
  ".cache/",
  ".temp/",
  ".tmp/",
  "*.swp",
  "*.swo",
  "*~",
  ".vscode/",
  ".idea/",
  "*.wttpignore"
];

export interface WTTPIgnoreOptions {
  includeDefaults?: boolean;
  customPatterns?: string[];
}

export class WTTPIgnore {
  private patterns: string[] = [];
  private baseDir: string;

  constructor(baseDir: string, options: WTTPIgnoreOptions = {}) {
    this.baseDir = path.resolve(baseDir);
    
    // Always include default patterns unless explicitly disabled
    if (options.includeDefaults !== false) {
      this.patterns.push(...DEFAULT_IGNORE_PATTERNS);
    }
    
    // Add custom patterns if provided
    if (options.customPatterns) {
      this.patterns.push(...options.customPatterns);
    }
    
    // Load .wttpignore file if it exists
    this.loadIgnoreFile();
  }

  /**
   * Load patterns from .wttpignore file
   */
  private loadIgnoreFile(): void {
    const ignoreFilePath = path.join(this.baseDir, ".wttpignore");
    
    if (fs.existsSync(ignoreFilePath)) {
      try {
        const content = fs.readFileSync(ignoreFilePath, "utf-8");
        const filePatterns = this.parseIgnoreFile(content);
        this.patterns.push(...filePatterns);
        console.log(`📋 Loaded ${filePatterns.length} patterns from .wttpignore`);
      } catch (error) {
        console.warn(`⚠️ Warning: Could not read .wttpignore file: ${error}`);
      }
    }
  }

  /**
   * Parse .wttpignore file content into patterns
   */
  private parseIgnoreFile(content: string): string[] {
    return content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"))
      .map(line => {
        // Handle negation patterns (starting with !)
        if (line.startsWith("!")) {
          return line; // Keep negation as-is for now
        }
        return line;
      });
  }

  /**
   * Check if a file/directory should be ignored
   */
  public shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.baseDir, path.resolve(filePath));
    const normalizedPath = relativePath.replace(/\\/g, "/");
    
    // Don't ignore if the path goes outside the base directory
    if (normalizedPath.startsWith("../")) {
      return false;
    }

    let ignored = false;
    
    for (const pattern of this.patterns) {
      if (pattern.startsWith("!")) {
        // Negation pattern - if it matches, don't ignore
        const negatedPattern = pattern.slice(1);
        if (this.matchPattern(normalizedPath, negatedPattern)) {
          ignored = false;
        }
      } else {
        // Regular ignore pattern
        if (this.matchPattern(normalizedPath, pattern)) {
          ignored = true;
        }
      }
    }
    
    return ignored;
  }

  /**
   * Match a file path against a pattern (supports wildcards and directory patterns)
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // Handle directory patterns (ending with /)
    if (pattern.endsWith("/")) {
      const dirPattern = pattern.slice(0, -1);
      // Check if the path starts with this directory
      return filePath === dirPattern || filePath.startsWith(dirPattern + "/");
    }
    
    // Handle patterns with /**
    if (pattern.includes("/**")) {
      const basePattern = pattern.replace("/**", "");
      return filePath === basePattern || filePath.startsWith(basePattern + "/");
    }
    
    // Handle simple wildcards
    if (pattern.includes("*")) {
      const regexPattern = pattern
        .replace(/\./g, "\\.")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filePath) || regex.test(path.basename(filePath));
    }
    
    // Exact match or basename match
    return filePath === pattern || path.basename(filePath) === pattern;
  }

  /**
   * Get all patterns currently loaded
   */
  public getPatterns(): string[] {
    return [...this.patterns];
  }

  /**
   * Filter an array of file paths, removing ignored ones
   */
  public filterPaths(paths: string[]): string[] {
    return paths.filter(filePath => !this.shouldIgnore(filePath));
  }
}

/**
 * Create a WTTPIgnore instance for a directory
 */
export function createWTTPIgnore(baseDir: string, options?: WTTPIgnoreOptions): WTTPIgnore {
  return new WTTPIgnore(baseDir, options);
}

/**
 * Quick function to check if a single file should be ignored
 */
export function shouldIgnoreFile(filePath: string, baseDir: string, options?: WTTPIgnoreOptions): boolean {
  const ignore = new WTTPIgnore(baseDir, options);
  return ignore.shouldIgnore(filePath);
} 