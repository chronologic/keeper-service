import { BigNumber, BigNumberish } from 'ethers';
import fetch from 'node-fetch';

import { ETH_DECIMALS, MINUTE_MILLIS } from '../constants';
import { createLogger } from '../logger';
import { bnToNumberEth, createTimedCache, numberToBnEth, satoshiToWei } from '../utils';

interface IPrices {
  bitcoin: {
    eth: number;
    usd: number;
  };
  ethereum: {
    btc: number;
    usd: number;
  };
}

const logger = createLogger('priceFeed');
const cache = createTimedCache<IPrices>(MINUTE_MILLIS);

export async function fetchSatoshiToWeiPrice(satoshi: BigNumberish): Promise<BigNumber> {
  const btcToEth = await fetchBtcToEthRatio();
  const ratioWei = numberToBnEth(btcToEth);
  const satoshiInWei = satoshiToWei(satoshi);
  return satoshiInWei.mul(ratioWei).div(BigNumber.from(10).pow(ETH_DECIMALS));
}

export async function fetchWeiToUsdPrice(wei: BigNumberish): Promise<number> {
  const ethToUsd = await fetchEthToUsdRatio();
  const ratioWei = numberToBnEth(ethToUsd);
  const weiInUsd = BigNumber.from(wei).mul(ratioWei).div(BigNumber.from(10).pow(ETH_DECIMALS));
  console.log(ethToUsd, BigNumber.from(wei).toString(), ratioWei.toString(), weiInUsd.toString());
  return bnToNumberEth(weiInUsd);
}

export async function fetchEthToBtcRatio(): Promise<number> {
  const prices = await fetchPrices();

  return prices.ethereum.btc;
}

export async function fetchBtcToEthRatio(): Promise<number> {
  const prices = await fetchPrices();

  return prices.bitcoin.eth;
}

export async function fetchEthToUsdRatio(): Promise<number> {
  const prices = await fetchPrices();

  return prices.ethereum.usd;
}

export async function fetchBtcToUsdRatio(): Promise<number> {
  const prices = await fetchPrices();

  return prices.bitcoin.usd;
}

async function fetchPrices(): Promise<IPrices> {
  const cacheKey = 'prices';
  const cachedVal = cache.get(cacheKey);

  if (cachedVal) {
    logger.debug(`cached prices are: ${JSON.stringify(cachedVal)}`);
    return cachedVal;
  }

  logger.debug('fetching prices from coingecko...');
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=btc,eth,usd'
  );
  const json = await res.json();
  cache.put(cacheKey, json);

  logger.debug(`prices are: ${JSON.stringify(json)}`);

  return json;
}
