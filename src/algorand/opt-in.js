import algosdk from "algosdk";
import { algodClient } from "./config.js";

export async function optIn(address, assetId) {
  try {
    // Input validation
    if (!algosdk.isValidAddress(address)) {
      throw new Error("Invalid Algorand address provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      address,
      address,
      undefined,
      undefined,
      0,
      algosdk.encodeObj(`Opting in to ${assetId}`),
      parseInt(assetId, 10),
      suggestedParams
    );
    const singleTxnGroups = [{txn, signers: [address]}];
    return singleTxnGroups;
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}
