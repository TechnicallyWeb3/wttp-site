# WTTP Permission Management

## Control Who Can Access Your Site

WTTP uses a powerful role-based permission system that gives you fine-grained control over who can read, write, or manage your content. Think of it as "user accounts for your blockchain website."

---

## Understanding WTTP Permissions

### The Role-Based System

WTTP permissions work like a bouncer at a club—everyone gets checked against a list:

```
DEFAULT_ADMIN → Can do everything (that's you!)
    ↓
SITE_ADMIN → Can manage the site and users
    ↓  
CONTENT_EDITOR → Can read/write content
    ↓
PUBLIC_ROLE → Can read public content
    ↓
BLACKLIST_ROLE → Cannot access anything
```

### Key Concepts

- **Roles**: Labels that define what someone can do
- **Permissions**: Specific actions (read, write, admin)
- **Addresses**: Ethereum addresses that get assigned roles
- **Resources**: Individual files or folders

---

## Default Permission Setup

When you deploy a WTTP site, you automatically get:

```javascript
// You are the DEFAULT_ADMIN
const yourAddress = "0x742d35Cc6523C0532...";

// You can:
await wttpSite.PUT("/file.html", content);      // ✅ Create
await wttpSite.GET("/file.html");               // ✅ Read  
await wttpSite.PATCH("/file.html", update);     // ✅ Update
await wttpSite.DELETE("/file.html");            // ✅ Delete
await wttpSite.grantRole(ROLE, address);        // ✅ Manage users
```

**Everyone else**: Can't access anything by default (private site).

---

## Common Permission Scenarios

### Scenario 1: Public Website (Anyone Can Read)

**Goal**: Make your site readable by everyone, but only you can edit.

```bash
# Make site publicly readable
npx hardhat run scripts/set-permissions.js --network sepolia
```

**Script prompts:**
```
Site address: 0x742d35Cc6523C0532...
Action: grant-public-read
Resource: * (all files)
```

**What this does:**
```javascript
// Behind the scenes
await wttpSite.grantRole(PUBLIC_ROLE, ethers.constants.AddressZero);
// AddressZero = "everyone"
```

**Result**: 
- ✅ Anyone can read your site
- ❌ Only you can write/edit
- ✅ Perfect for blogs, portfolios, documentation

### Scenario 2: Private Blog with Multiple Authors

**Goal**: You + 2 friends can write blog posts, everyone else can read.

```bash
# Add your friends as editors
npx hardhat run scripts/manage-users.js --network sepolia
```

**Add first friend:**
```
Site address: 0x742d35Cc6523C0532...
Action: grant-role
Role: CONTENT_EDITOR
Address: 0x1234567890123456789012345678901234567890
```

**Add second friend:**
```
Action: grant-role
Role: CONTENT_EDITOR  
Address: 0x0987654321098765432109876543210987654321
```

**Make public readable:**
```
Action: grant-public-read
Resource: *
```

**Result**:
- ✅ You + 2 friends can write
- ✅ Everyone can read
- ✅ Perfect for collaborative blogs

### Scenario 3: Premium Content Site

**Goal**: Free articles for everyone, premium articles for subscribers only.

```bash
# Set up premium subscriber role
npx hardhat run scripts/create-role.js --network sepolia
```

**Create premium role:**
```
Site address: 0x742d35Cc6523C0532...
Role name: PREMIUM_SUBSCRIBER
```

**Set permissions:**
```javascript
// Free content - anyone can read
await wttpSite.setResourcePermission("/free/", PUBLIC_ROLE, "read");

// Premium content - subscribers only
await wttpSite.setResourcePermission("/premium/", PREMIUM_SUBSCRIBER, "read");
```

**Add premium subscribers:**
```bash
# Add paying customers
npx hardhat run scripts/manage-users.js --network sepolia
```

```
Action: grant-role
Role: PREMIUM_SUBSCRIBER
Address: 0x1111111111111111111111111111111111111111
```

