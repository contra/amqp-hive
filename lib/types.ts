import { Connection, Options } from "amqplib";

export type Hive<TPayloadsByQueueName extends Record<string, any>> = {
  configuration: HiveConfiguration<TPayloadsByQueueName>;
  connection: Connection;
  createDispatcher: () => Dispatcher<TPayloadsByQueueName>;
  createWorker: (
    queues: {
      [Name in keyof TPayloadsByQueueName]: {
        onMessage: (payload: TPayloadsByQueueName[Name]) => Promise<void>;
        options?: { consumeOptions?: Options.Consume };
      };
    }
  ) => Promise<Worker<TPayloadsByQueueName>>;
  destroy: () => Promise<void>;
};

export type HiveConfiguration<
  TPayloadsByQueueName extends Record<string, any>
> = {
  exchanges?: Record<
    "direct" | "delayed",
    {
      name?: string;
      options?: Options.AssertExchange;
    }
  >;
  queues: Record<
    keyof TPayloadsByQueueName,
    {
      isDelayed?: boolean;
      options?: Options.AssertQueue;
      publishOptions?: Options.Publish;
    }
  >;
};

export type Dispatcher<TPayloadsByQueueName extends Record<string, any>> = {
  dispatch: <TName extends keyof TPayloadsByQueueName>(
    queueName: TName,
    payload: TPayloadsByQueueName[TName],
    options?: Options.Publish & { delay?: number }
  ) => Promise<boolean>;
};

export type Worker<TPayloadsByQueueName extends Record<string, any>> = {
  queues: Record<
    keyof TPayloadsByQueueName,
    {
      consumerTag: string;
    }
  >;
};

export type WorkerQueueConfiguration<
  TPayloadsByQueueName extends Record<string, any>
> = {
  [QueueName in keyof TPayloadsByQueueName]: {
    consumeOptions?: Options.Consume;
    onMessage: (payload: TPayloadsByQueueName[QueueName]) => Promise<void>;
    onReady: (consumerTag: string) => void;
  };
};
