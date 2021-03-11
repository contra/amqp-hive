# AMQP Hive 🐝

> Easy, type-safe worker (bee) processes using AMQP. Offload resource-intensive jobs so you can get back to making that honey 🍯.

## Installation

```
npm install amqp-hive
```

## Usage

Create a TypeScript type mapping the name of each job queue to its payload.

```ts
type Payloads = {
  sendEmail: { emailAddress: string; body: string };
};
```

> Note: You can skip this step if not using TypeScript, but you will not have completion or type safety when dispatching jobs or creating workers.

Whether you're creating a dispatcher or worker, first create a Hive instance.

```ts
const hive = createHive<Payloads>(connection, {
  queues: {
    sendEmail: {
      // queue configuration
    },
  },
});
```

> Note: The connection you pass to `createHive` should be a `Connection` object returned by `ampqlib`'s `connect` function. You may also pass in a Promise that will resolve to a `Connection` instead.

Create a dispatcher instance and dispatch jobs.

```ts
const dispatcher = hive.createDispatcher();

await dispatcher.dispatch("sendEmail", {
  emailAddress: "some@email.com",
  body: "Hello!",
});
```

Create a worker that processes jobs from a specific queue:

```ts
const dispatcher = await hive.createWorker(
  sendEmail: {
    onMessage: async ({ emailAddrss, body }) => {
      // process the job
    },
  },
);
```

The worker's `onMessage` function returns a Promise. If the Promise resolves, the message is acknowledged. If the Promise rejects, the message is rejected and will be dropped, dead-lettered or retried depending on the queue configuration.

## Configuration

```ts
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
```

Each job queue accepts some additional, optional parameters:

- `isDelayed` -- whether this queue accepts delayed messages.
- `options` -- the object passed to `Channel.assertQueue` when initializing a queue.
- `publishOptions` -- the object passed to `Channel.publish` when this method is called under the hood by `Dispatcher.dispatch`.

When creating a `Hive`, two exchanges are created (one for regular messages and one for delayed ones). Each exchange can be optionally configured with a different `name` and additional `options` that will be passed to `assertExchange`.

> Note: The configuration object passed to each `Hive` instance should be identical since exchanges and channels will be asserted with the provided options whenever `createHive` is called.