### Scenario 4: Organization with Department Access

**Goal**: HR can access HR files, Engineering can access Engineering files.

```javascript
// Create department roles
const HR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("HR_ROLE"));
const ENG_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ENG_ROLE"));

// Set folder permissions
await wttpSite.setResourcePermission("/hr/", HR_ROLE, "readwrite");
await wttpSite.setResourcePermission("/engineering/", ENG_ROLE, "readwrite");

// Add employees to departments
await wttpSite.grantRole(HR_ROLE, "0xHREmployee1...");
await wttpSite.grantRole(HR_ROLE, "0xHREmployee2...");
await wttpSite.grantRole(ENG_ROLE, "0xEngineer1...");
await wttpSite.grantRole(ENG_ROLE, "0xEngineer2...");
```

---

## Permission Commands

### Grant Access

```bash
# Give someone a role
npx hardhat run scripts/manage-users.js --network sepolia
```

**Common roles:**
- `DEFAULT_ADMIN`: Full control (be careful!)
- `SITE_ADMIN`: Can manage users and content
- `CONTENT_EDITOR`: Can read/write files
- `PUBLIC_ROLE`: Can read public content
- Custom roles: Create your own

### Remove Access

```bash
# Remove someone's role
npx hardhat run scripts/manage-users.js --network sepolia
```

```
Action: revoke-role
Role: CONTENT_EDITOR
Address: 0x1234567890123456789012345678901234567890
```

### Check Permissions

```bash
# See who has what role
npx hardhat run scripts/list-permissions.js --network sepolia
```

**Output:**
```
Site: 0x742d35Cc6523C0532...

DEFAULT_ADMIN:
  - 0x742d35Cc6523C0532... (you)

CONTENT_EDITOR:
  - 0x1234567890123456789012345678901234567890 (Alice)
  - 0x0987654321098765432109876543210987654321 (Bob)

PUBLIC_ROLE:
  - 0x0000000000000000000000000000000000000000 (everyone)
```

---

## Advanced Permission Patterns

### Time-Based Access

```javascript
// Grant temporary access (expires in 30 days)
const expirationTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
await wttpSite.grantTemporaryRole(CONTENT_EDITOR, userAddress, expirationTime);
```

### Resource-Specific Permissions

```javascript
// Only allow editing specific files
await wttpSite.setResourcePermission("/blog/2024/", CONTENT_EDITOR, "readwrite");
await wttpSite.setResourcePermission("/admin/", DEFAULT_ADMIN, "readwrite");
```

### Blacklisting

```javascript
// Block specific addresses
await wttpSite.grantRole(BLACKLIST_ROLE, spammerAddress);
// They can't access anything, even if they have other roles
```

### Hierarchical Permissions

```javascript
// Admins can do everything editors can do
await wttpSite.setRoleAdmin(CONTENT_EDITOR, SITE_ADMIN);
// Site admins can grant/revoke CONTENT_EDITOR role
```

---

## Security Best Practices

### 1. Principle of Least Privilege

Give users the minimum permissions they need:

```javascript
// Good: Specific permissions
await wttpSite.grantRole(CONTENT_EDITOR, writerAddress);

// Bad: Too much power
await wttpSite.grantRole(DEFAULT_ADMIN, writerAddress);
```

### 2. Regular Permission Audits

```bash
# Check permissions monthly
npx hardhat run scripts/audit-permissions.js --network sepolia
```

### 3. Use Role Hierarchies

```javascript
// Set up hierarchy: ADMIN > EDITOR > READER
await wttpSite.setRoleAdmin(CONTENT_EDITOR, SITE_ADMIN);
await wttpSite.setRoleAdmin(READER, CONTENT_EDITOR);
```

### 4. Monitor Access

```javascript
// Log access attempts
wttpSite.on("AccessDenied", (user, resource, action) => {
  console.log(`${user} tried to ${action} ${resource} - DENIED`);
});
```

---

## Common Permission Errors

### Error: "AccessControl: account is missing role"

