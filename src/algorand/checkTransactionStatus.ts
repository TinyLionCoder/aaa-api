import { algodClient } from "./config";

export default async function checkTransactionStatus(txId: string, resolve: any) {
  try {
    const response = await algodClient.pendingTransactionInformation(txId).do();
    console.log("Transaction status:", response);
    if (
      response["confirmed-round"] !== null &&
      response["confirmed-round"] > 0
    ) {
      // Transaction confirmed
      resolve(true);
    } else {
      // Transaction not confirmed, check again after some delay
      setTimeout(() => checkTransactionStatus(txId, resolve), 2000); // Check every 2 seconds
    }
  } catch (error) {
    console.error("Error checking transaction status:", error);
    resolve(false);
  }
};
