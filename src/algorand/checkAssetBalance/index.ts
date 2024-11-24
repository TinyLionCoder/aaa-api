import { algodClient } from "../config";

export async function checkRewardAccountAssetBalance(assetId: number) {
  try {
    const address = "JQONXCP7LYP2O2XQLOPBM6I67LBGCZGEZGHBRRBJBAJEWEIWIRIFZIPXIQ";
    const accountAssetInfo =
      assetId === 0
        ? await algodClient.accountInformation(address).do()
        : await algodClient.accountAssetInformation(address, assetId).do();

    return assetId === 0
      ? accountAssetInfo?.amount / 1000000
      : assetId === 1279721720
      ? accountAssetInfo["asset-holding"]?.amount / 100000000
      : accountAssetInfo["asset-holding"]?.amount;
  } catch (error) {
    console.error("Error checking asset holdings: ", error);
    return false;
  }
}
