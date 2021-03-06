import { BigNumber, Event } from 'ethers';
import { getConnection, Payment, User, typeorm } from 'keeper-db';

import { SYNC_MIN_BLOCK } from '../env';
import { createLogger } from '../logger';
import { userPayment } from '../contracts';
import { ethClient } from '../clients';
import { MINUTE_MILLIS } from '../constants';
import { bnToNumberEth } from '../utils';
import emailService from './emailService';

const logger = createLogger('paymentProcessor');
const SYNC_INTERVAL_MINUTES = 5;
const SYNC_INTERVAL = SYNC_INTERVAL_MINUTES * MINUTE_MILLIS;

async function init(): Promise<void> {
  await syncPeriodically();
}

async function syncPeriodically(): Promise<void> {
  try {
    await syncTransfersFromLogs();
  } catch (e) {
    logger.error(e);
  }
  logger.info(`Next run in ${SYNC_INTERVAL_MINUTES} minutes`);
  setTimeout(syncPeriodically, SYNC_INTERVAL);
}

async function syncTransfersFromLogs(): Promise<void> {
  const lastSyncedBlockNumber = await getLastSyncedBlockNumber();
  logger.info(`🚀 syncing transfers from logs starting from block ${lastSyncedBlockNumber}...`);
  const events = await userPayment.contract.queryFilter(
    userPayment.contract.filters.Forwarded(),
    lastSyncedBlockNumber
  );

  logger.info(`ℹ found ${events.length} events, syncing...`);

  let storedCount = 0;
  let skippedCount = 0;

  for (const event of events) {
    const stored = await confirmAndStoreTransferEvent(event);
    if (stored) {
      storedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  logger.info(`🎉 syncing transfers from logs completed. stored ${storedCount}, skipped ${skippedCount}`);
}

async function getLastSyncedBlockNumber(): Promise<number> {
  const connection = getConnection();
  const [{ max }] = await connection
    .createQueryBuilder()
    .select('MAX("blockNumber") as max')
    .from(Payment, 'p')
    .execute();
  logger.debug(`last synced block number: ${max}`);

  return max || SYNC_MIN_BLOCK;
}

async function confirmAndStoreTransferEvent(event: Event): Promise<boolean> {
  const parsed = userPayment.contract.interface.parseLog(event);
  const [from, _to, amount]: [string, string, BigNumber] = parsed.args as any;
  const txHash = event.transactionHash;
  let stored = false;

  try {
    const { success } = await ethClient.confirmTransaction(txHash);

    stored = await maybeStoreTransfer({
      amount,
      blockNumber: event.blockNumber,
      from,
      txHash,
      success,
    });

    logger.info(
      `✅ ${stored ? 'stored' : 'skipped'} ${
        success ? 'SUCCESSFUL' : 'FAILED'
      } payment from ${from} for ${bnToNumberEth(amount)} ETH`
    );
  } catch (e) {
    logger.error(e);
    emailService.admin.genericError('confirmAndStoreTransferEvent', e);
  }

  return stored;
}

async function maybeStoreTransfer({
  from,
  amount,
  txHash,
  blockNumber,
  success,
}: {
  from: string;
  amount: BigNumber;
  txHash: string;
  blockNumber: number;
  success: boolean;
}): Promise<boolean> {
  const manager = getConnection();

  return manager.transaction(async (txManager) => {
    if (await paymentTxExists(txManager, txHash)) {
      return false;
    }

    const user = await getOrCreateUser(txManager, from);
    await storePayment(txManager, {
      amount,
      blockNumber,
      success,
      txHash,
      user,
    });

    if (success) {
      const newBalance = await addEthToUserBalance(txManager, user, amount);
      emailService.accountToppedUp(user, user.address, txHash, amount, newBalance);
    } else {
      emailService.accountTopUpError(user, user.address, txHash, amount);
    }
    return true;
  });
}

async function getOrCreateUser(manager: typeorm.EntityManager, address: string): Promise<User> {
  let user = await manager.findOne(User, { address });

  if (!user) {
    user = await manager.save(User, { address } as User);
    user.balanceEth = user.balanceEth || BigNumber.from('0');
  }

  return user;
}

async function paymentTxExists(manager: typeorm.EntityManager, txHash: string): Promise<boolean> {
  const payment = await manager.findOne(Payment, { txHash });

  return !!payment;
}

async function storePayment(
  manager: typeorm.EntityManager,
  {
    txHash,
    user,
    amount,
    blockNumber,
    success,
  }: {
    txHash: string;
    user: User;
    amount: BigNumber;
    blockNumber: number;
    success: boolean;
  }
): Promise<Payment> {
  const status = success ? Payment.Status.CONFIRMED : Payment.Status.ERROR;
  const payment = await manager.save(Payment, ({ txHash, user, amount, blockNumber, status } as any) as Payment);

  return payment;
}

async function addEthToUserBalance(manager: typeorm.EntityManager, user: User, amount: BigNumber): Promise<BigNumber> {
  const newBalance = user.balanceEth.add(amount);
  await manager.update(User, { id: user.id }, { balanceEth: newBalance });

  return newBalance;
}

export default {
  init,
};
