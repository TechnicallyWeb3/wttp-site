# Technical Report: Enabling localStorage for WTTP Protocol in Modified Min-Browser

## Executive Summary

Your team is experiencing localStorage access restrictions when using the custom `wttp://` protocol in your forked Electron-based min-browser. This is a known security limitation in Electron/Chromium for custom protocols that can be resolved through proper protocol registration and configuration.

## The Problem

The error `Failed to read the 'localStorage' property from 'Window': Access is denied for this document` indicates that the WTTP protocol has not been properly registered as a "standard" scheme in Electron. By default, custom protocols are treated as "file-like" schemes which have restricted access to browser APIs including localStorage.

## Root Cause Analysis

The localStorage access restriction stems from Chromium's security model:

1. **Non-standard schemes are treated as opaque origins** - They don't have persistent storage access by default
2. **localStorage is tied to origin identity** - Origins must be considered "secure" and "standard" to access storage APIs
3. **Custom protocols inherit file:// restrictions** - Unless specifically configured otherwise

## Primary Solution: Protocol Registration with Correct Privileges

The key is registering your custom protocol **before** the app is ready with the right privilege combination:

```javascript
const { app, protocol } = require('electron')

// CRITICAL: This MUST be called before app.whenReady()
app.whenReady().then(() => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'wttp',
      privileges: {
        standard: false,      // Avoids URL validation that breaks Ethereum addresses
        secure: true,        // Enables localStorage access
        supportFetchAPI: true,
        corsEnabled: true,
        allowServiceWorkers: false,
        bypassCSP: false,
        stream: true
      }
    }
  ])
})
```

## WebPreferences Configuration

Ensure your BrowserWindow is configured to allow the necessary features:

```javascript
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    webSecurity: true,  // Keep this true for security
    allowRunningInsecureContent: false
  }
})
```

## CRITICAL ADVANCED SOLUTIONS

**Since you mentioned the correct settings still don't work, here are the advanced solutions:**

### Solution 1: Custom Session with Explicit Storage Access

```javascript
const { app, session, protocol } = require('electron')

app.whenReady().then(() => {
  // Create a custom session for WTTP
  const wttpSession = session.fromPartition('persist:wttp')
  
  // Register protocol on the specific session
  wttpSession.protocol.registerSchemesAsPrivileged([
    {
      scheme: 'wttp',
      privileges: {
        standard: false,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
  
  // Enable storage APIs explicitly
  wttpSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'storage-access') {
      callback(true)
    } else {
      callback(false)
    }
  })
  
  // Create browser window with custom session
  const mainWindow = new BrowserWindow({
    webPreferences: {
      session: wttpSession,
      webSecurity: false  // Only if absolutely necessary
    }
  })
})
```

### Solution 2: Origin Override Workaround

If localStorage still fails, use a JavaScript injection to override the origin:

```javascript
// In your main process, before loading content
mainWindow.webContents.on('dom-ready', () => {
  mainWindow.webContents.executeJavaScript(`
    // Override origin for localStorage access
    Object.defineProperty(window.location, 'protocol', {
      get: function() { return 'https:'; }
    });
    
    Object.defineProperty(window.location, 'origin', {
      get: function() { return 'https://wttp-app.local'; }
    });
    
    // Test localStorage access
    try {
      localStorage.setItem('test', 'value');
      console.log('localStorage access successful');
    } catch (e) {
      console.error('localStorage still blocked:', e);
    }
  `)
})
```

### Solution 3: Use IndexedDB Instead of localStorage

If localStorage remains blocked, switch to IndexedDB which has broader support:

```javascript
// Alternative storage solution
function setWTTPStorage(key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WTTPStorage', 1);
    
    request.onupgradeneeded = function() {
      const db = request.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    };
    
    request.onsuccess = function() {
      const db = request.result;
      const transaction = db.transaction(['data'], 'readwrite');
      const store = transaction.objectStore('data');
      const putRequest = store.put(value, key);
      
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}
```

### Solution 4: App-Level Storage Bridge

