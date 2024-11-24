import { algodClient } from "./config.js";

export default async function countPhntmNfts(userAddress) {
  const phantomV1Address =
    "IWY24Q6GUUIMJITMTR3FDO4Q54UCBPPPIWJUQ57CWLASPRHFHXTXIQUQYA";
  try {
    const accountInfo = await algodClient.accountInformation(userAddress).do();
    const phntmNftsCount = accountInfo["assets"].filter(
      (asset) => asset["creator"] === phantomV1Address // Replace with your PHNTM NFT creator address
    ).length;
    return phntmNftsCount;
  } catch (error) {
    console.error("Error fetching account NFTs:", error);
    throw error;
  }
}