**Cause**: User doesn't have required role

**Solution**:
```bash
# Grant the needed role
npx hardhat run scripts/manage-users.js --network sepolia
# Action: grant-role
# Role: CONTENT_EDITOR  
# Address: 0x...
```

### Error: "Resource not accessible"

**Cause**: Resource has specific permissions set

**Solution**:
```javascript
// Check resource permissions
const hasAccess = await wttpSite.hasResourceAccess(
  userAddress, 
  "/private/file.html", 
  "read"
);
console.log(`User has access: ${hasAccess}`);
```

### Error: "Only role admin can grant/revoke"

**Cause**: You're not an admin for that role

**Solution**: Use an admin account or become a role admin first

---

## Real-World Examples

### Example 1: News Website

```javascript
// Roles
const JOURNALIST = keccak256("JOURNALIST");
const EDITOR = keccak256("EDITOR");
const SUBSCRIBER = keccak256("SUBSCRIBER");

// Permissions
await wttpSite.setResourcePermission("/drafts/", JOURNALIST, "readwrite");
await wttpSite.setResourcePermission("/published/", EDITOR, "readwrite");
await wttpSite.setResourcePermission("/premium/", SUBSCRIBER, "read");
await wttpSite.setResourcePermission("/public/", PUBLIC_ROLE, "read");

// Workflow
// 1. Journalist writes draft
// 2. Editor reviews and publishes
// 3. Public reads free articles
// 4. Subscribers read premium content
```

### Example 2: Educational Platform

```javascript
// Roles
const INSTRUCTOR = keccak256("INSTRUCTOR");
const STUDENT = keccak256("STUDENT");
const TA = keccak256("TEACHING_ASSISTANT");

// Course structure
await wttpSite.setResourcePermission("/courses/intro/", STUDENT, "read");
await wttpSite.setResourcePermission("/courses/advanced/", STUDENT, "read");
await wttpSite.setResourcePermission("/assignments/", TA, "readwrite");
await wttpSite.setResourcePermission("/grades/", INSTRUCTOR, "readwrite");
```

### Example 3: DAO Governance

```javascript
// Roles
const MEMBER = keccak256("DAO_MEMBER");
const PROPOSAL_CREATOR = keccak256("PROPOSAL_CREATOR");
const EXECUTOR = keccak256("EXECUTOR");

// Governance permissions
await wttpSite.setResourcePermission("/proposals/", PROPOSAL_CREATOR, "write");
await wttpSite.setResourcePermission("/votes/", MEMBER, "readwrite");
await wttpSite.setResourcePermission("/executed/", EXECUTOR, "write");
```

---

## Permission Management Tools

### GUI Tools (Coming Soon)

- **WTTP Dashboard**: Visual permission management
- **Role Builder**: Create custom role hierarchies
- **Access Analyzer**: Audit who can access what

### API Integration

```javascript
// Check permissions in your app
const canEdit = await wttpSite.hasRole(CONTENT_EDITOR, userAddress);
if (canEdit) {
  showEditButton();
} else {
  showReadOnlyView();
}
```

### Webhook Notifications

```javascript
// Get notified of permission changes
wttpSite.on("RoleGranted", (role, account, sender) => {
  console.log(`${account} was granted ${role} by ${sender}`);
  // Send email notification, update UI, etc.
});
```

---

## Next Steps

🎉 **You now understand WTTP permissions!**

**What's next?**

1. **[Advanced Security](security-best-practices.md)** - Harden your site
2. **[Multi-Site Management](multi-site-management.md)** - Manage multiple WTTP sites
3. **[Integration Guide](api-integration.md)** - Connect WTTP to your apps
4. **[Troubleshooting](troubleshooting.md)** - Fix common issues

**Pro tip**: Start with simple permissions and add complexity as needed. The role system is powerful but can get complex quickly!

**Questions?** Join our [Discord community](https://discord.gg/wttp) for help with permission design.

**Secure your site, empower your users!** 🔐✨ 