/**
 * Path normalization utilities for WTTP protocol
 * 
 * These utilities handle the soft enforcement of web semantics by normalizing
 * paths for consistent storage while preserving semantic meaning through headers.
 */

/**
 * Normalizes a path by removing trailing slashes (except root) and ensuring leading slash
 * 
 * This implements "soft semantic enforcement" where:
 * - Storage layer: Consistent, normalized paths without trailing slashes
 * - Presentation layer: Semantic trailing slashes added back for UX when needed
 * - Behavior layer: Headers determine actual functionality (directory vs file)
 * 
 * @param path - The path to normalize
 * @returns Normalized path without trailing slash (except root "/")
 * @throws Error if path is malformed (multiple consecutive slashes, etc.)
 */
export function normalizePath(path: string): string {
  // Handle empty or null paths
  if (!path || path.trim() === '') {
    return '/';
  }

  // Trim whitespace
  path = path.trim();

  // Handle root case early
  if (path === '/' || path === '') {
    return '/';
  }

  // Remove trailing slashes, but protect against malformed paths
  if (path.endsWith('/')) {
    path = path.slice(0, -1);
    
    // Check for malformed path with multiple trailing slashes
    if (path.endsWith('/') && path !== '') {
      throw new Error(`Malformed path with multiple trailing slashes: ${path}/`);
    }
  }

  // Ensure the path starts with a slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Validate no double slashes in the middle
  if (path.includes('//')) {
    throw new Error(`Malformed path with double slashes: ${path}`);
  }

  // Handle root case after processing
  if (path === '') {
    return '/';
  }

  return path;
}

/**
 * Checks if a path represents a directory based on trailing slash
 * This is used for presentation/UX purposes only
 * 
 * @param originalPath - The original path before normalization
 * @returns True if the path had a trailing slash (indicating directory intent)
 */
export function pathIndicatesDirectory(originalPath: string): boolean {
  if (!originalPath || originalPath.trim() === '') {
    return false;
  }
  
  const trimmed = originalPath.trim();
  return trimmed !== '/' && trimmed.endsWith('/');
}

/**
 * Adds trailing slash for display purposes when path represents a directory
 * Used by client tools for UX consistency
 * 
 * @param normalizedPath - The normalized path
 * @param isDirectory - Whether this path should be displayed as a directory
 * @returns Path with trailing slash added if it's a directory (except root)
 */
export function displayPath(normalizedPath: string, isDirectory: boolean): string {
  if (!isDirectory || normalizedPath === '/') {
    return normalizedPath;
  }
  
  return normalizedPath + '/';
}

/**
 * Edge case testing function - validates various path scenarios
 * Used primarily for testing to ensure normalization handles edge cases
 * 
 * @param testPath - Path to validate
 * @returns Object with validation results
 */
export function validatePathEdgeCases(testPath: string): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  try {
    const normalized = normalizePath(testPath);
    return {
      isValid: true,
      normalized
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 