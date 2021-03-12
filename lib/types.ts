import { Connection, Message, Options } from "amqplib";

export type Hive<TPayloadsByQueueName extends Record<string, any>> = {
  configuration: HiveConfiguration<TPayloadsByQueueName>;
  connection: Connection;
  createDispatcher: () => Dispatcher<TPayloadsByQueueName>;
  createWorker: <TContext>(
    queues: WorkerQueues<TPayloadsByQueueName, TContext>,
    context?: TContext
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

export type WorkerQueues<
  TPayloadsByQueueName extends Record<string, any>,
  TContext
> = {
  [TQueueName in keyof TPayloadsByQueueName]: {
    onMessage: OnMessage<TPayloadsByQueueName, TQueueName, TContext>;
    options?: { consumeOptions?: Options.Consume };
  };
};

export type WorkerQueueConfiguration<
  TPayloadsByQueueName extends Record<string, any>,
  TContext
> = {
  [TQueueName in keyof TPayloadsByQueueName]: {
    consumeOptions?: Options.Consume;
    onMessage: OnMessage<TPayloadsByQueueName, TQueueName, TContext>;
    onReady: (consumerTag: string) => void;
  };
};

export type OnMessage<
  TPayloadsByQueueName extends Record<string, any>,
  TQueueName extends keyof TPayloadsByQueueName,
  TContext
> = (
  payload: TPayloadsByQueueName[TQueueName],
  context: { message: Message } & TContext
) => Promise<void>;
