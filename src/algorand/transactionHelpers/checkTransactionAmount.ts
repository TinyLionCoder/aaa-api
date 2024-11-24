import algosdk from "algosdk";
import { algodClient } from "../config";

export default async function checkTransactionAmount(
  txId: any,
  expectedAmount: any,
  expectedRecipient: any,
  assetId: any
) {
  const maxAttempts = 15; // Maximum number of retry attempts
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      await new Promise((resolve) => setTimeout(resolve, attempts * 2000)); // Delay increases with each attempt
      const response = await algodClient
        .pendingTransactionInformation(txId)
        .do();

      if (
        response["confirmed-round"] !== null &&
        response["confirmed-round"] > 0
      ) {
        // Transaction confirmed, now check the amount and recipient
        let transactionCorrect = false;
        if (assetId === "0" || assetId === parseInt("0", 10)) {
          // Check for ALGO transactions
          if (
            response["txn"]["txn"]["amt"] === expectedAmount &&
            algosdk.encodeAddress(response["txn"]["txn"]["rcv"]) ===
              expectedRecipient
          ) {
            transactionCorrect = true;
          }
        } else {
          // Check for ASA transactions
          if (
            response["txn"]["txn"]["xaid"] === parseInt(assetId, 10) &&
            response["txn"]["txn"]["aamt"] === expectedAmount &&
            algosdk.encodeAddress(response["txn"]["txn"]["arcv"]) ===
              expectedRecipient
          ) {
            transactionCorrect = true;
          }
        }

        return { isConfirmed: true, correct: transactionCorrect };
      }
    } catch (error: any) {
      console.error(
        `Attempt ${attempts + 1}: Error checking transaction status:`,
        error.message
      );
      if (attempts >= maxAttempts - 1) {
        break; // Exit if max attempts reached
      }
    }
    attempts++;
  }
  return { isConfirmed: false, correct: false }; // After max attempts or other failure
}
