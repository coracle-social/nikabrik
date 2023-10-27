import type {Event} from 'nostr-tools';
import type {Filter} from 'paravel'
import {createEvent, Subscription} from 'paravel';
import type {DVM} from '../dvm';
import {getInputParams, getInputValue} from '../util';

type CountWithProgressOpts = {
  dvm: DVM
  event: Event
  filters: Filter[]
  init: (sub: Subscription) => void
  getResult: () => string
}

const getGroupKey = (group: string, e: Event) => {
  if (['content', 'pubkey'].includes(group)) {
    return (e as any)[group]
  }

  if (group.match(/^created_at\/\d+$/)) {
    return Math.floor(e.created_at / parseInt(group.split('/').slice(-1)[0]))
  }

  return e.tags.find(t => t[0] === group)?.[1] || ""
}

async function* countWithProgress({dvm, event, filters, init, getResult}: CountWithProgressOpts) {
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

  yield createEvent(event.kind + 1000, {content: getResult()});
}

export async function* handleCount(dvm: DVM, event: Event) {
  const groups = getInputParams(event, 'group')

  let result = groups.length > 0 ? {} : 0

  yield* countWithProgress({
    dvm,
    event,
    filters: JSON.parse(getInputValue(event)),
    getResult: () => JSON.stringify(result),
    init: (sub: Subscription) => {
      sub.on('event', (e: Event) => {
        if (groups.length === 0) {
          (result as number)++
        } else {
          let data: any = result

          groups.forEach((group, i) => {
            const key = getGroupKey(group, e)

            if (i < groups.length - 1) {
              if (!data[key]) {
                data[key] = {}
              }

              data = data[key]
            } else {
              if (!data[key]) {
                data[key] = 0
              }

              data[key] += 1
            }
          })
        }
      })
    },
  })
}

export default {
  '5400': handleCount,
};
