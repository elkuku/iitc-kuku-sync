# KuKu Sync — Third-Party Developer API

This document describes how other IITC plugins can use the **KuKu Sync** plugin to synchronise their data across devices via Google Drive.

## Overview

KuKu Sync exposes a small public API at `window.plugin.sync`. Plugins register one or more **fields** for sync. Each field maps to a plain JavaScript object stored at `window.plugin[yourPluginName][yourFieldName]`. The sync plugin reads and writes that object to a JSON file on Google Drive, polling every 3 minutes and merging changes from other devices automatically.

## Prerequisites

- The user must have KuKu Sync installed and authorised with their Google account.
- KuKu Sync loads at **high priority**, so `window.plugin.sync` is defined before normal plugins initialise. Still, guard against it being absent (e.g. user hasn't installed it).
- Your field must be a plain `Record<string, unknown>` — a flat object whose keys are strings and whose values are JSON-serialisable.

## API reference

### `window.plugin.sync.registerMapForSync`

```ts
registerMapForSync(
    pluginName: string,
    fieldName: string,
    callback: SyncCallback,
    initializedCallback: SyncInitCallback,
): void
```

Registers a field for synchronisation. Call this once during your plugin's `setup` / `init`.

| Parameter | Type | Description |
|---|---|---|
| `pluginName` | `string` | The key your plugin uses under `window.plugin`, e.g. `'myPlugin'`. |
| `fieldName` | `string` | The property name of the object to sync, e.g. `'markers'`. |
| `callback` | `SyncCallback` | Called after every poll cycle and after a remote update is applied. |
| `initializedCallback` | `SyncInitCallback` | Called once when the Drive file is found or created and the first load completes. |

**Callback signatures**

```ts
type SyncCallback = (
    pluginName?: string,
    fieldName?: string,
    extra?: null,
    fullUpdated?: boolean,
) => void

type SyncInitCallback = (
    pluginName?: string,
    fieldName?: string,
) => void
```

`SyncCallback` is called in two situations:

1. **After every successful poll** — arguments are all `undefined`. Use this to refresh your UI.
2. **After a remote update replaces local data** — `pluginName` and `fieldName` identify the field; `fullUpdated` is `true`. The field content has already been replaced with remote data by the time your callback runs, so you should re-read `window.plugin[pluginName][fieldName]` and update your UI accordingly.

`SyncInitCallback` is called once when initialisation completes successfully. Use it to load the initial synced state into your plugin.

---

### `window.plugin.sync.updateMap`

```ts
updateMap(
    pluginName: string,
    fieldName: string,
    keyArray: string[],
): boolean
```

Pushes a set of changed keys to Google Drive immediately. Call this whenever your plugin modifies the field so other devices receive the update promptly (instead of waiting for the next 3-minute poll).

| Parameter | Type | Description |
|---|---|---|
| `pluginName` | `string` | Same value passed to `registerMapForSync`. |
| `fieldName` | `string` | Same value passed to `registerMapForSync`. |
| `keyArray` | `string[]` | Keys that changed. Pass the key with its current value still present in the field to upsert it; if the key has been deleted from the field, pass it anyway — the sync plugin reads `undefined` and removes it from the Drive copy. |

Returns `true` if the field was registered and the update was dispatched, `false` if the field is not registered (e.g. sync plugin absent or `registerMapForSync` not yet called).

## Data storage

Each registered field is stored as a separate JSON file inside a folder named **`IITC-SYNC-DATA-V3`** in the user's Google Drive. File names follow the pattern `pluginName[fieldName]`. You do not need to manage these files directly.

## Minimal integration example

```js
// Plain JS example — adapt to your build system as needed.

const pluginName = 'myPlugin'      // must match your window.plugin key
const fieldName  = 'savedPortals'  // the object you want to sync

// 1. Initialise your field as a plain object before registering.
window.plugin.myPlugin = { savedPortals: {} }

function setup() {
    // 2. Register for sync (guard against sync plugin being absent).
    if (window.plugin.sync) {
        window.plugin.sync.registerMapForSync(
            pluginName,
            fieldName,
            onSyncCallback,
            onSyncInitialized,
        )
    }
}

function onSyncInitialized(pName, fName) {
    // Called once when the Drive file is ready and first data is loaded.
    // Re-draw anything that depends on the synced data.
    renderPortals()
}

function onSyncCallback(pName, fName, extra, fullUpdated) {
    if (fullUpdated) {
        // Remote data replaced local data — re-read and redraw everything.
        renderPortals()
    }
    // Also called after every successful poll with no arguments (UI refresh).
}

// 3. Call updateMap after every mutation.
function addPortal(guid, data) {
    window.plugin.myPlugin.savedPortals[guid] = data
    if (window.plugin.sync) {
        window.plugin.sync.updateMap(pluginName, fieldName, [guid])
    }
}

function removePortal(guid) {
    delete window.plugin.myPlugin.savedPortals[guid]
    if (window.plugin.sync) {
        window.plugin.sync.updateMap(pluginName, fieldName, [guid])
    }
}
```

## TypeScript types

If your plugin is written in TypeScript, declare the API shape in an ambient `.d.ts` file:

```ts
type SyncCallback = (
    pluginName?: string,
    fieldName?: string,
    extra?: null,
    fullUpdated?: boolean,
) => void

type SyncInitCallback = (pluginName?: string, fieldName?: string) => void

interface SyncPluginApi {
    updateMap: (pluginName: string, fieldName: string, keyArray: string[]) => boolean
    registerMapForSync: (
        pluginName: string,
        fieldName: string,
        callback: SyncCallback,
        initializedCallback: SyncInitCallback,
    ) => void
}

// Extend Window so window.plugin.sync is typed.
interface Window {
    plugin: {
        sync?: SyncPluginApi
        [key: string]: any
    }
}
```

## Behavioural notes

- **Poll interval**: 3 minutes. `updateMap` bypasses the wait and writes immediately.
- **Conflict resolution**: last write wins. If two devices write the same key concurrently, whichever Drive update arrives last takes precedence.
- **UUID tracking**: each browser instance has a stable UUID stored in `localStorage`. The sync plugin uses this to detect whether a Drive file was modified by a different device and only applies remote changes when it was.
- **Error handling**: network errors trigger a re-authorisation attempt after 50 seconds. 401 responses re-trigger the OAuth flow. 404 responses cause a file re-search. Failed initialisations are retried up to twice before being marked as failed (visible via the `KSync` toolbox button turning red).
- **`pluginName` must match `window.plugin` key exactly**: the sync engine reads and writes `window.plugin[pluginName][fieldName]` directly.
