# Refactor Plan: original/sync.js → TypeScript Classes

## Source
`original/sync.js` — monolithic IITC plugin, Google Drive sync via gapi.

## Target File Structure

```
src/
  Sync/
    Logger.ts                   # Log storage + HTML rendering
    Authorizer.ts               # Google OAuth2 authorization
    DataManager.ts              # Google Drive file I/O
    RegisteredMap.ts            # One plugin field ↔ one Drive file
    RegisteredPluginsFields.ts  # Registry + init orchestration
  Main.ts                       # Entry point, wires classes, exposes public API
  styles.css                    # CSS (moved from inline setupCSS)
types/
  Types.ts                      # Add window.gapi, window.plugin.sync, index signature
plugin.json                     # Update name/id/description
```

`src/Helper/Dialog.ts` and `src/tpl/dialog.hbs` — untouched (template scaffolding).

---

## Classes

### Logger
- Stores log entries keyed by filename
- `log('all', msg)` updates all keys
- `getLogs()` returns HTML string

### Authorizer
- Static: API_KEY, DISCOVERY_DOCS, CLIENT_ID, SCOPES
- Injected: Logger, initial AuthCallbacks[]
- `authorize()` bound in constructor
- Calls `gapi.client.init` → listens for isSignedIn changes

### DataManager
- Static: `parentFolderID`, `parentFolderIDRequested`, `instances`
- Injected: Logger, fileName, description
- `initialize(force, assignIdCb, failedCb)`
- `readFile(needInitCb, onLoadedCb, onErrorCb)`
- `saveFile(data)`
- fileId persisted to localStorage

### RegisteredMap
- `SyncCallback` params all optional (original calls with 0 or 4 args)
- `initialize()` and `loadDocument()` bound in constructor
- Polls Drive on `checkInterval`; replaces local plugin data when updated by others
- Creates new DataManager per `initFile()` call

### RegisteredPluginsFields
- `anyFail` public flag
- Adds auth callback to Authorizer on construction
- `initializeWorker()` retries every 10s until all initialized

### Main
- Instantiates all classes, loads UUID (crypto.randomValues or fallback)
- Exposes `window.plugin.sync.updateMap` and `registerMapForSync`
- Dialog button click bound via jQuery (no inline onclick)
- Loads Google API script via `$.getScript`

---

## Types.ts Changes
- Add `window.gapi` minimal interface
- Add `window.plugin.sync: SyncPluginApi`
- Add `[key: string]: any` index signature to `window.plugin`
- Export `SyncCallback`, `SyncInitCallback`

## plugin.json Changes
- name: "IITC plugin: Sync"
- id: "iitc_plugin_sync"
- description: "Sync data between clients via Google Drive API..."

## Verification
```bash
npx eslint src/
yarn build:dev
```
