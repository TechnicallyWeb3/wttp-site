# WTTP Core Package - Type Accessibility Improvements

## Current Problem
TypeChain-generated types are buried in deep paths like:
```typescript
import { GETResponseStructOutput } from "@wttp/core/dist/esm/typechain-types/contracts/interfaces/IWTTPGateway";
```

This is difficult to discover and cumbersome to use.

## Recommended Solutions for @wttp/core Package

### 1. Create a Top-Level Types Export

In `@wttp/core/src/types.ts` (or `@wttp/core/types.ts`):

```typescript
// Re-export all commonly used TypeChain types
export type {
  GETResponseStructOutput,
  HEADResponseStructOutput,
  GETRequestStructOutput,
  // ... other response/request types
} from "./dist/esm/typechain-types/contracts/interfaces/IWTTPGateway";

export type {
  IWTTPGateway,
  // ... other contract interfaces
} from "./dist/esm/typechain-types";

// Optional: Create more semantic aliases
export type WTTPGetResponse = GETResponseStructOutput;
export type WTTPHeadResponse = HEADResponseStructOutput;
export type WTTPGetRequest = GETRequestStructOutput;
```

### 2. Update Package.json Main Exports

Add to `@wttp/core/package.json`:

```json
{
  "exports": {
    ".": {
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js",
      "types": "./dist/types/index.d.ts"
    },
    "./types": {
      "import": "./dist/esm/types.js",
      "require": "./dist/cjs/types.js", 
      "types": "./dist/types/types.d.ts"
    },
    "./typechain": {
      "types": "./dist/esm/typechain-types/index.d.ts"
    }
  }
}
```

### 3. Update Main Index File

In `@wttp/core/src/index.ts`:

```typescript
// Export main contracts and interfaces
export * from './typechain-types';

// Export commonly used types for convenience
export type {
  WTTPGetResponse,
  WTTPHeadResponse,
  WTTPGetRequest,
  GETResponseStructOutput,
  HEADResponseStructOutput,
  GETRequestStructOutput,
} from './types';
```

## Result: Much Cleaner Imports

After these changes, developers could use:

```typescript
// Clean, discoverable imports
import type { 
  IWTTPGateway, 
  WTTPGetResponse,
  GETResponseStructOutput 
} from "@wttp/core";

// OR for just types
import type { WTTPGetResponse } from "@wttp/core/types";

// OR for advanced users who want all typechain types
import type { SomeAdvancedType } from "@wttp/core/typechain";
```

## Implementation Steps

1. Add the types re-export file to @wttp/core
2. Update package.json exports map
3. Update main index.ts to include type exports
4. Update documentation with examples
5. Publish new version with breaking change notice (or as major version)

## Developer Experience Benefits

- **Discoverability**: Types are available at package root
- **Consistency**: Follows Node.js package export patterns
- **Flexibility**: Multiple import paths for different use cases
- **Backwards Compatibility**: Keep old paths working during transition 