# Technical Report: Enabling localStorage for WTTP Protocol in Modified Min-Browser

## Executive Summary

Your team is experiencing localStorage access restrictions when using the custom `wttp://` protocol in your forked Electron-based min-browser. This is a known security limitation in Electron/Chromium for custom protocols that can be resolved through proper protocol registration and configuration.

## The Problem

The error `Failed to read the 'localStorage' property from 'Window': Access is denied for this document` indicates that the WTTP protocol has not been properly registered as a "standard" scheme in Electron. By default, custom protocols are treated as "file-like" schemes which have restricted access to browser APIs including localStorage.

## Root Cause Analysis

1. **Default Protocol Behavior**: Custom protocols in Electron inherit limited permissions by default
2. **Security Sandbox**: Chromium's security model restricts non-standard schemes from accessing storage APIs
3. **Missing Protocol Registration**: The WTTP protocol needs explicit registration with proper privileges

## Required Solutions

### 1. Register WTTP as a Standard Scheme

In your main Electron process (before `app.ready`), add:

```javascript
const { protocol, app } = require('electron');

// Register the scheme as standard BEFORE app is ready
app.whenReady().then(() => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'wttp',
      privileges: {
        standard: true,
        secure: true,
        allowServiceWorkers: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
});
```

### 2. Configure WebPreferences

In your BrowserWindow configuration, ensure these settings:

```javascript
const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: true, // Keep this true for security
    allowRunningInsecureContent: false,
    experimentalFeatures: true, // May be needed for custom protocols
    partition: 'persist:main' // Ensures localStorage persistence
  }
});
```

### 3. Protocol Handler Implementation

Ensure your protocol handler is properly implemented:

```javascript
protocol.registerFileProtocol('wttp', (request, callback) => {
  // Your existing WTTP protocol logic
  // Make sure it returns proper MIME types and headers
});
```

### 4. Alternative: Session Partition

If the above doesn't resolve the issue, try creating a custom session partition:

```javascript
const { session } = require('electron');

const customSession = session.fromPartition('persist:wttp-session');

const win = new BrowserWindow({
  webPreferences: {
    session: customSession,
    // ... other preferences
  }
});
```

## Testing Steps

1. Implement the protocol registration changes
2. Restart the browser completely (not just refresh)
3. Test localStorage access in the developer console:
   ```javascript
   localStorage.setItem('test', 'value');
   console.log(localStorage.getItem('test'));
   ```
4. Verify the game saves/loads properly

## Additional Considerations

### Security Implications
- Registering WTTP as a standard scheme gives it similar privileges to HTTP/HTTPS
- Ensure your WTTP protocol handler validates all inputs properly
- Consider implementing Content Security Policy at the protocol level

### Min-Browser Specific
- Check if min-browser has any custom protocol handling that might interfere
- Review any existing protocol registrations in the min-browser codebase
- Ensure the timing of protocol registration happens before any windows are created

## Debugging Steps

If issues persist:

1. **Check Protocol Registration**:
   ```javascript
   console.log(protocol.isProtocolRegistered('wttp'));
   ```

2. **Inspect Security Context**:
   In DevTools Console:
   ```javascript
   console.log(window.location.protocol);
   console.log(window.isSecureContext);
   ```

3. **Test with Simple HTML**:
   Create a minimal test page to isolate the localStorage issue from Phaser

## Expected Outcome

After implementing these changes:
- localStorage should be accessible from WTTP protocol pages
- The game should save/load state properly
- Security warnings about localStorage should disappear
- The protocol should behave similarly to standard web protocols

## Timeline Estimate

- Implementation: 2-4 hours
- Testing: 1-2 hours
- Documentation: 1 hour

## Contacts for Follow-up

If you encounter issues during implementation, please reach out with:
- Error messages from the main process console
- DevTools console errors
- Your current protocol registration code
- Min-browser version and any relevant modifications

---

**Note**: These changes require modifications to the main Electron process and will require a full application restart to take effect. 