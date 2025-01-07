import algosdk from "algosdk";
import { algodClient } from "./config";
import dotenv from "dotenv";
dotenv.config();

export async function optIn(assetId: number) {
  try {
    const airdropMnemonic = process.env.AIRDROP_MNEMONIC; // Use a secure method to retrieve this
    if (!airdropMnemonic) {
      throw new Error("airdrop mnemonic not configured");
    }

    // Decode airdrop's account
    const airdropAccount = algosdk.mnemonicToSecretKey(airdropMnemonic);
    const airdropAddress = airdropAccount.addr;
    // Input validation
    if (!algosdk.isValidAddress(airdropAddress)) {
      throw new Error("Invalid Algorand airdropAddress provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: airdropAddress,
      to: airdropAddress,
      amount: 0,
      note: new Uint8Array(Buffer.from(`Opting in to ${assetId}`)),
      assetIndex: assetId,
      suggestedParams,
    });

    // Sign transaction
    const signedTxn = txn.signTxn(airdropAccount.sk);

    // Send transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();

    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    console.log(`Opt-in transaction sent: ${txId}`);
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}
