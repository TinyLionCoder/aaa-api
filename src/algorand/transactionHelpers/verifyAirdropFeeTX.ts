import { algoIndexerClient } from "../config";

export const verifyAirdropFeeTX = async (txId: string) => {
  const expectedAmount = 10000000; // 10 Algo in microAlgos
  const expectedRecipient =
    "HE7225SD6ZKYO45QWYCE4BZ3ITFEK7WI7XGMAVAMB56FZREJVPMHNRSL2E"; // Replace with your recipient wallet address

  try {
    // Fetch transaction details from the indexer
    const transactionInfo = await algoIndexerClient.lookupTransactionByID(txId).do();

    // Verify recipient, and amount
    const recipient = transactionInfo.transaction["payment-transaction"]?.receiver;
    const amount = transactionInfo.transaction["payment-transaction"]?.amount;

    if (
      recipient === expectedRecipient &&
      amount === expectedAmount
    ) {
      return true; // Transaction verified
    }

    return false; // Transaction details do not match
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return false;
  }
};
