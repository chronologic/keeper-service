import { BigNumber } from 'ethers';

import { btcClient, ethClient } from '../clients';
import { tbtcToken } from '../contracts';
import { MIN_SYSTEM_BTC_BALANCE, MIN_SYSTEM_ETH_BALANCE, MIN_SYSTEM_TBTC_BALANCE } from '../env';
import { createLogger } from '../logger';
import { bnToNumberBtc, bnToNumberEth, numberToBnBtc, numberToBnEth } from '../utils';
import emailService from './emailService';

const logger = createLogger('systemAccountingHelper');

let currentTbtcBalance = BigNumber.from(0);
let currentEthBalance = BigNumber.from(0);
let currentBtcBalance = 0;

async function rememberSystemBalances(): Promise<void> {
  logger.info('Remembering system balances...');
  currentTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  currentEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  currentBtcBalance = confirmed;
  logger.info('Remembered system balances.');
}

async function compareSystemBalances(): Promise<void> {
  logger.info('Comparing system balances with remembered values...');
  const newTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const newEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  const newBtcBalance = confirmed;

  const minTbtcBalance = currentTbtcBalance.mul(99).div(100);
  if (newTbtcBalance.lt(minTbtcBalance)) {
    logger.error(
      `TBTC balance too low! Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(newTbtcBalance)}`
    );
    emailService.admin.systemBalanceAnomaly(
      ethClient.defaultWallet.address,
      bnToNumberEth(currentTbtcBalance),
      bnToNumberEth(newTbtcBalance),
      'TBTC'
    );
  }
  const minEthBalance = currentEthBalance.mul(95).div(100);
  if (newEthBalance.lt(minEthBalance)) {
    logger.error(`ETH balance too low! Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(newEthBalance)}`);
    emailService.admin.systemBalanceAnomaly(
      ethClient.defaultWallet.address,
      bnToNumberEth(currentEthBalance),
      bnToNumberEth(newEthBalance),
      'ETH'
    );
  }
  const minBtcBalance = currentBtcBalance * 0.97;
  if (newBtcBalance < minBtcBalance) {
    logger.error(`BTC balance too low! Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(newBtcBalance)}`);
    emailService.admin.systemBalanceAnomaly(
      btcClient.zpub,
      bnToNumberBtc(currentBtcBalance),
      bnToNumberBtc(newBtcBalance),
      'BTC'
    );
  }
  logger.info('Compared system balances with remembered values.');
}

async function checkSystemBalances(): Promise<boolean> {
  logger.info('Checking system balances...');
  const tbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const ethBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed: btcBalance } = await btcClient.getWalletBalance();
  let ok = true;

  const minTbtcBalance = numberToBnEth(MIN_SYSTEM_TBTC_BALANCE);
  if (tbtcBalance.lt(minTbtcBalance)) {
    logger.error(`TBTC balance too low! Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(tbtcBalance)}`);
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(tbtcBalance), 'TBTC');
    ok = false;
  }
  const minEthBalance = numberToBnEth(MIN_SYSTEM_ETH_BALANCE);
  if (ethBalance.lt(minEthBalance)) {
    logger.error(`ETH balance too low! Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(ethBalance)}`);
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(ethBalance), 'ETH');
    ok = false;
  }
  const minBtcBalance = numberToBnBtc(MIN_SYSTEM_BTC_BALANCE).toNumber();
  if (btcBalance < minBtcBalance) {
    logger.error(`BTC balance too low! Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(btcBalance)}`);
    emailService.admin.accountBalanceLow(btcClient.zpub, bnToNumberBtc(btcBalance), 'BTC');
    ok = false;
  }

  logger.info('System balances check finished.');

  return ok;
}

export default {
  rememberSystemBalances,
  compareSystemBalances,
  checkSystemBalances,
};
