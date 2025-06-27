# WTTP-Site CJS/ESM Compatibility Tests

This directory contains comprehensive tests to ensure that the `wttp-site` package works correctly in both CommonJS (CJS) and ES Module (ESM) environments.

## Structure

```
test-compatibility/
├── cjs-test/               # CommonJS test environment
│   ├── package.json        # CJS package configuration
│   ├── index.js            # Basic CJS import tests
│   └── test-imports.js     # Advanced CJS import tests
├── esm-test/               # ES Module test environment
│   ├── package.json        # ESM package configuration (type: "module")
│   ├── index.js            # Basic ESM import tests
│   └── test-imports.js     # Advanced ESM import tests
├── run-all-tests.js        # Test runner script
└── README.md               # This file
```

## What Gets Tested

### Basic Tests
- ✅ Main package imports (`require('wttp-site')` and `import 'wttp-site'`)
- ✅ Key export validation (fetchResource, uploadFile, deploy, etc.)
- ✅ TypeChain contract exports (if available)
- ✅ Package structure integrity

### Advanced Tests
- ✅ Destructured imports
- ✅ Subpath imports (`wttp-site/scripts/*`, `wttp-site/tasks/*`)
- ✅ Contract file imports (`wttp-site/contracts/*`)
- ✅ Dynamic import resolution (ESM only)
- ✅ Re-import stability (ESM only)
- ✅ Function type validation

## Usage

### Prerequisites
Make sure the main package is built before running tests:

```bash
# From the project root
npm run build
```

### Running Tests

#### Option 1: From Project Root (Recommended)
```bash
npm run test:compatibility
```

#### Option 2: Direct Execution
```bash
cd test-compatibility
node run-all-tests.js
```

#### Option 3: Individual Test Suites
```bash
# CommonJS tests only
cd test-compatibility/cjs-test
npm install
npm test
npm run test:imports

# ESM tests only
cd test-compatibility/esm-test
npm install
npm test
npm run test:imports
```

## Expected Output

When all tests pass, you should see:

```
🎉 ALL TESTS PASSED!
📦 wttp-site package is fully compatible with both CommonJS and ES Module environments
🔧 All subpath exports and contract imports are working correctly
```

## Common Issues & Solutions

### ❌ "dist/ directory not found"
**Solution:** Run `npm run build` from the project root to generate the build artifacts.

### ❌ "Cannot resolve module 'wttp-site'"
**Solution:** Ensure the test dependencies are installed (`npm install` in each test directory).

### ❌ Subpath import failures
**Solution:** Check that the `exports` field in the main `package.json` correctly maps all subpaths.

### ❌ TypeScript compilation errors
**Solution:** Verify that `tsconfig.build.json` has the correct module resolution settings.

## Customization

To add more tests or modify existing ones:

1. **Add new exports to test:** Update the `expectedExports` arrays in the test files
2. **Test new subpaths:** Add new test cases in the `test-imports.js` files
3. **Add new test suites:** Create new test objects in the `tests` array in `run-all-tests.js`

## Integration with CI/CD

Add this to your GitHub Actions or other CI pipeline:

```yaml
- name: Test Package Compatibility
  run: |
    npm run build
    npm run test:compatibility
```

## Technical Details

### Package Configuration
- **CJS environment:** Uses standard `package.json` without `"type": "module"`
- **ESM environment:** Uses `"type": "module"` to enable ES Module syntax
- **Build verification:** Checks for `dist/cjs`, `dist/esm`, and `dist/types` directories

### Import Patterns Tested
- `require('wttp-site')` (CJS)
- `import * as wttp from 'wttp-site'` (ESM)
- `import { fetchResource } from 'wttp-site'` (ESM destructuring)
- `const { deploy } = require('wttp-site')` (CJS destructuring)
- Subpath imports for both module systems

This testing setup ensures that your package works seamlessly across different JavaScript environments and bundlers. 