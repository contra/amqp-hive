import { Dispatcher, HiveConfiguration } from "../types";
import { Channel, Replies } from "amqplib";

export const createDispatcher = <
  TPayloadsByQueueName extends Record<string, any>
>({
  channel,
  configuration,
  exchanges,
}: {
  channel: Channel;
  configuration: HiveConfiguration<TPayloadsByQueueName>;
  exchanges: Record<"direct" | "delayed", Replies.AssertExchange>;
}): Dispatcher<TPayloadsByQueueName> => {
  return {
    dispatch: async (queueName, payload, options = {}) => {
      const { isDelayed = false, publishOptions } = configuration.queues[
        queueName
      ];
      const { delay, ...otherPublishOptions } = options;

      const headers = {
        ...publishOptions?.headers,
        ...otherPublishOptions?.headers,
      };

      if (delay) {
        headers["x-delay"] = delay;
      }
      const { exchange } = isDelayed ? exchanges.delayed : exchanges.direct;

      return channel.publish(
        exchange,
        queueName as string,
        Buffer.from(JSON.stringify(payload)),
        {
          ...publishOptions,
          ...otherPublishOptions,
          headers,
        }
      );
    },
  };
};
