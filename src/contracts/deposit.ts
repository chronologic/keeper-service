import { ethers } from 'ethers';

import DepositABI from '../abi/Deposit.json';
import { ethClient } from '../clients';
import { IDepositContract } from '../types';
import { satoshiToWei } from '../utils';

export default function getContractAt(address: string): IDepositContract {
  const contract = new ethers.Contract(address, DepositABI, ethClient.getMainWallet());

  return {
    getKeepAddress,
    getLotSizeSatoshis,
    getStatusCode,
    getCollateralizationPercent,
    getUndercollateralizedThresholdPercent,
    getRedemptionCost,
    getRedemptionFee,
    getUtxoValue,
    provideRedemptionSignature,
  };

  async function getKeepAddress() {
    const [keepAddress] = await contract.functions.keepAddress();
    return keepAddress.toLowerCase();
  }
  async function getLotSizeSatoshis() {
    const [lotSize] = await contract.functions.lotSizeSatoshis();
    return lotSize;
  }
  async function getStatusCode() {
    const [state] = await contract.functions.currentState();
    return state.toNumber();
  }
  async function getCollateralizationPercent() {
    const [collateralization] = await contract.functions.collateralizationPercentage();
    return collateralization;
  }
  async function getUndercollateralizedThresholdPercent() {
    const [threshold] = await contract.functions.undercollateralizedThresholdPercent();
    return threshold;
  }
  async function getRedemptionCost() {
    const redemptionFee = await getRedemptionFee();
    const lotSizeSatoshis = await getLotSizeSatoshis();
    return satoshiToWei(lotSizeSatoshis).add(redemptionFee);
  }
  async function getRedemptionFee() {
    const [fee] = await contract.functions.getOwnerRedemptionTbtcRequirement(ethClient.getMainAddress());
    return fee;
  }
  async function getUtxoValue() {
    const [utxoVal] = await contract.functions.utxoValue();
    return utxoVal.toNumber();
  }
  async function provideRedemptionSignature(v: string, r: string, s: string) {
    return contract.functions.provideRedemptionSignature(v, r, s);
  }
}
