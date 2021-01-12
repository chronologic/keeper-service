import { getConnection } from 'typeorm';

import { MINUTE_MILLIS } from '../constants';
import { COLLATERAL_BUFFER_PERCENT, COLLATERAL_CHECK_INTERVAL_MINUTES, MIN_LOT_SIZE_BTC } from '../env';
import { Deposit } from '../entities/Deposit';
import { createLogger } from '../logger';
import { DepositStatus } from '../types';
import { getEthToBtcRatio } from './priceFeed';
import { bnToNumberBtc, bnToNumberEth } from '../utils/bnToNumber';
import { numberToBnBtc } from '../utils/numberToBn';

const logger = createLogger('depositMonitor');
const minLotSize = numberToBnBtc(MIN_LOT_SIZE_BTC).toString();

function init(): void {
  checkDepositsAndScheduleNextRun();
}

async function checkDepositsAndScheduleNextRun(): Promise<void> {
  await checkDeposits();
  setTimeout(checkDepositsAndScheduleNextRun, COLLATERAL_CHECK_INTERVAL_MINUTES * MINUTE_MILLIS);
}

async function checkDeposits(): Promise<void> {
  const deposits = await getDepositsToCheck();
  const ethToBtcRatio = await getEthToBtcRatio();

  for (const deposit of deposits) {
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

    if (isBelowRedemptionThreshold) {
      console.log('undercollateralized', deposit);
    }
  }
}

async function getDepositsToCheck(): Promise<Deposit[]> {
  const validStatuses = [
    DepositStatus[DepositStatus.ACTIVE],
    // statuses in DB might be stale so include other transitional statuses that might be redeemable
    DepositStatus[DepositStatus.AWAITING_BTC_FUNDING_PROOF],
    DepositStatus[DepositStatus.AWAITING_SIGNER_SETUP],
    DepositStatus[DepositStatus.COURTESY_CALL],
    DepositStatus[DepositStatus.START],
  ];
  const connection = getConnection();
  // TODO: only include subscribed operators
  // TODO: exclude deposits that are being redeemed by Keeper
  const deposits = await connection
    .createQueryBuilder()
    .select('*')
    .from(Deposit, 'd')
    .innerJoin('d.operators', 'o')
    .where('d.status in (:...validStatuses)', { validStatuses })
    .andWhere('d.bondedEth > 0')
    .andWhere('d.lotSizeSatoshis > :minLotSize', { minLotSize })
    .execute();
  logger.debug(`found ${deposits.length} deposits to check`);

  return [deposits[0]];
}

export default {
  init,
};
