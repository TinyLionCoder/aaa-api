import { algodClient } from "./config.js";

export async function checkAssetHoldings(assetId) {
  try {
    const assetInfo = await algodClient.getAssetByID(assetId).do();
    const totalSupply = assetInfo.params.total;
    const creatorAddress = assetInfo.params.creator;

    // Check the account information of the creator
    const accountInfo = await algodClient
      .accountInformation(creatorAddress)
      .do();
    const assetHolding = accountInfo.assets.find(
      (a) => a["asset-id"] === assetId
    );

    return assetHolding.amount === totalSupply;
  } catch (error) {
    console.error("Error checking asset holdings: ", error);
    return false;
  }
}
