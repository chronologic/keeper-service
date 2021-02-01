import {
  depositSync,
  depositMonitor,
  redeemerMinter,
  paymentProcessor,
  systemAccountingHelper,
  userAccountingHelper,
} from './services';

async function start(): Promise<void> {
  // await systemAccountingHelper.checkSystemBalances();
  // await userAccountingHelper.updateAllUserBalances();
  // await paymentProcessor.init();
  await depositSync.init();
  // await redeemerMinter.checkForDepositToProcess();
  // await depositMonitor.init();
}

export default {
  start,
};
