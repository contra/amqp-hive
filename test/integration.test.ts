import { connect } from "amqplib";
import { Chance } from "chance";
import { Hive, createHive } from "../lib";

type PushablePromise<T> = Promise<T[]> & { push: (item: T) => number };

type PayloadsByQueueName = {
  Foo: { fooCount: number };
  Bar: { barCount: number };
};

const chance = Chance();

const createPushablePromise = <T>(
  resolveAtCount: number
): PushablePromise<T> => {
  let resolvePromise: ((value: T[]) => void) | undefined = undefined;
  const promise = new Promise<T[]>((resolve) => {
    resolvePromise = resolve;
  });
  const items: T[] = [];

  Object.assign(promise, {
    push: (item: T) => {
      const length = items.push(item);

      if (length === resolveAtCount) {
        resolvePromise!(items);
      }

      return length;
    },
    items,
  });

  return promise as PushablePromise<T>;
};

describe("Basic functionality", () => {
  let hives: Hive<PayloadsByQueueName>[] = [];

  afterEach(async () => {
    await Promise.all(
      hives.map(async (hive) => {
        await hive.destroy();
        await hive.connection.close();
      })
    );
  });

  test("Dispatches tasks to workers", async () => {
    const configuration = {
      queues: {
        Foo: {},
        Bar: {},
      },
    };
    hives = await Promise.all([
      createHive<PayloadsByQueueName>(
        connect(process.env.RABBITMQ_DSN as string),
        configuration
      ),
      createHive<PayloadsByQueueName>(
        connect(process.env.RABBITMQ_DSN as string),
        configuration
      ),
    ]);

    const fooMessagesSent: PayloadsByQueueName["Foo"][] = [
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
    ];
    const barMessagesSent: PayloadsByQueueName["Bar"][] = [
      { barCount: chance.integer() },
      { barCount: chance.integer() },
      { barCount: chance.integer() },
      { barCount: chance.integer() },
      { barCount: chance.integer() },
    ];
    const [fooMessagesReceivedPromise, barMessagesReceivedPromise] = [
      createPushablePromise<PayloadsByQueueName["Foo"]>(fooMessagesSent.length),
      createPushablePromise<PayloadsByQueueName["Bar"]>(barMessagesSent.length),
    ];

    const dispatcher = hives[0].createDispatcher();
    await hives[1].createWorker({
      Foo: {
        onMessage: async (payload) => {
          fooMessagesReceivedPromise.push(payload);
        },
      },
      Bar: {
        onMessage: async (payload) => {
          barMessagesReceivedPromise.push(payload);
        },
      },
    });

    for (const message of fooMessagesSent) {
      await dispatcher.dispatch("Foo", message);
    }
    for (const message of barMessagesSent) {
      await dispatcher.dispatch("Bar", message);
    }

    const fooMessagesReceived = await fooMessagesReceivedPromise;
    const barMessagesReceived = await barMessagesReceivedPromise;

    expect(fooMessagesReceived).toEqual(fooMessagesSent);
    expect(barMessagesReceived).toEqual(barMessagesSent);
  });
});
