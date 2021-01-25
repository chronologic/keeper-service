// import { depositToken, tbtcConstants, vendingMachine } from '../../contracts';
// import { Deposit } from '../../entities/Deposit';
// import { IEthTx } from '../../types';
// import { createLogger } from '../../logger';
// import { btcClient, ethClient } from '../../clients';
// import priceFeed from '../priceFeed';
// import {
//   getOperationLogInStatus,
//   getOperationLogsOfType,
//   hasOperationLogInStatus,
//   storeOperationLog,
// } from './operationLogHelper';
// import { getDeposit } from '../depositHelper';
// import { DepositTx } from '../../entities';

// const logger = createLogger('redeemApprove');

// export async function ensureApproveAndCallTdt(deposit: Deposit): Promise<Deposit> {
//   logger.info(`Ensuring tdt approve for deposit ${deposit.depositAddress}...`);
//   try {
//     // TODO: double check status on blockchain - ACTIVE / COURTESY_CALL
//     const logs = await getOperationLogsOfType(deposit.id, DepositTx.Type.MINT_APPROVE_TDT); // APPROVE_AND_CALL_TDT
//     if (hasOperationLogInStatus(logs, DepositTx.Status.CONFIRMED)) {
//       logger.info(`Tdt approve is ${DepositTx.Status.CONFIRMED} for deposit ${deposit.depositAddress}.`);
//       return getDeposit(deposit.depositAddress);
//     }

//     const broadcastedLog = getOperationLogInStatus(logs, DepositTx.Status.BROADCASTED);
//     if (broadcastedLog) {
//       logger.info(
//         `Tdt approve is in ${DepositTx.Status.BROADCASTED} state for deposit ${deposit.depositAddress}. Confirming...`
//       );
//       await confirmApproveAndCallTdt(deposit, broadcastedLog.txHash);
//       return getDeposit(deposit.depositAddress);
//     }

//     const tx = await approveAndCallTdt(deposit);
//     await confirmApproveAndCallTdt(deposit, tx.hash);
//   } catch (e) {
//     // TODO: handle errors inside functions above
//     console.log(e);
//     throw e;
//   } finally {
//     // TODO: update total redemption cost
//   }
//   return getDeposit(deposit.depositAddress);
// }

// async function confirmApproveAndCallTdt(deposit: Deposit, txHash: string): Promise<void> {
//   logger.info(`Waiting for confirmations for TDT approve and call for deposit ${deposit.depositAddress}...`);
//   const { receipt, success } = await ethClient.confirmTransaction(txHash);
//   logger.info(`Got confirmations for TDT approve and call for deposit ${deposit.depositAddress}.`);

//   // TODO: get the transferred amount and calculate correct cost

//   const log = new DepositTx();
//   log.txHash = txHash;
//   log.operationType = DepositTx.Type.MINT_APPROVE_AND_CALL_TDT;
//   log.status = success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR;
//   log.blockchainType = DepositTx.BlockchainType.ETH;
//   log.txCostEthEquivalent = receipt.gasUsed;
//   log.txCostUsdEquivalent = await priceFeed.convertWeiToUsd(receipt.gasUsed);

//   await storeOperationLog(deposit, log);
// }

// async function approveAndCallTdt(deposit: Deposit): Promise<IEthTx> {
//   const minConfirmations = await tbtcConstants.getMinBtcConfirmations();

//   const btcFundLogs = await getOperationLogsOfType(deposit.id, DepositTx.Type.MINT_FUND_BTC);
//   const btcFundLog = getOperationLogInStatus(btcFundLogs, DepositTx.Status.CONFIRMED);

//   // the system always puts the funding tx in position 0
//   const outputPosition = 0;
//   const proofArgs = await btcClient.constructFundingProof(btcFundLog.txHash, outputPosition, minConfirmations);

//   const unqualifiedDepositToTbtcCall = vendingMachine.getEncodedAbiUnqualifiedDepositToTbtc(
//     deposit.mintedDeposit.depositAddress,
//     proofArgs
//   );

//   const tx = await depositToken.approveAndCall(deposit.mintedDeposit.depositAddress, unqualifiedDepositToTbtcCall);

//   const log = new DepositTx();
//   log.blockchainType = DepositTx.BlockchainType.ETH;
//   log.txHash = tx.hash;
//   log.operationType = DepositTx.Type.MINT_APPROVE_AND_CALL_TDT;
//   log.direction = DepositOperationLogDirection.OUT;
//   log.status = DepositTx.Status.BROADCASTED;

//   await storeOperationLog(deposit, log);

//   return tx;
// }
