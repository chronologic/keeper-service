import { ethClient, btcClient } from './clients';
import { keepContractAt, tbtcSystem } from './contracts';
import { depositSync, depositMonitor, redeemer, paymentProcessor } from './services';

// keepContractAt('0x451946b16651c6d69a2c5d9e5848b31739d39eaa').getSignatureSubmittedEvent(8593300).then(console.log);

// btcClient.getBalanceZpubSelf().then(console.log);
// console.log(btcClient.getAddress(0));

// btcClient
//   .getTransaction('9536d2e6f9cf397804bc1bf36ca8a70685914439bd48ec228220d5eb84a5214d')
//   .then(btcClient.getTransactionFee)
//   .then(console.log);

// btcClient
//   .waitForConfirmations('3da4a3e60318bda6328f5c2fb7fac37141e811e9984f59dd30eb1fdddcbc4609', 100)
//   .then(console.log);

async function start(): Promise<void> {
  // await depositSync.init();
  // await depositMonitor.init();
  // await redeemer.init();
  await paymentProcessor.init();
}

export default {
  start,
};
