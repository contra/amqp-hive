import { Connection } from "amqplib";
import {
  Hive,
  HiveConfiguration,
  Worker,
  WorkerQueueConfiguration,
  WorkerQueues,
} from "../types";
import { createDispatcher } from "./createDispatcher";
import { createWorker } from "./createWorker";

export const createHive = async <
  TPayloadsByQueueName extends Record<string, any>
>(
  connectionOrConnectionPromise: Connection | Promise<Connection>,
  configuration: HiveConfiguration<TPayloadsByQueueName>
): Promise<Hive<TPayloadsByQueueName>> => {
  const connection =
    "then" in connectionOrConnectionPromise
      ? await connectionOrConnectionPromise
      : connectionOrConnectionPromise;
  const channel = await connection.createChannel();
  const consumerTags: string[] = [];

  // Assert exchanges
  const exchanges = {
    direct: await channel.assertExchange(
      configuration.exchanges?.direct?.name || "amqp-hive-direct",
      "direct",
      {
        ...configuration.exchanges?.direct?.options,
      }
    ),
    delayed: await channel.assertExchange(
      configuration.exchanges?.delayed?.name || "amqp-hive-delayed",
      "x-delayed-message",
      {
        ...configuration.exchanges?.delayed?.options,
        arguments: {
          ...configuration.exchanges?.delayed?.options?.arguments,
          "x-delayed-type": "direct",
        },
      }
    ),
  };

  // Assert queues
  await Promise.all(
    Object.keys(configuration.queues).map(async (queueName) => {
      const { queue } = await channel.assertQueue(queueName, {
        ...configuration.queues[queueName]?.options,
      });
      const { isDelayed } = configuration.queues[queueName];
      const { exchange } = isDelayed ? exchanges.delayed : exchanges.direct;
      await channel.bindQueue(queue, exchange, queue);
    })
  );

  return {
    configuration,
    channel,
    connection,
    createDispatcher: () => {
      return createDispatcher({ channel, configuration, exchanges });
    },
    createWorker: async <TContext>(
      queues: WorkerQueues<TPayloadsByQueueName, TContext>,
      context?: TContext
    ): Promise<Worker<TPayloadsByQueueName>> => {
      // We add a `onReady` callback onto the provided configurations so we can keep track of
      // each consumer and `cancel` each one when `destroy` is called.
      return createWorker({
        channel,
        context,
        queueConfigurations: Object.keys(queues).reduce(
          (acc, queueName: keyof TPayloadsByQueueName) => {
            const { onMessage, options: { consumeOptions } = {} } = queues[
              queueName
            ];
            acc[queueName] = {
              consumeOptions,
              onMessage,
              onReady: (consumerTag) => consumerTags.push(consumerTag),
            };
            return acc;
          },
          {} as WorkerQueueConfiguration<TPayloadsByQueueName, any>
        ),
      });
    },
    destroy: async () => {
      await Promise.all(
        consumerTags.map((consumerTag) => {
          return channel.cancel(consumerTag);
        })
      );
      await channel.close();
    },
  };
};
