export type LogUpdateCallback = (messages: string) => void

export class Logger {
    private logs: Record<string, { time: Date; message: string }> = {}

    constructor(
        private readonly logLimit: number,
        private readonly logUpdateCallback?: LogUpdateCallback,
    ) {}

    log(filename: string, message: string): void {
        const entity = { time: new Date(), message }

        if (filename === 'all') {
            for (const key of Object.keys(this.logs)) {
                this.logs[key] = entity
            }
        } else {
            this.logs[filename] = entity
        }

        this.trimLogs()

        if (this.logUpdateCallback) {
            this.logUpdateCallback(this.getLogs())
        }
    }

    getLogs(): string {
        return Object.entries(this.logs).map(([key, value]) =>
            `<div class="sync-log-block">` +
            `<p class="sync-log-file">${key}:</p>` +
            `<p class="sync-log-message">${value.message} (${value.time.toLocaleTimeString()})</p>` +
            `</div>`
        ).join('')
    }

    private trimLogs(): void {
        const keys = Object.keys(this.logs)
        while (keys.length > this.logLimit) {
            Reflect.deleteProperty(this.logs, keys.shift()!)
        }
    }
}