Create a bridge between renderer and main process for storage:

```javascript
// In main process
const { ipcMain } = require('electron')

let appStorage = new Map()

ipcMain.handle('wttp-storage-set', (event, key, value) => {
  appStorage.set(key, value)
  return true
})

ipcMain.handle('wttp-storage-get', (event, key) => {
  return appStorage.get(key)
})

// In renderer process
window.wttpStorage = {
  setItem: async (key, value) => {
    return await window.electronAPI.invoke('wttp-storage-set', key, value)
  },
  getItem: async (key) => {
    return await window.electronAPI.invoke('wttp-storage-get', key)
  }
}
```

## Testing Steps

1. **Verify Protocol Registration**: Add debugging to confirm registration
2. **Test Storage Access**: Use browser console to test `localStorage.setItem('test', 'value')`
3. **Check Origin**: Verify `window.location.origin` returns expected value
4. **Monitor Console**: Look for security errors or warnings

## Debugging Commands

```javascript
// Test in browser console
console.log('Origin:', window.location.origin)
console.log('Protocol:', window.location.protocol)

// Test localStorage
try {
  localStorage.setItem('wttp-test', 'success')
  console.log('localStorage working:', localStorage.getItem('wttp-test'))
} catch (e) {
  console.error('localStorage blocked:', e.message)
}

// Test alternative storage
try {
  sessionStorage.setItem('wttp-test', 'success')
  console.log('sessionStorage working:', sessionStorage.getItem('wttp-test'))
} catch (e) {
  console.error('sessionStorage blocked:', e.message)
}
```

## Security Considerations

- **Only disable webSecurity as last resort** - This opens significant security holes
- **Consider data isolation** - Use custom sessions to isolate WTTP data
- **Validate all inputs** - Especially important with relaxed security settings
- **Monitor for security updates** - Keep Electron version current

## Success Criteria

The implementation is successful when:
1. `localStorage.setItem()` and `localStorage.getItem()` work without errors
2. No "Invalid address" errors in console
3. Game state persists between browser sessions
4. No security warnings related to protocol handling

## Escalation Path

If these solutions don't resolve the issue:
1. **Try chromium command line flags**: `--disable-web-security --disable-site-isolation-trials`
2. **Use older Electron version**: Some protocol features changed between versions
3. **Implement custom storage layer**: Build your own persistence mechanism
4. **Contact Electron community**: This may be a known limitation with specific Electron versions

**Final Note**: The localStorage restriction is a fundamental Chromium security feature. If standard solutions don't work, the issue may require either accepting an alternative storage mechanism or using a different approach to custom protocol handling.

## Browser Team Action Items

### Immediate Testing (5 minutes):
```javascript
// Replace current registration with this:
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wttp',
    privileges: {
      standard: false,        // KEY CHANGE: Disable URL validation
      secure: true,          // KEY: This should enable localStorage
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: false,
      bypassCSP: false,
      stream: true
    }
  }
])
```

### Verification Steps:
1. Test Ethereum address loading (should work)
2. Test localStorage access (should work)
3. Verify other WTTP functionality remains intact

### Additional WebPreferences (if needed):
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  webSecurity: true,        // Keep security enabled
  sandbox: false,           // Try setting to false if still issues
  experimentalFeatures: true // Sometimes helps with custom protocols
}
```

## Security Considerations

- `secure: true` provides localStorage access while maintaining security
- `standard: false` avoids URL validation but may limit some web platform features
- Keep `bypassCSP: false` to maintain Content Security Policy protection
- Monitor for any unexpected behavior with the new configuration

## Next Steps

1. **Test the `secure: true` approach immediately** - this is most likely to resolve the issue
2. If successful, verify all application functionality works as expected
3. If unsuccessful, we can explore the IPC-based storage simulation approach
4. Document the final working configuration for future reference

## Expected Outcome

With `secure: true` and `standard: false`, you should have:
- ✅ localStorage access enabled
- ✅ Ethereum addresses loading properly
- ✅ All existing WTTP functionality preserved
- ✅ Maintained security protections

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