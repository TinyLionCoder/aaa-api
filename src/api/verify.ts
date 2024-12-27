import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import { verifyFeeTX } from "../algorand/transactionHelpers/verifyFeeTX";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

router.post("/verify", async (req: Request, res: Response) => {
  const { userId, email, walletAddress, txId } = req.body;

  try {
    const isValidRequest = verifyOriginAndJWT(req, email, userId);
    if (!isValidRequest) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Firestore transaction for concurrency-safe updates
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userSnapshot = await transaction.get(userRef);

      if (!userSnapshot.exists) {
        throw new Error("User not found in Firestore");
      }

      const userData = userSnapshot.data();
      const dbWalletAddress = userData?.walletAddress;

      // Check if the user is already verified
      if (userData?.verified) {
        throw new Error("User is already verified");
      }

      // Check wallet address mismatch
      if (dbWalletAddress && dbWalletAddress !== walletAddress) {
        throw new Error("Wallet address mismatch. Please set up the correct wallet.");
      }

      // Verify the transaction fee payment
      const isFeeTXVerified = await verifyFeeTX(walletAddress, txId);
      if (!isFeeTXVerified) {
        throw new Error("Verification failed. Invalid or missing fee payment.");
      }

      // Update user's verification status
      transaction.update(userRef, {
        verified: true,
      });
    });

    return res.status(200).json({ message: "User verified successfully!" });
  } catch (error) {
    console.error("Error verifying user:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(400).json({ message: errorMessage });
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
