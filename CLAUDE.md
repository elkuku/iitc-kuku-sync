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

### ESLint conventions

- Arrow functions are enforced (`prefer-arrow-functions` plugin)
- Files must use PascalCase (enforced by `unicorn/filename-case`)
- No underscore-prefixed identifiers (`no-underscore-dangle`)
- Unused variables are errors; prefix unused parameters with `_` to suppress
