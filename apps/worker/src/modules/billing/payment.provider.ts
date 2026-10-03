export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER')

/** Stub contract for external payment gateways (Stripe, local bank rails, etc.). */
export interface PaymentProvider {
  createPaymentIntent(input: {
    firmId: string
    invoiceId: string
    amountPaisa: string
    currency: 'PKR'
  }): Promise<{ intentId: string; clientReference: string }>

  capturePayment(input: {
    firmId: string
    intentId: string
  }): Promise<{ status: 'succeeded' | 'failed' | 'pending'; reference?: string }>
}

export class StubPaymentProvider implements PaymentProvider {
  createPaymentIntent(): Promise<{ intentId: string; clientReference: string }> {
    return Promise.reject(new Error('PaymentProvider is not configured'))
  }

  capturePayment(): Promise<{ status: 'failed' }> {
    return Promise.reject(new Error('PaymentProvider is not configured'))
  }
}
