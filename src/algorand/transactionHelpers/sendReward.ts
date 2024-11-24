import algosdk from "algosdk";

import { algodClient } from "../config";
// import { autoOptOutRewardedAsset } from "../opt-out.js";
export async function sendRewards(to: any, amount: any, assetId: any) {
  try {
    // Input validation
    if (!algosdk.isValidAddress(to)) {
      throw new Error("Invalid to Algorand address provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const mnemonic = process.env.MNEMONIC;
    const rewardProviderAccount = algosdk.mnemonicToSecretKey(`${mnemonic}`);

    let txn;
    if (assetId === "0" || assetId === "") {
      // Sending ALGO
      txn = algosdk.makePaymentTxnWithSuggestedParams(
        rewardProviderAccount.addr,
        to,
        amount,
        undefined, // closeRemainderTo
        // @ts-ignore
        algosdk.encodeObj("Tiny Dick Lion's Den: Congrats!"),
        suggestedParams
      );
    } else {
      // Sending ASA
      txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
        rewardProviderAccount.addr,
        to,
        undefined, // closeRemainderTo
        undefined, // revocationTarget
        amount,
        // @ts-ignore
        algosdk.encodeObj("Tiny Dick Lion's Den: Congrats! 🦁"),
        parseInt(assetId, 10), // Asset ID for ASA
        suggestedParams
      );
    }

    const signedTxn = algosdk.signTransaction(txn, rewardProviderAccount.sk);
    const txConfirmation = await algodClient
      .sendRawTransaction(signedTxn.blob)
      .do();

    // await autoOptOutRewardedAsset(assetId);

    console.log("Transaction ID:", txConfirmation.txId);
    return txConfirmation;
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}
