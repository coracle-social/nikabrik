import 'dotenv/config';

import {DVM} from './dvm';
import countAgents from './agents/count';
import searchAgents from './agents/search';

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
  });

const sk = process.env.NIKABRIK_SK as string;
const relays = process.env.NIKABRIK_RELAYS as string;

export const dvm = new DVM({
  sk,
  relays: relays.split(','),
  agents: {
    ...countAgents,
    ...searchAgents,
  },
});

if (process.env.NIKABRIK_ENABLE_LOGGING) {
  console.info(
    `Started dvm with ${Object.keys(dvm.opts.agents).length} agents`
  );
}
