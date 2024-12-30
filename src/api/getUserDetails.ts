import express, { Request, Response } from "express";
import { db } from "../config/firebase"; // Firebase Auth and Firestore
import axios from "axios";
import dotenv from "dotenv";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";
dotenv.config();

const router = express.Router();

// POST /login
router.post("/get-user-details", async (req: Request, res: Response) => {
  const { email, userId } = req.body;

  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    // Retrieve user data from Firestore
    const userSnapshot = await db.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found in Firestore" });
    }

    // Reload updated user data
    const updatedUserSnapshot = await db.collection("users").doc(userId).get();
    const updatedUserData = updatedUserSnapshot.data();

    return res.json({
      message: "get user details successful",
      referralCode: updatedUserData?.verified
        ? updatedUserData?.referralCode
        : null,
      aaaBalance: updatedUserData?.aaaBalance,
      referrals: updatedUserData?.referrals,
      walletAddress: updatedUserData?.walletAddress,
      verified: updatedUserData?.verified,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("get user details error:", error.response?.data || error.message);
    } else {
      console.error("get user details error:", error);
    }
    res.status(401).json({ message: "Invalid credentials" });
  }
});

export default router;
