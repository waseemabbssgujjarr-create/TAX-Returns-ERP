import { Injectable } from '@nestjs/common'

/**
 * Spec 02 will map portal contacts to clientId via ClientPortalAccess.
 * Phase 1 stub — always returns null (portal verify fails closed).
 */
@Injectable()
export class PortalClientLookup {
  resolveClientId(_firmId: string, _contactHmac: string): Promise<string | null> {
    void _firmId
    void _contactHmac
    return Promise.resolve(null)
  }
}
