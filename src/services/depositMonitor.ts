import { getConnection } from 'typeorm';

import { MINUTE_MILLIS } from '../constants';
import { COLLATERAL_BUFFER_PERCENT, COLLATERAL_CHECK_INTERVAL_MINUTES, MIN_LOT_SIZE_BTC } from '../env';
import { Deposit } from '../entities/Deposit';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { getEthToBtcRatio } from './priceFeed';
import { bnToNumberBtc, bnToNumberEth } from '../utils/bnToNumber';
import { numberToBnBtc } from '../utils/numberToBn';
import { depositContractAt } from './ethProvider';

const logger = createLogger('depositMonitor');
const minLotSize = numberToBnBtc(MIN_LOT_SIZE_BTC).toString();

const redeemableStatuses = [DepositStatus[DepositStatus.ACTIVE], DepositStatus[DepositStatus.COURTESY_CALL]];

function init(): void {
  checkDepositsAndScheduleNextRun();
}

async function checkDepositsAndScheduleNextRun(): Promise<void> {
  await checkDeposits();
  setTimeout(checkDepositsAndScheduleNextRun, COLLATERAL_CHECK_INTERVAL_MINUTES * MINUTE_MILLIS);
}

async function checkDeposits(): Promise<void> {
  logger.info('🚀 checking deposits collateral...');
  const deposits = await getDepositsToCheck();
  const ethToBtcRatio = await getEthToBtcRatio();

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
    `🎉 checked ${deposits.length} collateral. attempted to mark ${depositsToRedeem.length} for redemption. marked ${marked} for redemption, skipped ${skipped}`
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
  const depositContract = depositContractAt(deposit.depositAddress);
  const statusCode = await depositContract.functions.currentState();

  if (redeemableStatuses.includes(statusCode)) {
    return true;
  }

  await updateDepositStatus(deposit, statusCode);
  return false;
}

async function markDepositForRedemption(deposit: Deposit): Promise<void> {}

async function updateDepositStatus(deposit: Deposit, statusCode: number): Promise<void> {
  const connection = getConnection();
  const status = DepositStatus[statusCode];
  await connection.createEntityManager().update(Deposit, { id: deposit.id }, { statusCode, status });

  logger.debug(`updated deposit status to ${status}`);
}

async function getDepositsToCheck(): Promise<Deposit[]> {
  const connection = getConnection();
  // TODO: only include subscribed operators
  // TODO: exclude deposits that are being redeemed by Keeper
  const deposits = await connection
    .createQueryBuilder()
    .select('*')
    .from(Deposit, 'd')
    .innerJoin('d.operators', 'o')
    .where('d.status in (:...redeemableStatuses)', { redeemableStatuses })
    .andWhere('d.bondedEth > 0')
    .andWhere('d.lotSizeSatoshis > :minLotSize', { minLotSize })
    .execute();
  logger.debug(`found ${deposits.length} deposits to check`);

  return [deposits[0]];
}

export default {
  init,
};
