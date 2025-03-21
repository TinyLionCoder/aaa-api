import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";
import { algoIndexerClient } from "../algorand/config"; // Use your indexer client

const router = express.Router();
const AAA_ASA_ID = 2004387843;

/**
 * POST /user-aaa-optin-status
 * Check if user has a wallet address setup in DB, and if opted into AAA token.
 */
router.post("/aaa-optin-status", async (req: Request, res: Response) => {
  const { userId, email } = req.body;

  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const userSnapshot = await db.collection("users").doc(userId).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnapshot.data();
    const walletAddress = userData?.walletAddress;

    if (!walletAddress) {
      return res.status(200).json({ optedIn: false });
    }

    const accountInfo = await algoIndexerClient.lookupAccountByID(walletAddress).do();
    const optedIn = accountInfo.account.assets?.some(
      (asset: any) => asset["asset-id"] === AAA_ASA_ID
    );

    return res.status(200).json({ optedIn: optedIn === true });
  } catch (error) {
    console.error("Error checking opt-in status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
