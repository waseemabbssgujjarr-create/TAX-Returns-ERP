import { SetMetadata } from '@nestjs/common'

export type FirmIdSource = 'param.firmId' | 'body.firmId'

export const FIRM_ID_FROM_KEY = 'firmIdFrom'
export const FirmIdFrom = (source: FirmIdSource) => SetMetadata(FIRM_ID_FROM_KEY, source)
