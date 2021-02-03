import { BigNumber } from 'ethers';

import { btcClient, ethClient } from '../clients';
import { tbtcToken } from '../contracts';
import { MIN_SYSTEM_BTC_BALANCE, MIN_SYSTEM_ETH_BALANCE, MIN_SYSTEM_TBTC_BALANCE } from '../env';
import { bnToNumberBtc, bnToNumberEth, numberToBnBtc, numberToBnEth } from '../utils';
import emailService from './emailService';

let currentTbtcBalance = BigNumber.from(0);
let currentEthBalance = BigNumber.from(0);
let currentBtcBalance = 0;

async function rememberSystemBalances(): Promise<void> {
  currentTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  currentEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  currentBtcBalance = confirmed;
}

async function compareSystemBalances(): Promise<void> {
  const newTbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const newEthBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed } = await btcClient.getWalletBalance();
  const newBtcBalance = confirmed;

  const minTbtcBalance = currentTbtcBalance.mul(99).div(100);
  if (newTbtcBalance.lt(minTbtcBalance)) {
    emailService.admin.systemBalanceAnomaly(
      ethClient.defaultWallet.address,
      bnToNumberEth(currentTbtcBalance),
      bnToNumberEth(newTbtcBalance),
      'TBTC'
    );
  }
  const minEthBalance = currentEthBalance.mul(95).div(100);
  if (newEthBalance.lt(minEthBalance)) {
    emailService.admin.systemBalanceAnomaly(
      ethClient.defaultWallet.address,
      bnToNumberEth(currentEthBalance),
      bnToNumberEth(newEthBalance),
      'ETH'
    );
  }
  const minBtcBalance = currentBtcBalance * 0.97;
  if (newBtcBalance < minBtcBalance) {
    emailService.admin.systemBalanceAnomaly(
      btcClient.zpub,
      bnToNumberBtc(currentBtcBalance),
      bnToNumberBtc(newBtcBalance),
      'BTC'
    );
  }
}

async function checkSystemBalances(): Promise<boolean> {
  const tbtcBalance = await tbtcToken.balanceOf(ethClient.defaultWallet.address);
  const ethBalance = await ethClient.defaultWallet.getBalance();
  const { confirmed: btcBalance } = await btcClient.getWalletBalance();
  let ok = true;

  const minTbtcBalance = numberToBnEth(MIN_SYSTEM_TBTC_BALANCE);
  if (tbtcBalance.lt(minTbtcBalance)) {
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(tbtcBalance), 'TBTC');
    ok = false;
  }
  const minEthBalance = numberToBnEth(MIN_SYSTEM_ETH_BALANCE);
  if (ethBalance.lt(minEthBalance)) {
    emailService.admin.accountBalanceLow(ethClient.defaultWallet.address, bnToNumberEth(ethBalance), 'ETH');
    ok = false;
  }
  const minBtcBalance = numberToBnBtc(MIN_SYSTEM_BTC_BALANCE).toNumber();
  if (btcBalance < minBtcBalance) {
    emailService.admin.accountBalanceLow(btcClient.zpub, bnToNumberBtc(btcBalance), 'BTC');
    ok = false;
  }

  return ok;
}

export default {
  rememberSystemBalances,
  compareSystemBalances,
  checkSystemBalances,
};
