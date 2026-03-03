import {Logger} from './Logger'

export type AuthCallback = () => void

export class Authorizer {
    private static readonly API_KEY = 'AIzaSyBeVNFEHh35baf5y9miCjaw43L61BTeyhg'
    private static readonly DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    private static readonly CLIENT_ID = '1099227387115-osrmhfh1i6dto7v7npk4dcpog1cnljtb.apps.googleusercontent.com'
    private static readonly SCOPES = 'https://www.googleapis.com/auth/drive.file'

    private authorizing = false
    private authorized = false
    private readonly callbacks: AuthCallback[]

    constructor(
        private readonly logger: Logger,
        authCallbacks: AuthCallback[],
    ) {
        this.callbacks = [...authCallbacks]
        this.authorize = this.authorize.bind(this)
    }

    isAuthed(): boolean {
        return this.authorized
    }

    isAuthorizing(): boolean {
        return this.authorizing
    }

    addAuthCallback(callback: AuthCallback): void {
        this.callbacks.push(callback)
    }

    private authComplete(): void {
        this.authorizing = false
        for (const authCallback of this.callbacks) {
            authCallback()
        }
    }

    private updateSigninStatus(isSignedIn: boolean): void {
        this.authorizing = false
        if (isSignedIn) {
            this.authorized = true
            this.logger.log('all', 'Authorized')
            this.authComplete()
        } else {
            this.authorized = false
            this.logger.log('all', 'Not authorized')
            const gapi = window.gapi as Gapi
            gapi.auth2.getAuthInstance().signIn()
        }
    }

    authorize(): void {
        this.authorizing = true
        this.authorized = false

        const gapi = window.gapi as Gapi
        void gapi.client.init({
            apiKey: Authorizer.API_KEY,
            discoveryDocs: Authorizer.DISCOVERY_DOCS,
            client_id: Authorizer.CLIENT_ID,
            scope: Authorizer.SCOPES,
        }).then(() => {
            const authInstance = gapi.auth2.getAuthInstance()
            authInstance.isSignedIn.listen(
                (signedIn: boolean) => { this.updateSigninStatus(signedIn) }
            )
            this.updateSigninStatus(authInstance.isSignedIn.get())
        })
    }
}
