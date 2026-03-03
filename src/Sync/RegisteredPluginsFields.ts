import {Authorizer} from './Authorizer'
import {RegisteredMap} from './RegisteredMap'

export class RegisteredPluginsFields {
    private readonly pluginsFields: Record<string, Record<string, RegisteredMap>> = {}
    private waitingInitialize: Record<string, RegisteredMap> = {}
    private timer: ReturnType<typeof setTimeout> | undefined

    anyFail = false

    constructor(
        private readonly authorizer: Authorizer,
        private readonly onToggleDialogLink: () => void,
    ) {
        this.authorizer.addAuthCallback(this.initializeRegistered)
    }

    add(registeredMap: RegisteredMap): void {
        const {pluginName, fieldName} = registeredMap

        if (!this.pluginsFields[pluginName]) {
            this.pluginsFields[pluginName] = {}
        }

        if (this.pluginsFields[pluginName][fieldName]) return

        this.pluginsFields[pluginName][fieldName] = registeredMap
        this.waitingInitialize[registeredMap.getFileName()] = registeredMap

        this.initializeWorker()
    }

    get(pluginName: string, fieldName: string): RegisteredMap | undefined {
        return this.pluginsFields[pluginName]?.[fieldName]
    }

    private readonly initializeRegistered = (): void => {
        if (!this.authorizer.isAuthed()) return

        for (const map of Object.values(this.waitingInitialize)) {
            if (!map.initializing && !map.initialized) {
                map.initialize()
            }
        }
    }

    private cleanWaitingInitialize(): void {
        const next: Record<string, RegisteredMap> = {}

        for (const [key, map] of Object.entries(this.waitingInitialize)) {
            if (map.failed) this.anyFail = true
            if (map.initialized || map.failed) continue
            next[key] = map
        }

        this.waitingInitialize = next
    }

    private initializeWorker(): void {
        this.cleanWaitingInitialize()
        this.onToggleDialogLink()
        this.initializeRegistered()

        if (this.timer !== undefined) clearTimeout(this.timer)

        if (Object.keys(this.waitingInitialize).length > 0) {
            this.timer = setTimeout(() => { this.initializeWorker() }, 10000)
        }
    }
}
