import express, { Request, Response } from "express";
import { db, auth } from "../config/firebase"; // Firebase Auth and Firestore
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import axios from "axios";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const GENESIS_REFERRAL_CODE = "GENESIS";

// Firebase REST API URL for sign-in
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`;
const docmunetPath = process.env.DOCUMENT_PATH || "default_document_path";

// Google OAuth2 setup for Gmail
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// Generate JWT for user sessions
const generateToken = (userId: string, email: string) => {
  return jwt.sign({ userId, email }, "your_secret_key", { expiresIn: "1h" });
};

// POST /signup
router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, referralCode, walletAddress } = req.body;

  // Validate origin
  const origin = req.get("origin");
  if (origin !== "https://aaa-test-env.vercel.app") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (!walletAddress) {
    return res.status(400).json({ message: "Wallet address is required" });
  }

  try {
    // Check if walletAddress is already in use
    const walletCheckSnapshot = await db
      .collection("users")
      .where("walletAddress", "==", walletAddress)
      .get();

    if (!walletCheckSnapshot.empty) {
      console.log("Wallet address already in use");
      return res
        .status(400)
        .json({ message: "This wallet address is already in use." });
    }

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
      walletAddress, // Store wallet address
      referralCode: generatedReferralCode,
      referredBy,
      aaaBalance: 5,
      referrals: [],
      lastWithdrawalDate: null,
      emailVerified: false, // Add this field to track verification status
    };

    // Add new user to Firestore
    await db.collection("users").doc(userId).set(newUser);

    // Generate email verification link
    const emailVerificationLink = await auth.generateEmailVerificationLink(
      email
    );
    console.log(`Email verification link generated: ${emailVerificationLink}`);

    // Send email using NodeMailer
    const accessToken = await oAuth2Client.getAccessToken();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken.token || "",
      },
    });

    const mailOptions = {
      from: `AAA App <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email for AAA App",
      html: `
        <p>Welcome to the AAA App!</p>
        <p>Click the link below to verify your email address:</p>
        <a href="${emailVerificationLink}">Verify Email</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to: ${email}`);

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
      await db
        .collection("users")
        .doc(referrerId)
        .update({
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
      message: "Signup successful. Please verify your email.",
      userId,
      referralCode: newUser.referralCode,
      aaaBalance: newUser.aaaBalance,
      token: null,
      walletAddress: newUser.walletAddress,
      emailVerified: newUser.emailVerified,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password, walletAddress } = req.body;

  const origin = req.get("origin");
  if (origin !== "https://aaa-test-env.vercel.app") {
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

      const userData = userSnapshot.data();

      // Check if email is verified in Firebase Auth
      const userRecord = await auth.getUser(userId);

      if (!userRecord.emailVerified) {
        return res.status(403).json({
          message:
            "Email not verified. Please verify your email before logging in.",
        });
      }

      // Update Firestore if emailVerified is not set to true
      if (!userData?.emailVerified) {
        await db.collection("users").doc(userId).update({
          emailVerified: true,
        });
        console.log(`Email verification status updated for user: ${userId}`);
      }

      return res.json({
        message: "Login successful",
        userId,
        referralCode: userData?.referralCode,
        aaaBalance: userData?.aaaBalance,
        referrals: userData?.referrals,
        token: generateToken(userId, email),
        walletAddress: userData?.walletAddress,
        emailVerified: userData?.emailVerified,
        email: userData?.email,
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
      const userData = userDoc.data();

      // Check if email is verified in Firebase Auth
      const userRecord = await auth.getUser(userDoc.id);

      if (!userRecord.emailVerified) {
        return res.status(403).json({
          message:
            "Email not verified. Please verify your email before logging in.",
        });
      }

      // Update Firestore if emailVerified is not set to true
      if (!userData?.emailVerified) {
        await db.collection("users").doc(userDoc.id).update({
          emailVerified: true,
        });
        console.log(
          `Email verification status updated for user: ${userDoc.id}`
        );
      }

      return res.json({
        message: "Login successful",
        userId: userDoc.id,
        referralCode: userData?.referralCode,
        aaaBalance: userData?.aaaBalance,
        referrals: userData?.referrals,
        token: generateToken(userDoc.id, userData.email),
        walletAddress: userData?.walletAddress,
        emailVerified: userData?.emailVerified,
        email: userData?.email,
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
