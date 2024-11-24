// getAccountBalance.ts
import { algoIndexerClient } from "../config";

// Helper to get account balance
export const getAccountBalance = async (address: string) => {
  try {
    const accountInfo = await algoIndexerClient.lookupAccountByID(address).do();
    return accountInfo.account;
  } catch (error) {
    console.error("Error fetching account balance:", error);
    throw new Error("Failed to fetch account balance.");
  }
};
