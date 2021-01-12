import fetch from 'node-fetch';
import { createLogger } from '../logger';

const logger = createLogger('priceFeed');

export async function getEthToBtcRatio(): Promise<number> {
  logger.debug('fetching eth/btc ratio from coingecko...');
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=btc');
  const json = await res.json();
  const ratio = json.ethereum.btc;
  logger.debug(`eth/btc ratio is: ${ratio}`);

  return ratio;
}
