import { connect } from "amqplib";
import { Chance } from "chance";
import { Hive, createHive } from "../lib";

type PushablePromise<T> = Promise<T[]> & { push: (item: T) => number };

type Queues = {
  Foo: { payload: { fooCount: number }; result: number };
  Bar: { payload: { bar: string }; result: string };
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
  let hives: Hive<Queues>[] = [];

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
      createHive<Queues>(
        connect(process.env.RABBITMQ_DSN as string),
        configuration
      ),
      createHive<Queues>(
        connect(process.env.RABBITMQ_DSN as string),
        configuration
      ),
    ]);

    const fooMessagesSent = [
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
      { fooCount: chance.integer() },
    ];
    const barMessagesSent = [
      { bar: chance.word() },
      { bar: chance.word() },
      { bar: chance.word() },
      { bar: chance.word() },
      { bar: chance.word() },
    ];
    const [fooMessagesReceivedPromise, barMessagesReceivedPromise] = [
      createPushablePromise<{ fooCount: number }>(fooMessagesSent.length),
      createPushablePromise<{ bar: string }>(barMessagesSent.length),
    ];

    const dispatcher = hives[0].createDispatcher();
    await hives[1].createWorker({
      Foo: {
        onMessage: async (payload) => {
          fooMessagesReceivedPromise.push(payload);

          return payload.fooCount;
        },
      },
      Bar: {
        onMessage: async (payload) => {
          barMessagesReceivedPromise.push(payload);

          return payload.bar;
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
