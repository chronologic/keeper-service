import PubSub from 'pubsub-js';
import { getConnection, Deposit, User } from 'keeper-db';

import { MINUTE_MILLIS } from '../constants';
import {
  COLLATERAL_BUFFER_PERCENT,
  COLLATERAL_CHECK_INTERVAL_MINUTES,
  MAX_LOT_SIZE_BTC,
  MIN_LOT_SIZE_BTC,
  MIN_USER_BALANCE_ETH,
} from '../env';
import { createLogger } from '../logger';
import { depositContractAt } from '../contracts';
import { bnToNumberBtc, bnToNumberEth, numberToBnBtc, numberToBnEth } from '../utils';
import priceFeed from './priceFeed';
import depositHelper from './depositHelper';

export const DEPOSITS_CHECKED_TOPIC = 'DEPOSITS_CHECKED';
const logger = createLogger('depositMonitor');
const minLotSize = numberToBnBtc(MIN_LOT_SIZE_BTC).toString();
const maxLotSize = numberToBnBtc(MAX_LOT_SIZE_BTC).toString();
const COLLATERAL_CHECK_INTERVAL = COLLATERAL_CHECK_INTERVAL_MINUTES * MINUTE_MILLIS;

const redeemableStatusCodes = [
  Deposit.Status[Deposit.Status.ACTIVE],
  Deposit.Status[Deposit.Status.COURTESY_CALL],
] as any[];

async function init(): Promise<void> {
  if (COLLATERAL_CHECK_INTERVAL > 0) {
    await checkPeriodically();
  } else {
    logger.warn('Deposit monitor (collateral check) disabled');
  }
}

async function checkPeriodically(): Promise<void> {
  try {
    await checkDeposits();
  } catch (e) {
    logger.error(e);
  }
  logger.info(`Next run in ${COLLATERAL_CHECK_INTERVAL_MINUTES} minutes`);
  setTimeout(checkPeriodically, COLLATERAL_CHECK_INTERVAL);
}

async function checkDeposits(): Promise<void> {
  logger.info('🚀 checking deposits collateral...');
  const deposits = await getDepositsToCheck();
  const ethToBtcRatio = await priceFeed.fetchEthToBtc();

  const depositsToRedeem = deposits.filter((d) => shouldRedeemDeposit(d, ethToBtcRatio));

  let marked = 0;
  let skipped = 0;
  for (const deposit of depositsToRedeem) {
    const markedForRedemption = await tryMarkDepositForRedemption(deposit);
    if (markedForRedemption) {
      marked += 1;
    } else {
      skipped += 1;
    }
  }

  logger.info(`🎉 checked ${deposits.length} deposit(s). Marked ${marked} for redemption, skipped ${skipped}`);

  PubSub.publish(DEPOSITS_CHECKED_TOPIC);
}

function shouldRedeemDeposit(deposit: Deposit, ethToBtcRatio: number): boolean {
  const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
  const bondedEth = bnToNumberEth(deposit.bondedEth);
  const bondedEthInBtc = bondedEth * ethToBtcRatio;
  const collateralizationPercent = (bondedEthInBtc * 100) / lotSizeBtc;
  const adjustedUndercollateralizedThresholdPercent =
    deposit.undercollateralizedThresholdPercent + COLLATERAL_BUFFER_PERCENT;
  const isBelowRedemptionThreshold = collateralizationPercent < adjustedUndercollateralizedThresholdPercent;
  logger.info(
    `${isBelowRedemptionThreshold ? 'REDEEM' : 'OK'} deposit ${
      deposit.depositAddress
    } current collateralization %: ${collateralizationPercent}, min: ${adjustedUndercollateralizedThresholdPercent}`
  );
  logger.debug({
    depositAddress: deposit.depositAddress,
    lotSizeBtc,
    bondedEth,
    bondedEthInBtc,
    collateralizationPercent,
    undercollateralizedThresholdPercent: deposit.undercollateralizedThresholdPercent,
    adjustedUndercollateralizedThresholdPercent,
    isBelowRedemptionThreshold,
  });

  return isBelowRedemptionThreshold;
}

async function tryMarkDepositForRedemption(deposit: Deposit): Promise<boolean> {
  const isRedeemable = await checkIsInRedeemableState(deposit);

  if (isRedeemable) {
    await markDepositForRedemption(deposit);
    return true;
  }

  return false;
}

async function checkIsInRedeemableState(deposit: Deposit): Promise<boolean> {
  const statusCode = await depositContractAt(deposit.depositAddress).getStatusCode();
  const status = Deposit.Status[statusCode];

  if (redeemableStatusCodes.includes(status)) {
    return true;
  }

  if (deposit.statusCode !== statusCode) {
    await depositHelper.updateStatus(deposit.depositAddress, status as any);
  }

  return false;
}

async function markDepositForRedemption(deposit: Deposit): Promise<void> {
  await depositHelper.updateSystemStatus(deposit.depositAddress, Deposit.SystemStatus.QUEUED_FOR_REDEMPTION);
}

async function getDepositsToCheck(): Promise<Deposit[]> {
  const q = getConnection()
    .getRepository(Deposit)
    .createQueryBuilder('d')
    .where('d."status" in (:...redeemableStatusCodes)', { redeemableStatusCodes })
    .andWhere('d."systemStatus" is null')
    .andWhere('d."bondedEth" > 0')
    .andWhere('d."lotSizeSatoshis" >= :minLotSize', { minLotSize })
    .andWhere('d."lotSizeSatoshis" <= :maxLotSize', { maxLotSize });

  // only check deposits associated with users that have enough funds
  const subq = q
    .subQuery()
    .select('1')
    .from(User, 'u')
    .innerJoin('u.operators', 'o')
    .innerJoin('o.deposits', 'd2')
    .where('d2.id = d.id')
    .andWhere('u."balanceEth" >= :minBalance', { minBalance: numberToBnEth(MIN_USER_BALANCE_ETH).toString() });

  const deposits = await q.andWhere(`exists ${subq.getQuery()}`).getMany();

  logger.debug(`found ${deposits.length} deposits to check`);

  return deposits;
}

export default {
  init,
};
