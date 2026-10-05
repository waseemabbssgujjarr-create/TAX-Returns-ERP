/** Google Drive per-user storage — fixed constants. */

/** Minimal, app-scoped Drive access — only files/folders this app creates. No full-Drive access. */
export const GOOGLE_DRIVE_OAUTH_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'

export const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
export const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
export const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

/** Root + fixed subfolder names — "TaxDesk PK/Clients/<clientId>/<taxYear>". */
export const DRIVE_ROOT_FOLDER_NAME = 'TaxDesk PK'
export const DRIVE_CLIENTS_FOLDER_NAME = 'Clients'

/** OAuth state TTL — short-lived, single-use CSRF/replay protection. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60

export const GOOGLE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
