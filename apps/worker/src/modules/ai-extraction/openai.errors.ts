export class OpenAiNotConfiguredError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured')
    this.name = 'OpenAiNotConfiguredError'
  }
}

export class OpenAiExtractionError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'OpenAiExtractionError'
  }
}
