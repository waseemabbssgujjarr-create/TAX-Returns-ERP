import { Module } from '@nestjs/common'

import { IRIS_SUBMISSION_PORT, StubIrisAdapter } from './iris-submission.port'

/**
 * Binds IrisSubmissionPort. Swap `useClass` for a real adapter
 * (ApiIrisAdapter / RpaIrisAdapter / ManualIrisAdapter) once FBR/IRIS
 * integration is available — see iris-submission.port.ts and
 * docs/adr/001-provider-adapters.md.
 */
@Module({
  providers: [{ provide: IRIS_SUBMISSION_PORT, useClass: StubIrisAdapter }],
  exports: [IRIS_SUBMISSION_PORT],
})
export class IrisModule {}
