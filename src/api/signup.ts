import express, { Request, Response } from "express";
import { db, auth } from "../config/firebase";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const GENESIS_REFERRAL_CODE = "GENESIS";

const docmunetPath = process.env.DOCUMENT_PATH || "default_document_path";


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

  let userId: string | null = null; // Keep track of user ID for potential deletion
  try {
    // Create user in Firebase Authentication (outside the transaction)
    const userRecord = await auth.createUser({
      email,
      password,
    });

    userId = userRecord.uid; // Firebase UID
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

      // Add new user to Firestore
      if (!userId) {
        throw new Error("User ID is null");
      }
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
          referrals: admin.firestore.FieldValue.arrayUnion({
            level: level + 1,
            userId, // Add the new user's ID to their parent with level 1
          }),
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

    // Cleanup the created Firebase user if Firestore operations fail
    if (userId) {
      try {
        await auth.deleteUser(userId);
        console.log(`Deleted user ${userId} due to Firestore error.`);
      } catch (deleteError) {
        console.error(`Failed to delete user ${userId}:`, deleteError);
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message: errorMessage });
  }
});

export default router;
