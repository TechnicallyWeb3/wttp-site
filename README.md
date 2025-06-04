# WTTP Site

WTTP Website or "Web3Site" contracts to enable HTTP-like communication using the blockchain.

This project implements the WTTP protocol for decentralized web hosting on blockchain networks.

## Quick Start

```shell
npx hardhat help
npx hardhat test
npx hardhat compile
```

## Testing

This project includes a comprehensive test suite covering all aspects of the WTTP protocol implementation with **92 passing and 12 failing tests (88.5% success rate)**.

### Test Files Overview

The tests are organized with numbered filenames to ensure ordered execution:

1. **`test/01-permissions.test.ts`** - Tests for `WTTPPermissions` role-based access control ✅ **25/25 passing**
2. **`test/02-storage.test.ts`** - Tests for `WTTPStorage` functionality using Web3Site ✅ **13/13 passing**
3. **`test/03-site.test.ts`** - Original comprehensive WTTP site tests ✅ **14/14 passing** 
4. **`test/04-web3site.test.ts`** - Tests for Web3Site implementation ⚠️ **9/13 passing**
5. **`test/05-ignition.test.ts`** - Tests for Ignition deployment modules ⚠️ **14/16 passing**
6. **`test/06-tasks.test.ts`** - Tests for Hardhat tasks ⚠️ **13/16 passing**
7. **`test/07-scripts.test.ts`** - Tests for scripts and utilities ⚠️ **16/19 passing**

### Test Contracts

Special test contracts are provided to expose abstract contract functionality:

- **`contracts/test/TestWTTPPermissions.sol`** - Exposes `WTTPPermissions` internal methods
- **`contracts/test/TestWTTPStorage.sol`** - Exposes `WTTPStorage` internal methods  
- **`contracts/test/Web3Site.sol`** - Concrete implementation for testing

**Note**: Tests use `@tw3/esp` package factories (`DataPointStorage__factory`, `DataPointRegistry__factory`) for proper ESP contract integration rather than trying to deploy ESP contracts directly.

### Known Issues

The remaining 12 failing tests involve:
- Complex method permission bit mapping logic
- Error handling edge cases 
- File path normalization
- Gas estimation edge cases

These require deeper investigation into the contract permission logic and are noted for future improvement.

### Running Tests

```shell
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/01-permissions.test.ts

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run tests on specific network
npx hardhat test --network localhost
```

### Test Coverage

The test suite covers:
- **Permissions**: Role management, access control, site admin functionality
- **Storage**: Header management, resource CRUD operations, metadata handling
- **Protocol**: HTTP-like methods (GET, PUT, POST, DELETE, etc.)
- **Integration**: ESP contract integration, data point management
- **Deployment**: Ignition modules, task validation, script execution
- **Edge Cases**: Error handling, permission enforcement, immutable resources

## Deployment Commands

### Single Chain Deployment

Deploy a Web3Site contract to a single network:

```shell
# Basic deployment with auto-funding
npx hardhat deploy:site --auto-fund --network sepolia

# Custom DPR and owner
npx hardhat deploy:site --dpr 0x123... --owner 0x456... --network polygon

# Custom cache settings
npx hardhat deploy:site --max-age 7200 --auto-fund --network mainnet

# Skip verification
npx hardhat deploy:site --skip-verify --network localhost
```

**Parameters:**
- `--dpr` - DataPointRegistry contract address (optional, defaults to @tw3/esp address)
- `--owner` - Site owner address (optional, defaults to signer[1] or deployer)
- `--max-age` - Cache max age in seconds (optional, defaults to 3600)
- `--auto-fund` - Automatically fund deployer from owner if needed
- `--skip-verify` - Skip contract verification on block explorer

### Multi-Chain Deployment

Deploy Web3Site contracts across multiple chains with vanity addresses:

```shell
# Deploy to multiple testnets
npx hardhat deploy:multichain --chains "11155111,80002" --network sepolia

# Deploy to mainnets with custom DPR addresses
npx hardhat deploy:multichain \
  --chains "1,137" \
  --dpr-addresses '{"1":"0x123...","137":"0x456..."}' \
  --network mainnet

# Custom cache settings across chains
npx hardhat deploy:multichain \
  --chains "11155111,80002,84532" \
  --max-age 7200 \
  --skip-verify \
  --network sepolia
```

**Parameters:**
- `--chains` - Comma-separated list of chain IDs (required)
- `--dpr-addresses` - JSON object with DPR addresses per chain (optional)
- `--max-age` - Cache max age in seconds (optional, defaults to 3600)
- `--skip-verify` - Skip contract verification on block explorer

### Contract Verification

Verify a deployed Web3Site contract:

```shell
npx hardhat deploy:verify \
  --address 0x123... \
  --dpr 0x456... \
  --owner 0x789... \
  --network sepolia

# With custom cache settings
npx hardhat deploy:verify \
  --address 0x123... \
  --dpr 0x456... \
  --owner 0x789... \
  --max-age 7200 \
  --network mainnet
```

**Parameters:**
- `--address` - Web3Site contract address (required)
- `--dpr` - DPR address used in constructor (required)
- `--owner` - Owner address used in constructor (required)
- `--max-age` - Cache max age used in constructor (optional, defaults to 3600)

## File Management Commands

### Upload Files

Upload individual files to a deployed Web3Site:

```shell
npx hardhat upload \
  --site 0x123... \
  --source ./index.html \
  --destination /index.html \
  --network sepolia
```

### Fetch Resources

Fetch resources from a deployed Web3Site:

```shell
npx hardhat fetch \
  --wttp 0x456... \
  --site 0x123... \
  --path /index.html \
  --network sepolia

# HEAD request only
npx hardhat fetch \
  --wttp 0x456... \
  --site 0x123... \
  --path /index.html \
  --head \
  --network sepolia

# With byte range
npx hardhat fetch \
  --wttp 0x456... \
  --site 0x123... \
  --path /style.css \
  --range "0-1023" \
  --network sepolia
```

## Network Configuration

Make sure your `hardhat.config.ts` includes the networks you want to deploy to:

```typescript
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
    chainId: 11155111
  },
  polygon: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
    chainId: 137
  }
}
```

## Requirements

- Node.js 18+
- At least 2 signers per network (deployer + owner)
- Sufficient ETH for deployment costs
- DPR contracts deployed (via @tw3/esp or custom)

## License

AGPL-3.0
