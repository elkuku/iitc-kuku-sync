import {Logger} from './Logger'

export class DataManager {
    private static readonly RETRY_LIMIT = 2
    private static readonly MIMETYPE_FOLDER = 'application/vnd.google-apps.folder'
    private static readonly PARENT_NAME = 'IITC-SYNC-DATA-V3'
    private static readonly PARENT_DESCRIPTION = 'Store IITC sync data'

    private static parentFolderID: string | undefined
    private static parentFolderIDRequested = false
    private static readonly instances: Record<string, DataManager> = {}

    private fileId: string | undefined
    private retryCount = 0
    private force = false

    constructor(
        private readonly logger: Logger,
        private readonly fileName: string,
        private readonly description: string,
    ) {
        this.loadFileId()
        DataManager.instances[fileName] = this
    }

    initialize(force: boolean, assignIdCallback: () => void, failedCallback: () => void): void {
        this.force = force

        if (this.retryCount >= DataManager.RETRY_LIMIT) {
            this.logger.log(this.fileName, 'Too many file operation')
            failedCallback()
            return
        }

        if (this.force) this.retryCount++

        this.initParent(assignIdCallback, failedCallback)
    }

    private initFile(assignIdCallback: () => void, failedCallback: () => void): void {
        if (!this.force && this.fileId) {
            assignIdCallback()
            return
        }

        const handleFileId = (id: string) => {
            this.fileId = id
            this.saveFileId()
            assignIdCallback()
        }

        const handleFailed = () => {
            this.fileId = undefined
            this.saveFileId()
            failedCallback()
        }

        const createCallback = (response: {result: {id: string}}) => {
            if (response.result.id) {
                handleFileId(response.result.id)
            } else {
                handleFailed()
            }
        }

        const searchCallback = (resp: {result: {files: {id: string}[]}}) => {
            if (resp.result.files.length > 0) {
                handleFileId(resp.result.files[0].id)
            } else if (resp.result.files.length === 0) {
                this.createFile(createCallback)
            } else {
                handleFailed()
            }
        }

        this.searchFile(searchCallback)
    }

    private initParent(assignIdCallback: () => void, failedCallback: () => void): void {
        if (DataManager.parentFolderID) {
            this.initFile(assignIdCallback, failedCallback)
            return
        }

        const parentAssignIdCallback = (id: string) => {
            DataManager.parentFolderID = id
            this.logger.log('all', 'Parent folder success initialized')
            if (DataManager.parentFolderIDRequested) {
                DataManager.parentFolderIDRequested = false
                return
            }
            this.initFile(assignIdCallback, failedCallback)
        }

        const parentFailedCallback = (error: GapiError) => {
            DataManager.parentFolderID = undefined
            DataManager.parentFolderIDRequested = false
            const message = error.error?.message ?? 'unknown error'
            this.logger.log('all', `Create folder operation failed: ${message}`)
            failedCallback()
        }

        if (DataManager.parentFolderIDRequested) return

        DataManager.parentFolderIDRequested = true

        const gapi = window.gapi as Gapi
        void gapi.client.load('drive', 'v3').then(() => {
            gapi.client.drive.files.list({
                q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            }).then((files: {result: {files: {id: string}[]}}) => {
                const directory = files.result.files
                if (directory.length === 0) {
                    gapi.client.drive.files.create({
                        resource: {
                            name: DataManager.PARENT_NAME,
                            description: DataManager.PARENT_DESCRIPTION,
                            mimeType: DataManager.MIMETYPE_FOLDER,
                        },
                    }).then((response: {result: {id: string}}) => { parentAssignIdCallback(response.result.id) })
                } else {
                    parentAssignIdCallback(directory[0].id)
                }
            })
        }, parentFailedCallback)
    }

    private createFile(callback: (response: {result: {id: string}}) => void): void {
        const gapi = window.gapi as Gapi
        void gapi.client.load('drive', 'v3').then(() => {
            gapi.client.drive.files.create({
                fields: 'id',
                resource: {
                    name: this.fileName,
                    description: this.description,
                    parents: [DataManager.parentFolderID!],
                },
            }).then(callback)
        })
    }

    readFile(
        needInitializeFileCallback: () => void,
        onFileLoadedCallback: (data: unknown) => void,
        handleError: (error: GapiError) => void,
    ): void {
        const gapi = window.gapi as Gapi
        void gapi.client.load('drive', 'v3').then(
            () => {
                gapi.client.drive.files.get({
                    fileId: this.fileId!,
                    alt: 'media',
                }).then(
                    (response: {result: unknown}) => {
                        if (response.result) {
                            onFileLoadedCallback(response.result)
                        } else {
                            needInitializeFileCallback()
                        }
                    },
                    handleError,
                )
            },
            handleError,
        )
    }

    saveFile(data: object): void {
        const gapi = window.gapi as Gapi
        void gapi.client.load('drive', 'v3').then(() => {
            gapi.client.request({
                path: `/upload/drive/v3/files/${this.fileId!}`,
                method: 'PATCH',
                params: {uploadType: 'media'},
                body: JSON.stringify(data),
            }).execute()
        })
    }

    private searchFile(callback: GapiListCallback): void {
        const gapi = window.gapi as Gapi
        void gapi.client.load('drive', 'v3').then(() => {
            gapi.client.drive.files.list(this.getSearchOption()).execute(callback)
        })
    }

    private getSearchOption(): {q: string} {
        return {
            q: `name = "${this.fileName}" and trashed = false and "${DataManager.parentFolderID!}" in parents`,
        }
    }

    private localStorageKey(): string {
        return `sync-file-${this.fileName}`
    }

    private saveFileId(): void {
        if (this.fileId) {
            localStorage.setItem(this.localStorageKey(), this.fileId)
        } else {
            localStorage.removeItem(this.localStorageKey())
        }
    }

    private loadFileId(): void {
        const stored = localStorage.getItem(this.localStorageKey())
        if (stored) this.fileId = stored
    }
}
