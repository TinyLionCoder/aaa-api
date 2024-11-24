import { algodClient } from "../config";
import { v1NFTs } from "../assets/v1";

export async function checkAddressContainsPhantomV1NFT(
  account: string
): Promise<boolean> {
  let containsNFT = false;
  try {
    const allAddresses: any = await algodClient
      .accountInformation(account)
      .do();
    for (const nft of v1NFTs) {
      allAddresses.assets.forEach((asset: any) => {
        if (asset["asset-id"] === nft["asset-id"] && asset.amount > 0) {
          containsNFT = true;
        }
      });
    }
  } catch (error) {
    console.error("Error checking if account contains NFT: ", error);
  }

  return containsNFT; // Returns an object with addresses as keys and their count as values
}




