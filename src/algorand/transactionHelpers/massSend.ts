import algosdk from "algosdk";
import { algodClient } from "../config";

export async function massSend(
  to: any,
  amount: number,
  assetId: number,
  decimals: number
) {
  try {
    // Input validation
    if (!algosdk.isValidAddress(to)) {
      throw new Error("Invalid to Algorand address provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const mnemonic = process.env.MASS_SEND_MNEMONIC;
    const massSendProviderAccount = algosdk.mnemonicToSecretKey(`${mnemonic}`);

    // Sending ASA
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: massSendProviderAccount.addr,
      to,
      assetIndex: assetId, // Asset ID for ASA
      amount: Number(amount) * Math.pow(10, decimals),
      note: new Uint8Array(
        Buffer.from(
          "AAA APP: All Verified members of https://algoadoptairdrop.vercel.app will receive their available balance on the first week of every month"
        )
      ),
      suggestedParams,
    });

    const signedTxn = algosdk.signTransaction(txn, massSendProviderAccount.sk);
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
