import { algodClient } from "../config";

export async function checkPHNTMHolding(address: any) {
  try {
    const response = await algodClient.accountInformation(address).do();
    const phntm = response.assets.filter(
      (asset: any) => asset["asset-id"] === 1279721720
    )[0];
    return phntm?.amount / 100000000 > 999 ? true : false;
  } catch (error) {
    console.error("Error fetching addresses for asset: 1279721720", error);
  }
}
