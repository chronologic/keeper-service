import { getConnection } from 'typeorm';

import { MINUTE_MILLIS } from '../constants';
import { COLLATERAL_BUFFER_PERCENT, COLLATERAL_CHECK_INTERVAL_MINUTES, MIN_LOT_SIZE_BTC } from '../env';
import { createLogger } from '../logger';
import { depositContractAt } from '../contracts';
import { bnToNumberBtc, bnToNumberEth, numberToBnBtc } from '../utils';
import { Deposit } from '../entities';
import priceFeed from './priceFeed';
import depositHelper from './depositHelper';

const logger = createLogger('depositMonitor');
const minLotSize = numberToBnBtc(MIN_LOT_SIZE_BTC).toString();
const COLLATERAL_CHECK_INTERVAL = COLLATERAL_CHECK_INTERVAL_MINUTES * MINUTE_MILLIS;

const redeemableStatusCodes = [
  Deposit.Status[Deposit.Status.ACTIVE],
  Deposit.Status[Deposit.Status.COURTESY_CALL],
] as any[];

async function init(): Promise<void> {
  await checkPeriodically();
}

async function checkPeriodically(): Promise<void> {
  try {
    await checkDeposits();
  } catch (e) {
    logger.error(e.message);
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

  logger.info(
    `🎉 checked ${deposits.length} collateral. Attempted to mark ${depositsToRedeem.length} for redemption. Marked ${marked} for redemption, skipped ${skipped}`
  );
}

function shouldRedeemDeposit(deposit: Deposit, ethToBtcRatio: number): boolean {
  const lotSizeBtc = bnToNumberBtc(deposit.lotSizeSatoshis);
  const bondedEth = bnToNumberEth(deposit.bondedEth);
  const bondedEthInBtc = bondedEth * ethToBtcRatio;
  const collateralizationPercent = (bondedEthInBtc * 100) / lotSizeBtc;
  const adjustedUndercollateralizedThresholdPercent =
    deposit.undercollateralizedThresholdPercent + COLLATERAL_BUFFER_PERCENT;
  const isBelowRedemptionThreshold = collateralizationPercent < adjustedUndercollateralizedThresholdPercent;
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

  if (redeemableStatusCodes.includes(Deposit.Status[statusCode] as any)) {
    return true;
  }

  if (deposit.statusCode !== statusCode) {
    await depositHelper.updateStatus(deposit.depositAddress, statusCode);
  }

  return false;
}

async function markDepositForRedemption(deposit: Deposit): Promise<void> {
  await depositHelper.updateSystemStatus(deposit.depositAddress, Deposit.SystemStatus.QUEUED_FOR_REDEMPTION);
}

async function getDepositsToCheck(): Promise<Deposit[]> {
  const connection = getConnection();
  // TODO: only include subscribed operators
  const deposits = await connection
    .createQueryBuilder()
    .select('*')
    .from(Deposit, 'd')
    .innerJoin('d.operators', 'o')
    .where('d.statusCode in (:...redeemableStatusCodes)', { redeemableStatusCodes })
    .andWhere('d.systemStaus is null')
    .andWhere('d.bondedEth > 0')
    .andWhere('d.lotSizeSatoshis > :minLotSize', { minLotSize })
    .execute();
  logger.debug(`found ${deposits.length} deposits to check`);

  return [deposits[0]];
}

export default {
  init,
};
