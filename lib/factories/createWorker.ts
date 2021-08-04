import { Channel } from "amqplib";
import { QueueConsumerInitializationFailureError } from "../errors";
import { Worker, WorkerQueue, WorkerQueueConfiguration } from "../types";

type WorkerConfiguration<
  TQueues extends Record<string, WorkerQueue>,
  TContext
> = {
  channel: Channel;
  queueConfigurations: WorkerQueueConfiguration<TQueues, TContext>;
  context: TContext;
};

export const createWorker = async <
  TQueues extends Record<string, WorkerQueue>,
  TContext
>({
  channel,
  queueConfigurations,
  context,
}: WorkerConfiguration<TQueues, TContext>): Promise<Worker<TQueues>> => {
  const queues = {} as Worker<TQueues>["queues"];

  await Promise.all(
    Object.keys(queueConfigurations).map(async (name) => {
      const {
        consumeOptions,
        onMessage,
        onReady,
        prefetchCount = 1,
      } = queueConfigurations[name]!;
      try {
        await channel.prefetch(prefetchCount);
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

        queues[name as keyof TQueues] = { consumerTag };
      } catch (error) {
        throw new QueueConsumerInitializationFailureError(name, error);
      }
    })
  );

  return {
    queues,
  };
};
