import * as Plugin from 'iitcpluginkit'
import {Authorizer} from './Sync/Authorizer'
import {Logger} from './Sync/Logger'
import {RegisteredMap} from './Sync/RegisteredMap'
import {RegisteredPluginsFields} from './Sync/RegisteredPluginsFields'

// @ts-expect-error we don't want to import JSON files :(
import plugin from '../plugin.json'

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const PLUGIN_NAME = plugin.id.replace('iitc_plugin_', '') as string

const CHECK_INTERVAL = 3 * 60 * 1000
const UUID_STORAGE_KEY = 'plugin-sync-data-uuid'
const GOOGLE_API_URL = 'https://apis.google.com/js/api.js'

class Main implements Plugin.Class {
    private logger!: Logger
    private authorizer!: Authorizer
    private registeredPluginsFields!: RegisteredPluginsFields
    private uuid!: string

    init(): void {
        console.log(`${PLUGIN_NAME} - ${VERSION}`)

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./styles.css')

        this.logger = new Logger(10, this.updateLog)
        this.uuid = this.loadUUID()

        this.setupDialog()

        this.authorizer = new Authorizer(this.logger, [
            this.toggleAuthButton,
            this.toggleDialogLink,
        ])

        this.registeredPluginsFields = new RegisteredPluginsFields(
            this.authorizer,
            this.toggleDialogLink,
        )

        this.exposePublicAPI()
        this.loadGoogleAPI()
    }

    private loadGoogleAPI(): void {
        const script = document.createElement('script')
        script.src = GOOGLE_API_URL
        script.addEventListener('load', () => {
            const gapi = window.gapi as Gapi
            gapi.load('client:auth2', this.authorizer.authorize)
        })
        document.head.appendChild(script)
    }

    private exposePublicAPI(): void {
        window.plugin.sync = {
            updateMap: (pluginName: string, fieldName: string, keyArray: string[]): boolean => {
                const registeredMap = this.registeredPluginsFields.get(pluginName, fieldName)
                if (!registeredMap) return false
                registeredMap.updateMap(keyArray)
                return true
            },
            registerMapForSync: (
                pluginName: string,
                fieldName: string,
                callback: SyncCallback,
                initializedCallback: SyncInitCallback,
            ): void => {
                const registeredMap = new RegisteredMap({
                    pluginName,
                    fieldName,
                    callback,
                    initializedCallback,
                    authorizer: this.authorizer,
                    uuid: this.uuid,
                    checkInterval: CHECK_INTERVAL,
                    logger: this.logger,
                })
                this.registeredPluginsFields.add(registeredMap)
            },
        }
    }

    private loadUUID(): string {
        const stored = localStorage.getItem(UUID_STORAGE_KEY)
        if (stored) {
            try {
                return JSON.parse(stored) as string
            } catch {
                // fall through to generate new UUID
            }
        }
        const uuid = this.generateUUID()
        localStorage.setItem(UUID_STORAGE_KEY, JSON.stringify(uuid))
        return uuid
    }

    private generateUUID(): string {
        if (window.crypto?.getRandomValues) {
            const buf = new Uint16Array(8)
            window.crypto.getRandomValues(buf)
            const toHex = (num: number) => {
                const hex = num.toString(16)
                return '000'.slice(0, 4 - hex.length) + hex
            }
            const yxxx = (num: number) => (num & 0x3FFF) | 0x8000
            return (
                toHex(buf[0]) + toHex(buf[1]) + '-' +
                toHex(buf[2]) + '-4' + toHex(buf[3]).slice(1) + '-' +
                toHex(yxxx(buf[4])) + '-' +
                toHex(buf[5]) + toHex(buf[6]) + toHex(buf[7])
            )
        }
        let time = Date.now()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
            const randomValue = Math.trunc((time + Math.random() * 16) % 16)
            time = Math.trunc(time / 16)
            return (character === 'x' ? randomValue : (randomValue & 0x3) | 0x8).toString(16)
        })
    }

    private updateLog = (messages: string): void => {
        $('#sync-log').html(messages)
    }

    private toggleAuthButton = (): void => {
        const authed = this.authorizer.isAuthed()
        const authorizing = this.authorizer.isAuthorizing()
        $('#sync-authButton').html(authed ? 'Authorized' : 'Authorize')
        $('#sync-authButton').prop('disabled', authed || authorizing)
        $('#sync-authButton').toggleClass('sync-authButton-dimmed', authed || authorizing)
    }

    private toggleDialogLink = (): void => {
        const authed = this.authorizer.isAuthed()
        const anyFail = this.registeredPluginsFields.anyFail
        IITC.toolbox.updateButton('sync-show-dialog', {
            class: !authed || anyFail ? 'sync-show-dialog-error' : '',
        })
    }

    private showDialog = (): void => {
        const dialogHTML =
            '<div id="sync-dialog">' +
            '<button id="sync-authButton" class="sync-authButton-dimmed" disabled>Authorize</button>' +
            '<div id="sync-log"></div>' +
            '</div>'

        window.dialog({html: dialogHTML, title: 'Sync', modal: true, id: 'sync-setting'})

        $('#sync-authButton').on('click', () => {
            setTimeout(() => { this.authorizer.authorize() }, 1)
        })

        this.toggleAuthButton()
        this.toggleDialogLink()
        this.updateLog(this.logger.getLogs())
    }

    private setupDialog(): void {
        IITC.toolbox.addButton({
            id: 'sync-show-dialog',
            label: 'KSync',
            action: this.showDialog,
        })
    }
}

Plugin.Register(new Main, PLUGIN_NAME)

// The original plugin sets setup.priority = 'high' so it runs before dependent plugins
// (e.g. other plugins check window.plugin.sync !== undefined at setup time).
// iitcpluginkit's Register() doesn't expose priority, so we set it on the last bootPlugin entry.
if (window.bootPlugins?.length) {
    (window.bootPlugins.at(-1) as any).priority = 'high'
}
