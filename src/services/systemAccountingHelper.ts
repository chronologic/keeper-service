import { BigNumber } from 'ethers';

import { btcClient, ethClient } from '../clients';
import { tbtcToken } from '../contracts';
import {
  SKIP_BALANCE_CHECKS,
  MIN_SYSTEM_BTC_BALANCE,
  MIN_SYSTEM_ETH_BALANCE,
  MIN_SYSTEM_TBTC_BALANCE,
  WARNING_SYSTEM_BTC_BALANCE,
  WARNING_SYSTEM_ETH_BALANCE,
  WARNING_SYSTEM_TBTC_BALANCE,
} from '../env';
import { createLogger } from '../logger';
import { bnToNumberBtc, bnToNumberEth, numberToBnBtc, numberToBnEth } from '../utils';
import emailService from './emailService';

const logger = createLogger('systemAccountingHelper');

let currentTbtcBalance = BigNumber.from(0);
let currentEthBalance = BigNumber.from(0);
let currentBtcBalance = 0;

async function rememberSystemBalances(): Promise<void> {
  if (SKIP_BALANCE_CHECKS) {
    logger.warn('Skipping remembering system balances');
    return;
  }

  logger.info('Remembering system balances...');
  currentTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  currentEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  currentBtcBalance = confirmed;
  logger.info(
    `Remembered system balances: ${bnToNumberEth(currentTbtcBalance)} TBTC, ${bnToNumberEth(
      currentEthBalance
    )} ETH, ${bnToNumberBtc(currentBtcBalance)} BTC`
  );
}

async function compareSystemBalances(): Promise<void> {
  if (SKIP_BALANCE_CHECKS) {
    logger.warn('Skipping comparing system balances with remembered values');
    return;
  }

  logger.info('Comparing system balances with remembered values...');
  const newTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const newEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  const newBtcBalance = confirmed;

  const minTbtcBalance = currentTbtcBalance.mul(97).div(100);
  logger.debug(`TBTC balances. Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(newTbtcBalance)}`);
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
  logger.debug(`ETH balances. Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(newEthBalance)}`);
  if (newEthBalance.lt(minEthBalance)) {
    logger.error(`ETH balance too low! Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(newEthBalance)}`);
    emailService.admin.systemBalanceAnomaly(
      ethClient.defaultWallet.address,
      bnToNumberEth(currentEthBalance),
      bnToNumberEth(newEthBalance),
      'ETH'
    );
  }
  const minBtcBalance = Math.floor(currentBtcBalance * 0.97);
  logger.debug(`BTC balances. Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(newBtcBalance)}`);
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
  let ok = true;

  if (SKIP_BALANCE_CHECKS) {
    logger.warn('Skipping checking system balances');
    return ok;
  }

  logger.info('Checking system balances...');
  const tbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const ethBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed: btcBalance } = await btcClient.getWalletBalance();

  logger.info(
    `System balances: ${bnToNumberEth(tbtcBalance)} TBTC, ${bnToNumberEth(ethBalance)} ETH, ${bnToNumberBtc(
      btcBalance
    )} BTC`
  );

  const minTbtcBalance = numberToBnEth(MIN_SYSTEM_TBTC_BALANCE);
  const warningTbtcBalance = numberToBnEth(WARNING_SYSTEM_TBTC_BALANCE);
  logger.debug(`TBTC balances. Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(tbtcBalance)}`);
  if (tbtcBalance.lt(minTbtcBalance)) {
    logger.error(
      `TBTC balance critical! Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(tbtcBalance)}`
    );
    emailService.admin.accountBalanceCritical(ethClient.defaultWallet.address, bnToNumberEth(tbtcBalance), 'TBTC');
    ok = false;
  } else if (tbtcBalance.lt(warningTbtcBalance)) {
    logger.warn(
      `TBTC balance running low! Min: ${bnToNumberEth(minTbtcBalance)}, current: ${bnToNumberEth(tbtcBalance)}`
    );
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(tbtcBalance), 'TBTC');
  }

  const minEthBalance = numberToBnEth(MIN_SYSTEM_ETH_BALANCE);
  const warningEthBalance = numberToBnEth(WARNING_SYSTEM_ETH_BALANCE);
  logger.debug(`ETH balances. Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(ethBalance)}`);
  if (ethBalance.lt(minEthBalance)) {
    logger.error(`ETH balance critical! Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(ethBalance)}`);
    emailService.admin.accountBalanceCritical(ethClient.defaultWallet.address, bnToNumberEth(ethBalance), 'ETH');
    ok = false;
  } else if (ethBalance.lt(warningEthBalance)) {
    logger.warn(`ETH balance running low! Min: ${bnToNumberEth(minEthBalance)}, current: ${bnToNumberEth(ethBalance)}`);
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(ethBalance), 'ETH');
  }

  const minBtcBalance = numberToBnBtc(MIN_SYSTEM_BTC_BALANCE).toNumber();
  const warningBtcBalance = numberToBnBtc(WARNING_SYSTEM_BTC_BALANCE).toNumber();
  logger.debug(`BTC balances. Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(btcBalance)}`);
  if (btcBalance < minBtcBalance) {
    logger.error(`BTC balance critical! Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(btcBalance)}`);
    emailService.admin.accountBalanceCritical(btcClient.zpub, bnToNumberBtc(btcBalance), 'BTC');
    ok = false;
  } else if (btcBalance < warningBtcBalance) {
    logger.warn(`BTC balance running low! Min: ${bnToNumberBtc(minBtcBalance)}, current: ${bnToNumberBtc(btcBalance)}`);
    emailService.admin.accountBalanceLow(btcClient.zpub, bnToNumberBtc(btcBalance), 'BTC');
  }

  logger.info('System balances check finished.');

  return ok;
}

export default {
  rememberSystemBalances,
  compareSystemBalances,
  checkSystemBalances,
};
