import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

/**
 * POST /my-team
 * Retrieves the count of referrals grouped by level for a given user.
 */
router.post("/my-team", async (req: Request, res: Response) => {
  const { userId, email } = req.body;

  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch the user's data from Firestore
    const userSnapshot = await db.collection("users").doc(userId).get();

    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnapshot.data();
    const referrals = userData?.referrals || [];

    // Count referrals by level
    const levelCounts = referrals.reduce((acc: any, referral: any) => {
      const { level } = referral;
      acc[level] = (acc[level] || 0) + 1; // Increment the count for the level
      return acc;
    }, {});

    // Format the response for up to 5 levels
    const formattedResponse = Array.from({ length: 5 }, (_, i) => ({
      level: i + 1,
      count: levelCounts[i + 1] || 0,
    }));

    return res.status(200).json({
      message: "User team fetched successfully!",
      data: formattedResponse,
    });
  } catch (error) {
    console.error("Error fetching user team:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

/**
 * POST /verified-team-members
 * Retrieves the count of verified referrals for a given user.
 */
router.post("/verified-team-members", async (req: Request, res: Response) => {
  const { userId, email } = req.body;

  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Fetch user data
    const userSnapshot = await db.collection("users").doc(userId).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userSnapshot.data();
    const referrals = userData?.referrals || [];

    if (referrals.length === 0) {
      return res.status(200).json({
        message: "No referrals found.",
        verifiedMembers: 0,
      });
    }

    const referralIds = referrals.map((referral: any) => referral.userId);

    let verifiedCount = 0;

    // Firestore's `IN` query only allows 30 values, so we batch queries in groups of 30.
    const chunkSize = 30;
    for (let i = 0; i < referralIds.length; i += chunkSize) {
      const batchIds = referralIds.slice(i, i + chunkSize);

      const referralSnapshots = await db
        .collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", batchIds)
        .get();

      referralSnapshots.forEach((doc) => {
        const referralData = doc.data();
        if (referralData.verified) {
          verifiedCount++;
        }
      });
    }

    return res.status(200).json({
      message: "Verified team members count retrieved successfully.",
      verifiedMembers: verifiedCount,
    });
  } catch (error) {
    console.error("Error fetching verified team members:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

export default router;
