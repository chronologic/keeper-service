import { getConnection } from 'typeorm';

import { Deposit } from '../../entities/Deposit';
import { DepositOperationLogStatus, DepositOperationLogType } from '../../types';
import { createLogger } from '../../logger';
import { DepositOperationLog } from '../../entities/DepositOperationLog';

const logger = createLogger('operationLogHelper');

export async function getOperationLogsOfType(
  depositId: number,
  logType: DepositOperationLogType
): Promise<DepositOperationLog[]> {
  const logs = await getOperationLogs(depositId);
  return logs.filter((l) => l.operationType === logType);
}

export async function getOperationLogs(depositId: number): Promise<DepositOperationLog[]> {
  const logs = await getConnection().createEntityManager().find(DepositOperationLog, { depositId });

  return logs;
}

export function hasOperationLogInStatus(logs: DepositOperationLog[], status: DepositOperationLogStatus): boolean {
  return !!getOperationLogInStatus(logs, status);
}

export function getOperationLogInStatus(
  logs: DepositOperationLog[],
  status: DepositOperationLogStatus
): DepositOperationLog {
  return logs.find((l) => l.status === status);
}

export async function storeOperationLog(deposit: Deposit, log: DepositOperationLog): Promise<DepositOperationLog> {
  logger.debug(`Storing log for deposit ${deposit.depositAddress}...`);
  logger.debug(JSON.stringify(log));
  const res = await getConnection()
    .createEntityManager()
    .save(DepositOperationLog, {
      ...log,
      deposit,
    });

  return res;
}
