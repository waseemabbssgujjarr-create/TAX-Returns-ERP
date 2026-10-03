import { SetMetadata } from '@nestjs/common'

export const ALLOW_PARTIAL_SESSION_KEY = 'allowPartialSession'
export const AllowPartialSession = () => SetMetadata(ALLOW_PARTIAL_SESSION_KEY, true)
