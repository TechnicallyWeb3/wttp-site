/**
 * Path normalization utilities for WTTP protocol
 * 
 * These utilities handle the soft enforcement of web semantics by normalizing
 * paths for consistent storage while preserving semantic meaning through headers.
 */

/**
 * Normalizes a path by ensuring leading slash and handling trailing slashes based on directory status
 * 
 * This implements "soft semantic enforcement" where:
 * - Storage layer: Consistent, normalized paths with trailing slashes for directories
 * - Presentation layer: Semantic trailing slashes preserved for directories
 * - Behavior layer: Headers determine actual functionality (directory vs file)
 * 
 * @param path - The path to normalize
 * @param isDirectory - Optional flag indicating if the path represents a directory
 * @returns Normalized path with trailing slash for directories (including root "/")
 * @throws Error if path is malformed (multiple consecutive slashes, etc.)
 */
export function normalizePath(path: string, isDirectory?: boolean): string {
  // Trim whitespace
  path = path.trim();

  // Handle empty paths or root paths
  if (path === '' || path === '/') {
    return '/';
  }

  if (pathIndicatesRelative(path)) {
    throw new Error(`Path should be absolute: ${path}`);
  }

  // Validate no double slashes in the middle
  if (path.includes('//')) {
    throw new Error(`Malformed path with double slashes: ${path}`);
  }

  // All paths except relative paths must start with a slash
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  if (isDirectory === undefined) {
    isDirectory = pathIndicatesDirectory(path);
  }

  // Add trailing slash for directories, remove trailing slash for files
  if (isDirectory) {
    path = !path.endsWith('/') ? path + '/' : path;
  } else {
    path = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
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
  return trimmed.endsWith('/');
}

export function pathIndicatesRelative(originalPath: string): boolean {
  if (!originalPath || originalPath.trim() === '') {
    return false;
  }
  return originalPath.startsWith('.') && originalPath.includes('./') || originalPath === '.';
}

/**
 * Adds trailing slash for display purposes when path represents a directory
 * Used by client tools for UX consistency
 * 
 * @param normalizedPath - The normalized path
 * @param isDirectory - Whether this path should be displayed as a directory
 * @returns Path with trailing slash added if it's a directory
 */
export function displayPath(normalizedPath: string, isDirectory: boolean = false): string {
  // Since normalizePath now handles directories correctly, we can just use it
  return normalizePath(normalizedPath, isDirectory);
}

/**
 * Edge case testing function - validates various path scenarios
 * Used primarily for testing to ensure normalization handles edge cases
 * 
 * @param testPath - Path to validate
 * @returns Object with validation results
 */
export function validatePathEdgeCases(testPath: string, isDirectory: boolean = false): {
  isValid: boolean;
  indicatesDirectory?: boolean;
  normalized?: string;
  error?: string;
} {
  try {
    const normalized = normalizePath(testPath, isDirectory);
    return {
      isValid: true,
      normalized
    };
  } catch (error) {
    return {
      isValid: false,
      indicatesDirectory: pathIndicatesDirectory(testPath),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 