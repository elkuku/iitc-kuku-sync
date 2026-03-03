// Script-mode ambient declarations — NO top-level imports/exports so TypeScript
// auto-includes this file via "include": ["types/*.d.ts"] in tsconfig.json.

type SyncCallback = (pluginName?: string, fieldName?: string, extra?: null, fullUpdated?: boolean) => void
type SyncInitCallback = (pluginName?: string, fieldName?: string) => void

interface SyncPluginApi {
    updateMap: (pluginName: string, fieldName: string, keyArray: string[]) => boolean
    registerMapForSync: (pluginName: string, fieldName: string, callback: SyncCallback, initializedCallback: SyncInitCallback) => void
}

interface GapiError {
    type?: boolean
    status?: number
    error?: {message: string}
    result?: {error?: {message: string}}
}

interface GapiAuth2Instance {
    isSignedIn: {
        listen: (callback: (signedIn: boolean) => void) => void
        get: () => boolean
    }
    signIn: () => void
}

type GapiListCallback = (resp: {result: {files: {id: string}[]}}) => void

interface GapiListResult {
    execute: (callback: GapiListCallback) => void
    then: (callback: GapiListCallback) => void
}

interface GapiDriveFiles {
    list: (options: {q: string}) => GapiListResult
    get: (options: {fileId: string; alt: string}) => {then: (onSuccess: (response: {result: unknown}) => void, onError: (error: GapiError) => void) => void}
    create: (options: {fields?: string; resource: object}) => {then: (callback: (response: {result: {id: string}}) => void) => void}
}

interface GapiClient {
    init: (config: {apiKey: string; discoveryDocs: string[]; client_id: string; scope: string}) => Promise<void>
    load: (api: string, version: string) => Promise<void>
    request: (config: {path: string; method: string; params: object; body: string}) => {execute: () => void}
    drive: {files: GapiDriveFiles}
}

interface Gapi {
    load: (libraries: string, callback: () => void) => void
    client: GapiClient
    auth2: {getAuthInstance: () => GapiAuth2Instance}
}

// Script-mode ambient file: extend Window directly (no `declare global` wrapper needed).
// Note: window.gapi is already declared as `any` by iitcpluginkit; typed access uses
// `const gapi = window.gapi as Gapi` locally in each file.
interface Window {
    plugin: {
        // Shape matches HelperHandlebars in types/Types.ts (structural typing)
        HelperHandlebars: {
            compile: (templateString: any) => Handlebars.TemplateDelegate
            registerHelper: (name: Handlebars.HelperDeclareSpec) => void
        }
        sync: SyncPluginApi
        [key: string]: any
    }
}
