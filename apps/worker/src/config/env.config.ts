/**
 * NestJS ConfigModule factory.
 * Returns typed config object from validated env vars.
 */
export const envConfig = () => ({
  database: {
    url: process.env['DATABASE_URL'],
    migrationsUrl: process.env['DATABASE_MIGRATIONS_URL'] ?? process.env['DATABASE_DIRECT_URL'],
  },
  redis: {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  },
  storage: {
    // local|s3|google-drive. Production MUST be google-drive — local is dev/E2E-only
    // and is refused at StorageModule init when NODE_ENV=production.
    driver: process.env['STORAGE_DRIVER'] ?? 's3',
    endpoint: process.env['S3_ENDPOINT'],
    region: process.env['S3_REGION'],
    bucket: process.env['S3_BUCKET'],
    accessKeyId: process.env['S3_ACCESS_KEY_ID'],
    secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'],
    signedUrlExpiry: parseInt(process.env['S3_SIGNED_URL_EXPIRY'] ?? '900', 10),
    localRoot: process.env['LOCAL_STORAGE_ROOT'],
  },
  google: {
    clientId: process.env['GOOGLE_OAUTH_CLIENT_ID'],
    clientSecret: process.env['GOOGLE_OAUTH_CLIENT_SECRET'],
    redirectUri: process.env['GOOGLE_OAUTH_REDIRECT_URI'],
  },
  auth: {
    jwtAccessSecret: process.env['JWT_ACCESS_SECRET'],
    jwtRefreshSecret: process.env['JWT_REFRESH_SECRET'],
  },
  openai: {
    // Key accessed only inside AiExtractionModule — never logged or exposed
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
    extractionModel: process.env['OPENAI_EXTRACTION_MODEL'] ?? 'gpt-4o',
    classificationModel: process.env['OPENAI_CLASSIFICATION_MODEL'] ?? 'gpt-4o-mini',
  },
  encryption: {
    masterKey: process.env['ENCRYPTION_MASTER_KEY'],
  },
  otp: {
    contactSecret: process.env['OTP_CONTACT_SECRET'],
  },
})
