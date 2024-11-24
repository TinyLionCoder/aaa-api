import algosdk from "algosdk";
import { algodClient } from "./config.js";
import { checkAssetHoldings } from "./checkAssetHoldings.js";

export async function destroyAsset(address, assetId) {
  const assetIdentifier = parseInt(assetId, 10);

  if (!(await checkAssetHoldings(assetIdentifier))) {
    console.error("All asset units are not in the creator's account.");
    return;
  }

  try {
    const suggestedParams = await algodClient.getTransactionParams().do();
    const txn = algosdk.makeAssetDestroyTxnWithSuggestedParams(
      address,
      undefined,
      assetIdentifier,
      suggestedParams
    );
    const singleTxnGroup = [{ txn, signers: [address] }];

    return singleTxnGroup;
  } catch (error) {
    console.error("Error in destroying asset: ", error);
  }
}
