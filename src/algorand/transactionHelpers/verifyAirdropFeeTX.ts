import { algoIndexerClient } from "../config";

export const verifyAirdropFeeTX = async (txId: string) => {
  const expectedAmount = 10000000; // 10 Algo in microAlgos
  const expectedRecipient =
    "HE7225SD6ZKYO45QWYCE4BZ3ITFEK7WI7XGMAVAMB56FZREJVPMHNRSL2E"; // Replace with your recipient wallet address
  const MAX_RECENT_TIME_DIFF = 60 * 10; // Allowable time difference in seconds (e.g., 10 minutes)

  try {
    // Fetch transaction details from the indexer
    const transactionInfo = await algoIndexerClient.lookupTransactionByID(txId).do();

    // Verify recipient, amount, and time
    const recipient = transactionInfo.transaction["payment-transaction"]?.receiver;
    const amount = transactionInfo.transaction["payment-transaction"]?.amount;
    const roundTime = transactionInfo.transaction["round-time"]; // Unix timestamp

    if (!roundTime) {
      console.error("Transaction has no valid round-time field.");
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
    const timeDiff = currentTime - roundTime;

    if (
      recipient === expectedRecipient &&
      amount === expectedAmount &&
      timeDiff <= MAX_RECENT_TIME_DIFF &&
      timeDiff >= 0 // Ensure the transaction is not from the future
    ) {
      return true; // Transaction verified and recent
    }

    return false; // Transaction details do not match
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
};
