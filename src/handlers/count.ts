import type {Event} from 'nostr-tools';
import type {Filter} from 'paravel'
import {createEvent, Subscription} from 'paravel';
import type {DVM} from '../dvm';
import {getInputParams, getInputValue} from '../util';

type CountWithProgressOpts = {
  dvm: DVM
  event: Event
  kind: number
  filters: Filter[]
  init: (sub: Subscription) => void
  getResult: () => string
}

async function* countWithProgress({dvm, event, kind, filters, init, getResult}: CountWithProgressOpts) {
  const sub = new Subscription({
    filters,
    timeout: 30000,
    closeOnEose: true,
    executor: dvm.getExecutor(getInputParams(event, 'relay')),
  })

  init(sub)

  let done = false;

  sub.on('close', () => {
    done = true
  })

  while (!done) {
    await new Promise(resolve => setTimeout(resolve, 500));

    yield createEvent(7000, {content: getResult()});
  }

  yield createEvent(kind, {content: getResult()});
}

export async function* handleCount(dvm: DVM, event: Event) {
  let count = 0

  yield* countWithProgress({
    dvm,
    event,
    kind: 6400,
    filters: JSON.parse(getInputValue(event)),
    getResult: () => count.toString(),
    init: (sub: Subscription) => {
      sub.on('event', (e: Event) => {
        count += 1
      })
    },
  })
}

export async function* handleCountReactions(dvm: DVM, event: Event) {
  const result: Record<string, number> = {}

  yield* countWithProgress({
    dvm,
    event,
    kind: 6401,
    filters: [{kinds: [7], '#e': [getInputValue(event)]}],
    getResult: () => JSON.stringify(result),
    init: (sub: Subscription) => {
      sub.on('event', (e: Event) => {
        const emojiTag = e.tags.find(t => t[0] === 'emoji')
        const value = emojiTag ? emojiTag[2] : e.content

        result[value] = result[value] || 0
        result[value] += 1
      })
    },
  })
}

export default {
  '5400': handleCount,
  '5401': handleCountReactions,
  '5402': handleCountFollowers,
};
