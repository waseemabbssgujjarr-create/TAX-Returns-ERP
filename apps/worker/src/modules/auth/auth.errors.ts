export class ReplayAttackError extends Error {
  constructor() {
    super('Refresh token replay detected')
    this.name = 'ReplayAttackError'
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid refresh token')
    this.name = 'InvalidRefreshTokenError'
  }
}

export class ConcurrentRefreshError extends Error {
  constructor() {
    super('Refresh already in progress')
    this.name = 'ConcurrentRefreshError'
  }
}
