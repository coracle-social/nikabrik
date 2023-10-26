import type {Event} from 'nostr-tools';
import {createEvent, Subscription} from 'paravel';
import type {DVM} from '../dvm';
import {getInputParams, getInputValue} from '../util';

export async function* handleCountRequest(dvm: DVM, e: Event) {
  const sub = new Subscription({
    timeout: 30000,
    closeOnEose: true,
    filters: JSON.parse(getInputValue(e)),
    executor: dvm.getExecutor(getInputParams(e, 'relay')),
  })

  const results = new Set();

  sub.on('event', e => results.add(e.id))

  let done = false;

  sub.on('close', () => {
    done = true
  })

  let count = 0

  while (!done) {
    await new Promise(resolve => setTimeout(resolve, 300));

    if (count !== results.size) {
      count = results.size

      yield createEvent(7000, {content: count.toString()});
    }
  }

  yield createEvent(6400, {content: results.size.toString()});
}

export default {'5400': handleCountRequest};
