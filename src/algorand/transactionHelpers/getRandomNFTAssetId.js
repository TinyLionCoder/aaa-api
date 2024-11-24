import algosdk from "algosdk";
import { algoIndexerClient } from "../config.js";

// Function to retrieve NFTs for a given address
export async function getRandomNFTAssetId(address) {
  try {
    // Validate the address
    if (!algosdk.isValidAddress(address)) {
      throw new Error("Invalid Algorand address provided.");
    }

    // Query the indexer for assets
    const response = await algoIndexerClient.lookupAccountByID(address).do();

    // Filter out NFTs (assuming NFTs have total supply of 1)
    const nfts = response?.account?.assets;

    // Return a random NFT asset ID, if any
    if (nfts.length > 0) {
      const randomIndex = Math.floor(Math.random() * nfts.length);
      return nfts[randomIndex]["asset-id"]; // The asset ID
    } else {
      throw new Error("No NFTs found for this address.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}
