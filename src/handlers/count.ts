import type {Event} from 'nostr-tools';
import {createEvent, Subscription} from 'paravel';
import type {DVM} from '../dvm';
import {getInputParams, getInputValue} from '../util';

export async function* handleCountRequest(dvm: DVM, e: Event) {
  const sub = new Subscription({
    timeout: 3000,
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

  while (!done) {
    await new Promise(resolve => setTimeout(resolve, 300));

    yield createEvent(7000, {content: results.size.toString()});
  }

  yield createEvent(6302, {content: results.size.toString()});
}

export default {'5302': handleCountRequest};
