# Web3 Transfer Protocol (WTTP) – LLM Context Guide

**Version:** 0.0.1  
**Package:** `@wttp/site`  
**License:** AGPL-3.0

## Project Summary

WTTP Site is the on-chain web-server component of the **Web3 Transfer Protocol**. It transforms an Ethereum smart-contract into a fully-featured HTTP-like endpoint capable of serving, updating and protecting website files directly from the blockchain. Built on top of the **Ethereum Storage Protocol (ESP)**, WTTP Site combines immutable, content-addressed storage with familiar web semantics and an economic incentive layer.

### Key Capabilities
- Serverless, censorship-resistant hosting for HTML/CSS/JS & JSON APIs
- HTTP verbs mapped to contract methods `(OPTIONS, HEAD, GET, POST, PUT, PATCH, DEFINE, DELETE)`
- Role-based access (`DEFAULT_ADMIN`, `SITE_ADMIN`, resource roles, public, blacklist)
- Fine-grained CORS + cache headers, redirects and ETags
- Immutable resources & expressive error codes (`403, 404, 405, 410, 500`)
- Gas-based royalty kick-back to original publisher via ESP `DataPointRegistry`

## Architecture

```
┌────────────────────────────┐
│      WTTPSite (HTTP)       │  ← OPTIONS / GET / PUT …
└──────────────┬─────────────┘
               │ delegates resource storage to
┌──────────────┴─────────────┐
│   WTTPStorage (Resources)  │  ← metadata, headers, datapoint arrays
└──────────────┬─────────────┘
               │ registers data points in
┌──────────────┴─────────────┐
│ ESP.DataPointRegistry (¥)  │
└──────────────┬─────────────┘
               │ gets raw content from
┌──────────────┴─────────────┐
│ ESP.DataPointStorage (╬)   │
└────────────────────────────┘
```

## Package Structure

### Main Exports (`@wttp/site`)
```typescript
// Contract types & factories (TypeChain-generated)
import {
  WTTPSite, WTTPSite__factory,
  WTTPStorage, WTTPStorage__factory,
  WTTPPermissions, WTTPPermissions__factory,
  DataPointRegistry, DataPointRegistry__factory,
  DataPointStorage, DataPointStorage__factory
} from '@wttp/site';

// All TypeScript helper types
import type {
  HeaderInfo, ResourceMetadata, OPTIONSResponse,
  HEADRequest, HEADResponse, GETRequest, GETResponse,
  Method, Range
} from '@wttp/site/types';
```

### Sub-path Exports
```typescript
// Contract ABIs and helpers
import { WTTPSiteABI, WTTPStorageABI } from '@wttp/site/contracts';

// Type-only imports
import type { WTTPSite, WTTPStorage } from '@wttp/site/types';
```

## Contract Interfaces

### WTTPSite (HTTP Layer)
```typescript
interface IWTTPSite {
  OPTIONS(path: string): Promise<OPTIONSResponse>;
  HEAD(req: HEADRequest): Promise<HEADResponse>;
  GET(req: GETRequest): Promise<GETResponse>;
  PUT(path: string, data: DataRegistration[], opts?: PayableOverrides): Promise<ContractTransaction>;
  PATCH(path: string, range: Range, data: BytesLike, opts?: PayableOverrides): Promise<ContractTransaction>;
  DELETE(path: string): Promise<ContractTransaction>;
  DEFINE(path: string, header: HeaderInfo): Promise<ContractTransaction>;
}
```

### WTTPStorage (Resource Layer)
```typescript
interface IWTTPStorage {
  calculateEtag(meta: ResourceMetadata, firstChunk: BytesLike): Promise<string>;
  _createHeader(header: HeaderInfo): Promise<string>;
  _readResource(path: string, range: Range): Promise<BytesLike>;
}
```

### WTTPPermissions (Access Layer)
```typescript
interface IWTTPPermissions {
  createResourceRole(role: BytesLike): Promise<ContractTransaction>;
  changeSiteAdmin(newHash: BytesLike): Promise<ContractTransaction>;
  hasRole(role: BytesLike, account: string): Promise<boolean>;
}
```

## Working with Deployments

WTTP Site expects the address of an already-deployed ESP `DataPointRegistry`. During construction you pass it together with an owner and a default header:

```typescript
const header: HeaderInfo = {
  cors: { methods: 0xffff, origins: Array(9).fill(PUBLIC_ROLE) },
  cache: { maxAge: 0, immutableFlag: false },
  redirect: { code: 0, location: '' }
};

const site = await new WTTPSite__factory(signer).deploy(
  ownerAddress,
  dataPointRegistryAddress,
  header
);
await site.waitForDeployment();
```

## Complete Integration Examples

### Upload a Static Page
```typescript
const html = ethers.toUtf8Bytes('<h1>Hello WTTP</h1>');
const tx = await site.PUT('/index.html', [{ data: html, publisher: signer.address }]);
await tx.wait();
```

### Read with HTTP Semantics
```typescript
const res = await site.GET({ path: '/index.html', range: { start: 0, end: html.length } });
console.log(ethers.toUtf8String(res.data));
```

### Permission Management
```typescript
const role = ethers.keccak256(ethers.toUtf8Bytes('/admin/*'));
await site.createResourceRole(role);
await site.grantRole(role, devAddress);
```

## Type-Safety Guidelines
1. Always cast factory instances to generated TypeChain types.
2. Use the `Range` struct (start & end inclusive) for partial content requests.
3. `cors.origins` **must** contain exactly nine entries – one for every permitted method.

## Common Integration Patterns
1. Detect `404 / 410` via the returned `status` on response structs.
2. Call `HEAD` before large downloads to validate `ETag` & caching headers.
3. Mark resources as immutable with `DEFINE` → subsequent writes will fail with `410`.

## Key Implementation Notes
1. Method bitmask stored in `cors.methods` enables O(1) permission checks.
2. Storage layer keeps only content hashes; bytes are stored once in ESP.
3. `DEFAULT_ADMIN_ROLE` bypasses all method & role checks for emergency recovery.
4. Error structs mirror HTTP status codes for developer familiarity.

## Quick Reference

| Function | Purpose | Payable | Success Status |
|----------|---------|---------|----------------|
| `OPTIONS` | List allowed methods | No | 204 |
| `HEAD` | Metadata only | No | 200 / 204 / 304 |
| `GET` | Read content | No | 200 / 206 |
| `PUT` | Write/replace file | Yes | 201 |
| `PATCH` | Partial update | Yes | 204 |
| `DEFINE` | Set header / immutable flag | No | 200 |
| `DELETE` | Remove file | No | 204 |

---
*For full contract documentation open `docgen/index.html` generated by Hardhat Docgen.* 