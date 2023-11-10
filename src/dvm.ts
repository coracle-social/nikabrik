import type {Event, EventTemplate} from 'nostr-tools';
import {getSignature, getPublicKey, getEventHash} from 'nostr-tools';
import {now, Subscription, Pool, Relays, Executor} from 'paravel';
import {getInputTag} from './util';

export type DVMHandler = (dvm: DVM, e: Event) => AsyncGenerator<EventTemplate>;

export type DVMOpts = {
  sk: string;
  relays: string[];
  handlers: Record<string, DVMHandler>;
};

export class DVM {
  seen = new Set();
  pool = new Pool();
  stopped = false;

  constructor(readonly opts: DVMOpts) {
    this.listen();
  }

  getExecutor(urls: string[]) {
    return new Executor(
      new Relays(
        urls.map(url => {
          const connection = this.pool.get(url);

          connection.socket.ready.catch(() => null);

          return connection;
        })
      )
    );
  }

  async listen() {
    const {handlers, relays} = this.opts;
    const kinds = Array.from(Object.keys(handlers)).map(k => parseInt(k));

    this.stopped = false;

    while (!this.stopped) {
      await new Promise<void>(resolve => {
        const sub = new Subscription({
          timeout: 30_000,
          executor: this.getExecutor(relays),
          filters: [{kinds, since: now() - 30}],
        });

        sub.on('event', e => this.onEvent(e));
        sub.on('close', () => resolve());
      });
    }
  }

  async onEvent(e: Event) {
    if (this.seen.has(e.id)) {
      return;
    }

    const handler = this.opts.handlers[e.kind];

    if (!handler) {
      return;
    }

    this.seen.add(e.id);

    if (process.env.NIKABRIK_ENABLE_LOGGING) {
      console.info('Handling request', e);
    }

    for await (const event of handler(this, e)) {
      if (event.kind !== 7000) {
        event.tags.push(['request', JSON.stringify(e)]);
        event.tags.push(getInputTag(e)!);
      }

      event.tags.push(['p', e.pubkey]);
      event.tags.push(['e', e.id]);

      if (process.env.NIKABRIK_ENABLE_LOGGING) {
        console.info('Publishing event', event);
      }

      this.publish(event);
    }
  }

  async publish(template: EventTemplate) {
    const {sk, relays} = this.opts;
    const executor = this.getExecutor(relays);
    const event = template as any;

    event.pubkey = getPublicKey(sk);
    event.id = getEventHash(event);
    event.sig = getSignature(event, sk);

    await new Promise<void>(resolve => {
      const done = () => {
        resolve();
        executor.target.cleanup();
      };

      executor.publish(event, {
        verb: 'EVENT',
        onOk: done,
        onError: done,
      });
    });
  }

  stop() {
    this.pool.clear();
    this.stopped = true;
  }
}
