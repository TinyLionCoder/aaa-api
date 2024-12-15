import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import admin from "firebase-admin";
import { algodClient } from "../algorand/config"; // Algorand client config
import algosdk from "algosdk";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const GENESIS_REFERRAL_CODE = "GENESIS";

router.post("/payouts/monthly", async (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === process.env.PAYOUT_PASSWORD) {
    try {
      const senderMnemonic = process.env.SENDER_MNEMONIC; // Use a secure method to retrieve this
      if (!senderMnemonic) {
        return res
          .status(500)
          .json({ message: "Sender mnemonic not configured" });
      }

      // Decode sender's account
      const senderAccount = algosdk.mnemonicToSecretKey(senderMnemonic);
      const senderAddress = senderAccount.addr;

      const usersSnapshot = await db
        .collection("users")
        .where("referralCode", "!=", GENESIS_REFERRAL_CODE) // Exclude Genesis user
        .get();

      if (usersSnapshot.empty) {
        return res.status(404).json({ message: "No users found for payouts." });
      }

      const payouts = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const payoutAmount = userData.aaaBalance || 0;
        const userWalletAddress = userData.walletAddress;

        if (payoutAmount > 0 && userWalletAddress) {
          try {
            // Create and send Algorand transaction
            const suggestedParams = await algodClient
              .getTransactionParams()
              .do();

            const txn =
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: senderAddress,
                to: userWalletAddress,
                assetIndex: parseInt("2004387843", 10), // ASA ID
                amount: Number(payoutAmount),
                suggestedParams,
              });

            // Sign transaction
            const signedTxn = txn.signTxn(senderAccount.sk);

            // Send transaction
            const { txId } = await algodClient
              .sendRawTransaction(signedTxn)
              .do();

            console.log(`Transaction sent for user ${userId}: ${txId}`);

            // Wait for confirmation
            await algosdk.waitForConfirmation(algodClient, txId, 4);

            console.log(`Transaction confirmed for user ${userId}`);

            // Check if the payout document already exists
            const payoutRef = db.collection("payouts").doc(userId);
            const payoutDoc = await payoutRef.get();

            if (payoutDoc.exists) {
              // Update existing payout list
              await payoutRef.update({
                payouts: admin.firestore.FieldValue.arrayUnion({
                  payoutAmount,
                  txId,
                  timestamp: admin.firestore.Timestamp.now(),
                }),
              });
            } else {
              // Create a new document for the user
              await payoutRef.set({
                userId,
                payouts: [
                  {
                    payoutAmount,
                    txId,
                    timestamp: admin.firestore.Timestamp.now(),
                  },
                ],
              });
            }

            // Update user balance
            const userRef = db.collection("users").doc(userId);
            await userRef.update({ aaaBalance: 0 });

            payouts.push({
              userId,
              payoutAmount,
              txId,
            });
          } catch (error) {
            console.error(`Failed transaction for user ${userId}:`, error);
          }
        }
      }

      res.status(200).json({
        message: "Monthly payouts processed successfully.",
        payouts,
      });
    } catch (error) {
      console.error("Error processing monthly payouts:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
});

/**
 * GET /payouts/total/:userId
 * Retrieves the total payouts for a given user.
 */
router.get("/payouts/total/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { password } = req.body;

  if (password !== process.env.PAYOUT_PASSWORD) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Retrieve the user's payouts document
    const payoutRef = db.collection("payouts").doc(userId);
    const payoutDoc = await payoutRef.get();

    if (!payoutDoc.exists) {
      return res
        .status(404)
        .json({ message: "No payouts found for this user." });
    }

    const payoutData = payoutDoc.data();
    const payouts = payoutData?.payouts || [];

    // Calculate the total payout amount
    const totalPayout = payouts.reduce(
      (sum: number, payout: { payoutAmount: number }) =>
        sum + payout.payoutAmount,
      0
    );

    // Respond with the total payout and payout history
    res.status(200).json({
      userId,
      totalPayout,
      payouts,
    });
  } catch (error) {
    console.error("Error fetching total payouts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
