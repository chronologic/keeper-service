import { BigNumber } from 'ethers';

import { tbtcSystem, keepContractAt, depositContractAt } from '../../contracts';
import { Deposit } from '../../entities/Deposit';
import { createLogger } from '../../logger';
import { ethClient } from '../../clients';
import { DepositTx } from '../../entities';
import depositTxHelper, { IDepositTxParams } from './depositTxHelper';

const logger = createLogger('redeem_3_redemptionSig');
const operationType = DepositTx.Type.REDEEM_PROVIDE_REDEMPTION_SIG;

async function confirm(deposit: Deposit, txHash: string): Promise<IDepositTxParams> {
  logger.info(`Waiting for confirmations for redemption sig for deposit ${deposit.depositAddress}...`);
  const { receipt, success } = await ethClient.confirmTransaction(txHash);

  // TODO: check tx status
  logger.info(`Got confirmations for redemption sig for deposit ${deposit.depositAddress}.`);
  logger.debug(JSON.stringify(receipt, null, 2));

  return {
    operationType,
    txHash,
    status: success ? DepositTx.Status.CONFIRMED : DepositTx.Status.ERROR,
    txCostEthEquivalent: receipt.gasUsed,
  };
}

async function execute(deposit: Deposit): Promise<IDepositTxParams> {
  const depositContract = depositContractAt(deposit.depositAddress);
  const redemptionRequestTx = await depositTxHelper.getConfirmedTxOfType(
    deposit.id,
    DepositTx.Type.REDEEM_REDEMPTION_REQUEST
  );
  logger.info(`Fetching redemption details from event for deposit ${deposit.depositAddress}...`);
  const { digest } = await tbtcSystem.getRedemptionDetailsFromEvent(
    redemptionRequestTx.txHash,
    deposit.depositAddress,
    deposit.blockNumber
  );

  logger.info(`Waiting for signature submitted from for deposit ${deposit.depositAddress}...`);
  const { r, s, recoveryID } = await keepContractAt(deposit.keepAddress).getOrWaitForSignatureSubmittedEvent(
    digest,
    deposit.blockNumber
  );

  // A constant in the Ethereum ECDSA signature scheme, used for public key recovery [1]
  // Value is inherited from Bitcoin's Electrum wallet [2]
  // [1] https://bitcoin.stackexchange.com/questions/38351/ecdsa-v-r-s-what-is-v/38909#38909
  // [2] https://github.com/ethereum/EIPs/issues/155#issuecomment-253810938
  const ETHEREUM_ECDSA_RECOVERY_V = BigNumber.from(27);
  const v = BigNumber.from(recoveryID).add(ETHEREUM_ECDSA_RECOVERY_V);

  logger.debug(
    `Sending redemption sig tx for deposit ${deposit.depositAddress} with params:\n${JSON.stringify(
      {
        v: v.toString(),
        r: r.toString(),
        s: s.toString(),
      },
      null,
      2
    )}`
  );

  const tx = await depositContract.provideRedemptionSignature(v.toString(), r.toString(), s.toString());

  logger.debug(`Redemption sig tx:\n${JSON.stringify(tx, null, 2)}`);

  return {
    operationType,
    txHash: tx.hash,
    status: DepositTx.Status.BROADCASTED,
  };
}

export default {
  operationType,
  confirm,
  execute,
};
