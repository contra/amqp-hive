import { Channel, Connection, Message, Options } from "amqplib";

export type Hive<TQueues extends Record<string, WorkerQueue>> = {
  channel: Channel;
  configuration: HiveConfiguration<TQueues>;
  connection: Connection;
  createDispatcher: () => Dispatcher<TQueues>;
  createWorker: <TContext>(
    queues: WorkerQueues<TQueues, TContext>,
    context?: TContext
  ) => Promise<Worker<TQueues>>;
  destroy: () => Promise<void>;
};

export type HiveConfiguration<TQueues extends Record<string, WorkerQueue>> = {
  exchanges?: Record<
    "direct" | "delayed",
    {
      name?: string;
      options?: Options.AssertExchange;
    }
  >;
  queues: Record<
    keyof TQueues,
    {
      isDelayed?: boolean;
      options?: Options.AssertQueue;
      publishOptions?: Options.Publish;
    }
  >;
};

export type Dispatcher<TQueues extends Record<string, WorkerQueue>> = {
  dispatch: <TName extends keyof TQueues>(
    queueName: TName,
    payload: TQueues[TName]["payload"],
    options?: Options.Publish & { delay?: number }
  ) => Promise<boolean>;
};

export type Worker<TQueues extends Record<string, WorkerQueue>> = {
  queues: Record<
    keyof TQueues,
    {
      consumerTag: string;
    }
  >;
};

export type WorkerQueue = {
  payload: any;
  result: any;
};

export type WorkerQueues<TQueues extends Record<string, any>, TContext> = {
  [TQueueName in keyof TQueues]: {
    onMessage: OnMessage<TQueues, TQueueName, TContext>;
    options?: { consumeOptions?: Options.Consume };
  };
};

export type WorkerQueueConfiguration<
  TQueues extends Record<string, WorkerQueue>,
  TContext
> = {
  [TQueueName in keyof TQueues]: {
    consumeOptions?: Options.Consume;
    onMessage: OnMessage<TQueues, TQueueName, TContext>;
    onReady: (consumerTag: string) => void;
  };
};

export type OnMessage<
  TQueues extends Record<string, WorkerQueue>,
  TQueueName extends keyof TQueues,
  TContext
> = (
  payload: TQueues[TQueueName]["payload"],
  context: { message: Message } & TContext
) => Promise<TQueues[TQueueName]["result"]>;
