// import { tbtcConstants } from '../../contracts';
// import { Deposit } from '../../entities/Deposit';
// import { createLogger } from '../../logger';
// import { btcClient } from '../../clients';
// import {
//   getOperationLogInStatus,
//   getOperationLogsOfType,
//   hasOperationLogInStatus,
//   storeOperationLog,
// } from './operationLogHelper';
// import { getDeposit } from '../depositHelper';
// import { DepositTx } from '../../entities';

// const logger = createLogger('btcReception');

// export async function ensureBtcReceived(deposit: Deposit): Promise<Deposit> {
//   logger.info(`Ensuring BTC received for deposit ${deposit.depositAddress}...`);
//   try {
//     // TODO: double check status on blockchain -
//     const logs = await getOperationLogsOfType(deposit.id, DepositTx.Type.REDEEM_BTC_RECEPTION);
//     if (hasOperationLogInStatus(logs, DepositTx.Status.CONFIRMED)) {
//       logger.info(`BTC reception is ${DepositTx.Status.CONFIRMED} for deposit ${deposit.depositAddress}.`);
//       return getDeposit(deposit.depositAddress);
//     }

//     const broadcastedLog = getOperationLogInStatus(logs, DepositTx.Status.BROADCASTED);
//     if (broadcastedLog) {
//       logger.info(
//         `BTC reception is in ${DepositTx.Status.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
//       );
//       await confirmBtcReceived(deposit, broadcastedLog.txHash);
//       return getDeposit(deposit.depositAddress);
//     }

//     logger.info(`Waiting for BTC reception for deposit ${deposit.depositAddress}...`);
//     const tx = await waitForIncomingBtc(deposit);
//     await confirmBtcReceived(deposit, tx.txid);
//   } catch (e) {
//     // TODO: handle errors inside functions above
//     console.log(e);
//     throw e;
//   } finally {
//     // TODO: update total redemption cost
//   }
//   return getDeposit(deposit.depositAddress);
// }

// async function confirmBtcReceived(deposit: Deposit, txHash: string): Promise<void> {
//   logger.info(`Waiting for confirmations for BTC reception for deposit ${deposit.depositAddress}...`);
//   const minConfirmations = await tbtcConstants.getMinBtcConfirmations();
//   const txReceipt = await btcClient.waitForConfirmations(txHash, minConfirmations);

//   // TODO: check tx status
//   logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
//   logger.debug(JSON.stringify(txReceipt, null, 2));

//   const log = new DepositTx();
//   log.txHash = txHash;
//   log.operationType = DepositTx.Type.REDEEM_BTC_RECEPTION;
//   log.status = DepositTx.Status.CONFIRMED;
//   log.blockchainType = DepositTx.BlockchainType.BTC;

//   await storeOperationLog(deposit, log);
// }

// async function waitForIncomingBtc(deposit: Deposit): Promise<btcClient.IRawTx> {
//   logger.info(`Waiting for incoming BTC for deposit ${deposit.depositAddress}...`);
//   const minReceivedValue = deposit.lotSizeSatoshis.mul(90).div(100);

//   const tx = await btcClient.waitForTransactionToAddress(deposit.redemptionAddress, minReceivedValue);

//   const log = new DepositTx();
//   log.txHash = tx.txid;
//   log.operationType = DepositTx.Type.REDEEM_BTC_RECEPTION;
//   log.status = DepositTx.Status.BROADCASTED;
//   log.blockchainType = DepositTx.BlockchainType.BTC;

//   await storeOperationLog(deposit, log);

//   return tx;
// }
