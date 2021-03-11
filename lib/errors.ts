export class QueueConsumerInitializationFailureError extends Error {
  public originalError: Error;

  constructor(queueName: string, originalError: any) {
    super(`Failed to initialize consumer for queue ${queueName}`);
    this.originalError = originalError;
  }
}
