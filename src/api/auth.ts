import express, { Request, Response } from "express";
import { db, auth } from "../config/firebase"; // Firebase Auth and Firestore
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import axios from "axios";
import { authenticateToken } from "../middlewares";
import dotenv from 'dotenv';
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

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Validate referral code if provided
    let referredBy = GENESIS_REFERRAL_CODE;

    if (referralCode && referralCode.trim() !== "") {
      const referrerSnapshot = await db
        .collection("users")
        .where("referralCode", "==", referralCode.trim())
        .get();

      if (!referrerSnapshot.empty) {
        referredBy = referralCode.trim();
      } else {
        return res.status(400).json({ message: "Invalid referral code" });
      }
    }

    // Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
    });

    const userId = userRecord.uid; // Firebase UID
    const generatedReferralCode = userId;

    console.log(`Referral Code Provided: ${referralCode || "None"}`);
    console.log(`Referred By Determined: ${referredBy}`);

    const newUser = {
      email,
      referralCode: generatedReferralCode,
      referredBy,
      aaaBalance: 5,
      referrals: [],
      lastWithdrawalDate: null,
    };

    // Add new user to Firestore
    await db.collection("users").doc(userId).set(newUser);

    // Always update the Genesis user
    const genesisRef = db.collection("users").doc(docmunetPath);
    await genesisRef.update({
      aaaBalance: admin.firestore.FieldValue.increment(5),
      referrals: admin.firestore.FieldValue.arrayUnion(userId),
    });

    // Multi-level referral logic: Update up to 5 levels of referrers
    let currentReferrer = referredBy;
    for (let level = 0; level < 5; level++) {
      if (currentReferrer === GENESIS_REFERRAL_CODE) break;

      const referrerSnapshot = await db
        .collection("users")
        .where("referralCode", "==", currentReferrer)
        .get();

      if (referrerSnapshot.empty) break;

      const referrerDoc = referrerSnapshot.docs[0];
      const referrerId = referrerDoc.id;

      // Update the referrer's balance and referrals array
      await db.collection("users").doc(referrerId).update({
        aaaBalance: admin.firestore.FieldValue.increment(5),
        referrals: admin.firestore.FieldValue.arrayUnion(userId),
      });

      // Move to the next referrer in the chain
      currentReferrer = referrerDoc.data()?.referredBy || GENESIS_REFERRAL_CODE;
    }

    console.log(
      `Signup completed for user: ${userId}, referredBy: ${referredBy}`
    );

    res.status(201).json({
      message: "Signup successful",
      userId,
      referralCode: newUser.referralCode,
      aaaBalance: newUser.aaaBalance,
      token: generateToken(userId, email),
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// POST /login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Authenticate the email and password using Firebase REST API
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

    const userData = userSnapshot.data();

    res.json({
      message: "Login successful",
      userId,
      referralCode: userData?.referralCode,
      aaaBalance: userData?.aaaBalance,
      referrals: userData?.referrals,
      token: generateToken(userId, email),
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Login error:", error.response?.data || error.message);
    } else {
      console.error("Login error:", error);
    }
    res.status(401).json({ message: "Invalid email or password" });
  }
});

// POST /withdraw (Protected)
router.post(
  "/withdraw",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { userId } = req.user!;

    try {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();

      if (!userSnap.exists || userSnap.data()?.aaaBalance < 5) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await userRef.update({
        aaaBalance: admin.firestore.FieldValue.increment(-5),
      });

      res.json({ message: "Withdrawal successful" });
    } catch (error) {
      console.error("Withdrawal error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export default router;
