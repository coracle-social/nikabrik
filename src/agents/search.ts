import type {Event} from 'nostr-tools';
import {Navigator} from 'navigatr';
import {createEvent, now} from 'paravel';
import Fuse from 'fuse.js';
import {throttle, tryFunc, seconds} from 'hurdak';
import type {DVM} from '../dvm';
import {getInputValue} from '../util';

type Result = {
  name: string;
  nip05: string;
  about: string;
  pubkey: string;
  seen_on: string;
  created_at: number;
};

type SearchAgentOpts = {
  relays: string[];
};

export const configureSearchAgent = (opts: SearchAgentOpts) => (dvm: DVM) => {
  let timeout: any;
  let search: (term: string) => Result[];

  const people = new Map<string, Result>();

  const nav = new Navigator({
    timeout: 10_000,
    relays: opts.relays,
    filters: [{kinds: [0]}],
  });

  const updateSearch = throttle(1000, () => {
    const keys = ['nip05', 'name', {name: 'about', weight: 0.3}];
    const fuse = new Fuse(Array.from(people.values()), {keys});

    search = (term: string) =>
      fuse
        .search(term)
        .slice(0, 20)
        .map(r => r.item);
  });

  const scrape = async () => {
    await nav.scrapeAll();

    timeout = setTimeout(scrape, seconds(1, 'hour'));
  };

  scrape();
  updateSearch();

  nav.on('event', (url: string, e: Event) => {
    const result = people.get(e.pubkey);

    if (result && result.created_at > e.created_at) {
      return;
    }

    const profile = tryFunc(() => JSON.parse(e.content));

    if (!profile) {
      return;
    }

    people.set(e.pubkey, {
      seen_on: url,
      pubkey: e.pubkey,
      created_at: e.created_at,
      name: profile.name,
      nip05: profile.nip05,
      about: profile.about,
    });

    updateSearch();
  });

  return {
    stop: () => {
      clearTimeout(timeout);
      nav.cleanup();
    },
    handleEvent: async function* (event: Event) {
      const tags = search(getInputValue(event)).map(p => [
        'p',
        p.pubkey,
        p.seen_on,
        p.name,
      ]);

      yield createEvent(event.kind + 1000, {
        content: JSON.stringify(tags),
        tags: [['expiration', String(now() + seconds(1, 'hour'))]],
      });
    },
  };
};

export default {
  '5401': configureSearchAgent({
    relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  }),
};
