import { algodClient } from "../config";

export async function isValidTransaction(txId: string) {
  try {
    // Get current block round
    const status = await algodClient.status().do();
    const currentRound = status["last-round"];

    // Retrieve transaction details
    const tx = await algodClient.pendingTransactionInformation(txId).do();

    // Check if the transaction is within the last 10 rounds
    if (tx["confirmed-round"] && currentRound - tx["confirmed-round"] <= 10) {
      console.log(
        "Transaction is valid and was confirmed within the last 10 rounds."
      );
      return true;
    } else {
      console.log(
        "Transaction is either too old or not yet confirmed within the last 10 rounds."
      );
      return false;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return false;
  }
}
