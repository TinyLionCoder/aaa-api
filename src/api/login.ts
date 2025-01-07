import express, { Request, Response } from "express";
import { db } from "../config/firebase"; // Firebase Auth and Firestore
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Firebase REST API URL for sign-in
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;

// Generate JWT for user sessions
const generateToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, `${process.env.JWT_SECRET_KEY}`, {
    expiresIn: "1h",
  });
};

// POST /login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password, walletAddress } = req.body;

  const origin = req.get("origin");
  if (origin !== "https://algoadoptairdrop.vercel.app") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    if (email && password) {
      // Authenticate with email and password
      const authResponse = await axios.post(FIREBASE_AUTH_URL, {
        email,
        password,
        returnSecureToken: true,
      });

      const userId = authResponse.data.localId; // Firebase UID from response

      // Retrieve user data from Firestore
      const userSnapshot = await db.collection("users").doc(userId).get();

      if (!userSnapshot.exists) {
        return res.status(404).json({ message: "User not found in Firestore" });
      }

      // Reload updated user data
      const updatedUserSnapshot = await db
        .collection("users")
        .doc(userId)
        .get();
      const updatedUserData = updatedUserSnapshot.data();

      return res.json({
        message: "Login successful",
        userId,
        referralCode: updatedUserData?.referralCode,
        aaaBalance: updatedUserData?.aaaBalance,
        referrals: updatedUserData?.referrals,
        token: generateToken(userId, email),
        walletAddress: updatedUserData?.walletAddress,
        verified: updatedUserData?.verified,
        email: updatedUserData?.email,
      });
    } else if (walletAddress) {
      // Authenticate with wallet address
      const userSnapshot = await db
        .collection("users")
        .where("walletAddress", "==", walletAddress)
        .get();

      if (userSnapshot.empty) {
        return res
          .status(404)
          .json({ message: "Wallet address not registered" });
      }

      const userDoc = userSnapshot.docs[0];

      // Reload updated user data
      const updatedUserSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .get();
      const updatedUserData = updatedUserSnapshot.data();

      return res.json({
        message: "Login successful",
        userId: userDoc.id,
        referralCode: updatedUserData?.referralCode,
        aaaBalance: updatedUserData?.aaaBalance,
        referrals: updatedUserData?.referrals,
        token: generateToken(userDoc.id, updatedUserData?.email || ""),
        walletAddress: updatedUserData?.walletAddress,
        verified: updatedUserData?.verified,
        email: updatedUserData?.email,
      });
    } else {
      return res.status(400).json({
        message: "Either email/password or wallet address is required",
      });
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Login error:", error.response?.data || error.message);
    } else {
      console.error("Login error:", error);
    }
    res.status(401).json({ message: "Invalid credentials" });
  }
});

export default router;
