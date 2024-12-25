import express, { Request, Response } from "express";
import { db, auth } from "../config/firebase"; // Firebase Auth and Firestore
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const GENESIS_REFERRAL_CODE = "GENESIS";

// Firebase REST API URL for sign-in
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
const docmunetPath = process.env.DOCUMENT_PATH || "default_document_path";

// Generate JWT for user sessions
const generateToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, "your_secret_key", { expiresIn: "1h" });
};

// POST /signup
router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, referralCode } = req.body;

  // Validate origin
  const origin = req.get("origin");
  if (origin !== "https://algoadoptairdrop.vercel.app") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Create user in Firebase Authentication (outside the transaction)
    const userRecord = await auth.createUser({
      email,
      password,
    });

    const userId = userRecord.uid; // Firebase UID
    const generatedReferralCode = uuidv4();

    let referredBy = GENESIS_REFERRAL_CODE;

    // Start Firestore transaction
    await db.runTransaction(async (transaction) => {
      // Validate referral code
      if (referralCode && referralCode.trim() !== "") {
        const referrerSnapshot = await db
          .collection("users")
          .where("referralCode", "==", referralCode.trim())
          .get();

        if (!referrerSnapshot.empty) {
          const referrerDoc = referrerSnapshot.docs[0];
          referredBy = referrerDoc.id; // Use the userId of the referrer
        } else {
          throw new Error("Invalid referral code");
        }
      }

      // Prepare the new user data
      const newUser = {
        email,
        walletAddress: null,
        referralCode: generatedReferralCode,
        referredBy,
        aaaBalance: 5,
        referrals: [],
        lastWithdrawalDate: null,
        verified: false,
      };

      // Add new user
      const newUserRef = db.collection("users").doc(userId);
      transaction.set(newUserRef, newUser);

      // Update Genesis user balance and referrals
      const genesisRef = db.collection("users").doc(docmunetPath);
      transaction.update(genesisRef, {
        aaaBalance: admin.firestore.FieldValue.increment(5),
        referrals: admin.firestore.FieldValue.arrayUnion(userId),
      });

      // Multi-level referral logic: Update up to 5 levels
      let currentReferrer = referredBy;
      for (let level = 0; level < 5; level++) {
        if (currentReferrer === GENESIS_REFERRAL_CODE) break;

        const referrerRef = db.collection("users").doc(currentReferrer);
        const referrerSnapshot = await referrerRef.get();

        if (!referrerSnapshot.exists) break;

        const referrerData = referrerSnapshot.data();

        // Update referrer
        transaction.update(referrerRef, {
          aaaBalance: admin.firestore.FieldValue.increment(5),
          referrals: admin.firestore.FieldValue.arrayUnion(userId),
        });

        currentReferrer = referrerData?.referredBy || GENESIS_REFERRAL_CODE;
      }
    });

    console.log(
      `Signup completed for user: ${userId}, referredBy: ${referredBy}`
    );

    res.status(201).json({
      message: "Signup successful. Please login to continue",
      userId,
      referralCode: null,
      aaaBalance: 5,
      token: null,
      walletAddress: null,
      verified: false,
    });
  } catch (error) {
    console.error("Signup error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message: errorMessage });
  }
});

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
        referralCode: updatedUserData?.verified
          ? updatedUserData?.referralCode
          : null,
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
        referralCode: updatedUserData?.verified
          ? updatedUserData?.referralCode
          : null,
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
