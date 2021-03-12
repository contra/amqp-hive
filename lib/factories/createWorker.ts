import { Channel } from "amqplib";
import { QueueConsumerInitializationFailureError } from "../errors";
import { Worker, WorkerQueueConfiguration } from "../types";

type WorkerConfiguration<
  TPayloadsByQueueName extends Record<string, any>,
  TContext
> = {
  channel: Channel;
  queueConfigurations: WorkerQueueConfiguration<TPayloadsByQueueName, TContext>;
  context: TContext;
};

export const createWorker = async <
  TPayloadsByQueueName extends Record<string, any>,
  TContext
>({
  channel,
  queueConfigurations,
  context,
}: WorkerConfiguration<TPayloadsByQueueName, TContext>): Promise<
  Worker<TPayloadsByQueueName>
> => {
  const queues = {} as Worker<TPayloadsByQueueName>["queues"];

  await Promise.all(
    Object.keys(queueConfigurations).map(async (name) => {
      const { consumeOptions, onMessage, onReady } = queueConfigurations[name]!;
      try {
        const { consumerTag } = await channel.consume(
          name as string,
          async (message) => {
            // Note: message will be null if the consumer is cancelled by RabbitMQ (https://www.rabbitmq.com/consumer-cancel.html)
            if (message) {
              try {
                await onMessage(JSON.parse(message.content.toString()), {
                  ...context,
                  message,
                });
                channel.ack(message);
              } catch (error) {
                channel.nack(message, false, false);
              }
            }
          },
          {
            ...consumeOptions,
          }
        );

        onReady(consumerTag);

        queues[name as keyof TPayloadsByQueueName] = { consumerTag };
      } catch (error) {
        throw new QueueConsumerInitializationFailureError(name, error);
      }
    })
  );

  return {
    queues,
  };
};
