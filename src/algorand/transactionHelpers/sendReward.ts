import algosdk from "algosdk";
import { algodClient } from "../config";

export async function sendRewards(to: any, amount: number, assetId: number) {
  try {
    // Input validation
    if (!algosdk.isValidAddress(to)) {
      throw new Error("Invalid to Algorand address provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const mnemonic = process.env.AIRDROP_MNEMONIC;
    const airdropProviderAccount = algosdk.mnemonicToSecretKey(`${mnemonic}`);

    // Sending ASA
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: airdropProviderAccount.addr,
      to,
      assetIndex: assetId, // Asset ID for ASA
      amount: Number(amount),
      note: new Uint8Array(Buffer.from(`AAA App: ${assetId} Airdrop`)),
      suggestedParams,
    });

    const signedTxn = algosdk.signTransaction(txn, airdropProviderAccount.sk);
    const txConfirmation = await algodClient
      .sendRawTransaction(signedTxn.blob)
      .do();

    console.log("Transaction ID:", txConfirmation.txId);
    return txConfirmation;
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}
