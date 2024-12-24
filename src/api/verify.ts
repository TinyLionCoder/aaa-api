import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import { verifyFeeTX } from "../algorand/transactionHelpers/verifyFeeTX";

const router = express.Router();

router.post("/verify", async (req: Request, res: Response) => {
  const { userId, walletAddress, txId } = req.body;

  try {
    // Validate origin (Optional: Remove or modify based on your needs)
    const origin = req.get("origin");
    if (origin !== "https://algoadoptairdrop.vercel.app") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Retrieve user data from Firestore
    const userSnapshot = await db.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found in Firestore" });
    }

    const userData = userSnapshot.data();
    const dbWalletAddress = userData?.walletAddress;

    // Check if wallet address matches the one in the database
    if (dbWalletAddress && dbWalletAddress !== walletAddress) {
      return res.status(400).json({
        message: "Wallet address mismatch. Please set up the correct wallet.",
        newWalletAddress: walletAddress,
      });
    }

    // Verify the transaction fee payment
    const isFeeTXVerified = await verifyFeeTX(walletAddress, txId);

    if (!isFeeTXVerified) {
      return res
        .status(400)
        .json({
          message: "Verification failed. Invalid or missing fee payment.",
        });
    }

    // Update user's verification status in Firestore
    await db.collection("users").doc(userId).update({
      verified: true,
    });

    return res.status(200).json({ message: "User verified successfully!" });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Endpoint to get user verification status
router.get(
  "/verification-status/:userId",
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Validate origin (Optional: Remove or modify based on your needs)
    const origin = req.get("origin");
    if (origin !== "https://algoadoptairdrop.vercel.app") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    try {
      // Retrieve user data from Firestore
      const userSnapshot = await db.collection("users").doc(userId).get();

      if (!userSnapshot.exists) {
        return res.status(404).json({ message: "User not found in Firestore" });
      }

      // Get the user's verification status
      const userData = userSnapshot.data();
      const isVerified = userData?.verified || false;

      return res.status(200).json({ verified: isVerified });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  }
);

export default router;
