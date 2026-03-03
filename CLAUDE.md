# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build          # Development build (alias for build:dev)
yarn build:dev      # Build dev version via iitcpluginkit
yarn build:prod     # Build production version (used for tagged releases)
yarn start          # Start file server for local testing
yarn autobuild      # Watch mode for auto-rebuilding on changes
```

There are no test commands — this project has no test suite.

Linting uses ESLint with TypeScript support:
```bash
npx eslint src/
```

## Architecture

This is an [IITC](https://iitc.app/) (Ingress Intel Total Conversion) plugin built on the [IITC Plugin Kit](https://github.com/McBen/IITCPluginKit) (`iitcpluginkit` npm package).

### Plugin metadata

`plugin.json` is the single source of truth for plugin identity (`name`, `id`, `category`, `author`, `downloadURL`, etc.). It is imported into `src/Main.ts` at build time. The `entry` field points to `src/Main.ts` as the webpack entry.

### Entry point and registration

`src/Main.ts` defines a class implementing `Plugin.Class` from `iitcpluginkit` and registers it via `Plugin.Register(new Main, PLUGIN_NAME)`. The `init()` method is called by IITC after the plugin loads.

### Dialog system

UI dialogs use Handlebars templates (`.hbs` files in `src/tpl/`) compiled at runtime via the `window.plugin.HelperHandlebars` dependency (a separate IITC helper plugin). `src/Helper/Dialog.ts` wraps this pattern. Templates receive `plugin` and `prefix` variables.

### CSS

`src/styles.css` is loaded at runtime inside `init()` using `require('./styles.css')`.

### Build output and releases

- Dev builds go to `dist/` then are copied to `build/dev/`
- Production builds (from the latest git tag) go to `build/release/`
- The CI workflow (`build.yml`) builds HEAD as dev, builds the latest git tag as prod, generates `build/changelog.json` from annotated tags, then publishes a GitHub Pages site
- **Releases are done by creating annotated git tags** — the tag message becomes the changelog entry

### TypeScript

Strict mode is enabled. Custom global types (e.g., `window.plugin`, IITC globals) are declared in `types/Types.ts`. The `types/handlebars.d.ts` file provides Handlebars type declarations.

### Public API

The plugin exposes two methods at `window.plugin.sync` for use by third-party plugins. See `docs/sync-api.md` for full developer documentation.

```ts
// Register a field (window.plugin[pluginName][fieldName]) for sync.
// callback     — called after every poll and after remote data replaces local data (fullUpdated=true).
// initCallback — called once when the Drive file is found/created and first load completes.
window.plugin.sync.registerMapForSync(pluginName, fieldName, callback, initCallback)

// Push changed keys to Drive immediately (returns false if field not registered).
window.plugin.sync.updateMap(pluginName, fieldName, keyArray)
```

Key constraints:
- The field must be a plain `Record<string, unknown>` at `window.plugin[pluginName][fieldName]`.
- `updateMap` must be called after every mutation; otherwise sync waits for the 3-minute poll.
- The plugin runs at **high priority** so `window.plugin.sync` is defined before normal plugins init, but still guard with `if (window.plugin.sync)`.
- Types for the API are declared in `types/Globals.d.ts` (`SyncPluginApi`, `SyncCallback`, `SyncInitCallback`).

### ESLint conventions

- Arrow functions are enforced (`prefer-arrow-functions` plugin)
- Files must use PascalCase (enforced by `unicorn/filename-case`)
- No underscore-prefixed identifiers (`no-underscore-dangle`)
- Unused variables are errors; prefix unused parameters with `_` to suppress
