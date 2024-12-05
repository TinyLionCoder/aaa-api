import express, { Request, Response } from "express";
import { db } from "../config/firebase";

const router = express.Router();

/**
 * POST /setup-wallet
 * Updates the wallet address for a given user, ensuring the address is unique.
 */
router.post("/setup-wallet", async (req: Request, res: Response) => {
  const { userId, walletAddress } = req.body;

  // Validate origin
  const origin = req.get("origin");
  if (origin !== "https://algoadoptairdrop.vercel.app") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  // Validate input
  if (!userId || !walletAddress) {
    return res
      .status(400)
      .json({ message: "Both userId and walletAddress are required." });
  }

  try {
    // Ensure the wallet address is not already in use
    const walletCheckSnapshot = await db
      .collection("users")
      .where("walletAddress", "==", walletAddress)
      .get();

    if (!walletCheckSnapshot.empty) {
      const existingUser = walletCheckSnapshot.docs[0];
      if (existingUser.id !== userId) {
        return res.status(400).json({
          message: "This wallet address is already in use by another user.",
        });
      }
    }

    // Get the user's document in Firestore
    const userRef = db.collection("users").doc(userId);
    const userSnapshot = await userRef.get();

    // Check if user exists
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnapshot.data();

    // Check if the wallet address is already the same
    if (userData?.walletAddress === walletAddress) {
      return res.status(200).json({
        message: "Wallet address is already up-to-date.",
        userId,
        walletAddress,
      });
    }

    // Update the wallet address
    await userRef.update({ walletAddress });

    res.status(200).json({
      message: "Wallet address updated successfully.",
      userId,
      walletAddress,
    });
  } catch (error) {
    console.error("Error updating wallet address:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
