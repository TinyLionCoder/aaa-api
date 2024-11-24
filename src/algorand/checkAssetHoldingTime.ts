import { algoIndexerClient } from "./config";

export async function hasNoRecentInflow(address: any, assetId: any) {
  const minimumHoldDurationMs = 16 * 3600 * 1000; // 12 hours in milliseconds
  const now = Date.now();

  try {
    // Fetch recent transactions for the address filtered by the asset ID
    const response = await algoIndexerClient
      .searchForTransactions()
      .address(address)
      .assetID(assetId)
      .do();

    const transactions = response.transactions;

    // Check each transaction to see if there has been an incoming transfer within the last 12 hours
    for (const txn of transactions) {
      const txnType = txn["tx-type"];
      const assetTransfer = txn["asset-transfer-transaction"];

      if (txnType === "axfer" && assetTransfer) {
        const isReceiver = assetTransfer.receiver === address;
        const txnTime = txn["round-time"] * 1000; // Convert to milliseconds

        // If there is an incoming transaction within the last 12 hours, return false
        if (isReceiver && now - txnTime <= minimumHoldDurationMs) {
          return false; // Recent inflow found
        }
      }
    }

    // If no recent inflows are found, return true
    return true;
  } catch (error) {
    console.error("Error checking recent inflows:", error);
    return false;
  }
}
