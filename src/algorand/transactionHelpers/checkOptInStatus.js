import { algodClient } from "../config.js";

export async function checkOptIn(address, assetId) {
  try {
    // Fetch the account information
    const accountInfo = await algodClient.accountInformation(address).do();

    // Check if the account contains the asset ID in its assets array
    return accountInfo.assets.some((asset) => {
      return asset["asset-id"] === parseInt(assetId, 10);
    });
  } catch (error) {
    console.error("Error checking opt-in status:", error);
    return false;
  }
}
