import {Authorizer} from './Authorizer'
import {DataManager} from './DataManager'
import {Logger} from './Logger'

export interface RegisteredMapOptions {
    pluginName: string
    fieldName: string
    callback: SyncCallback | undefined
    initializedCallback: SyncInitCallback | undefined
    authorizer: Authorizer
    uuid: string
    checkInterval: number
    logger: Logger
}

export class RegisteredMap {
    readonly pluginName: string
    readonly fieldName: string

    private readonly callback: SyncCallback | undefined
    private readonly initializedCallback: SyncInitCallback | undefined
    private readonly authorizer: Authorizer
    private readonly uuid: string
    private readonly checkInterval: number
    private readonly logger: Logger

    private intervalID: ReturnType<typeof setInterval> | undefined
    private map: Record<string, unknown> = {}
    private lastUpdateUUID: string | undefined
    private dataStorage: DataManager | undefined

    forceFileSearch = false
    initializing = false
    initialized = false
    failed = false

    constructor(options: RegisteredMapOptions) {
        this.pluginName = options.pluginName
        this.fieldName = options.fieldName
        this.callback = options.callback
        this.initializedCallback = options.initializedCallback
        this.authorizer = options.authorizer
        this.uuid = options.uuid
        this.checkInterval = options.checkInterval
        this.logger = options.logger

        this.initialize = this.initialize.bind(this)
        this.loadDocument = this.loadDocument.bind(this)
    }

    updateMap(keyArray: string[]): void {
        try {
            this.lastUpdateUUID = this.uuid
            for (const key of keyArray) {
                const value: unknown = window.plugin[this.pluginName][this.fieldName][key]
                if (value === undefined) {
                    Reflect.deleteProperty(this.map, key)
                } else {
                    this.map[key] = value
                }
            }
        } finally {
            this.dataStorage!.saveFile(this.prepareFileData())
        }
    }

    private isUpdatedByOthers(): boolean {
        if (!this.lastUpdateUUID) return false
        return this.lastUpdateUUID !== '' && this.lastUpdateUUID !== this.uuid
    }

    getFileName(): string {
        return `${this.pluginName}[${this.fieldName}]`
    }

    private readonly onInitFileFailed = (): void => {
        this.initializing = false
        this.failed = true
        this.logger.log(
            this.getFileName(),
            'Could not create file. If this problem persist, delete this file in IITC-SYNC-DATA-V3 in your Google Drive and try again.',
        )
    }

    private initFile(callback?: () => void): void {
        const assignIdCallback = () => {
            this.forceFileSearch = false
            if (callback) callback()
        }

        this.dataStorage = new DataManager(
            this.logger,
            this.getFileName(),
            `IITC plugin data for ${this.getFileName()}`,
        )
        this.dataStorage.initialize(this.forceFileSearch, assignIdCallback, this.onInitFileFailed)
    }

    initialize(): void {
        this.initFile(this.loadDocument)
    }

    private prepareFileData(): {'map': Record<string, unknown>; 'last-update-uuid': string} {
        return {map: this.map, 'last-update-uuid': this.uuid}
    }

    private readonly onFileCreated = (): void => {
        this.map = {}
        const pluginData = window.plugin[this.pluginName][this.fieldName] as Record<string, unknown>
        for (const [key, value] of Object.entries(pluginData)) {
            this.map[key] = value
        }
        this.dataStorage!.saveFile(this.prepareFileData())
        this.logger.log(this.getFileName(), 'Model initialized')
        setTimeout(() => { this.loadDocument() }, this.checkInterval)
    }

    private readonly onFileLoaded = (data: unknown): void => {
        const fileData = data as {'map': Record<string, unknown>; 'last-update-uuid': string}
        this.map = fileData.map
        this.lastUpdateUUID = fileData['last-update-uuid']

        this.intervalID ??= setInterval(() => { this.loadDocument() }, this.checkInterval)

        if (this.isUpdatedByOthers()) {
            this.logger.log(this.getFileName(), 'Updated by others, replacing content')
            window.plugin[this.pluginName][this.fieldName] = {}
            for (const [key, value] of Object.entries(this.map)) {
                window.plugin[this.pluginName][this.fieldName][key] = value
            }
            this.callback?.(this.pluginName, this.fieldName, undefined, true)
        }

        this.initialized = true
        this.initializing = false
        this.logger.log(this.getFileName(), 'Data loaded')
        this.callback?.()
        this.initializedCallback?.(this.pluginName, this.fieldName)
    }

    private readonly onFileError = (error: GapiError): void => {
        const isNetworkError =
            error.type === true ||
            error.error?.message === 'A network error occurred, and the request could not be completed.'
        const errorMessage =
            error.error === undefined
                ? (error.result?.error?.message ?? 'Unknown error')
                : error.error.message

        this.logger.log(this.getFileName(), errorMessage)

        if (isNetworkError) {
            setTimeout(() => { this.authorizer.authorize() }, 50 * 1000)
        } else if (error.status === 401) {
            this.authorizer.authorize()
        } else if (error.status === 404) {
            this.forceFileSearch = true
            this.initFile()
            setTimeout(() => { this.loadDocument() }, this.checkInterval)
        }
    }

    loadDocument(): void {
        this.initializing = true
        this.dataStorage!.readFile(this.onFileCreated, this.onFileLoaded, this.onFileError)
    }
}
