import express, { Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../config/firebase";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

router.post("/daily-checkin", async (req: Request, res: Response) => {
  const { userId, email } = req.body;

  try {
    // Validate origin and JWT
    const isValidRequest = verifyOriginAndJWT(req, email, userId);
    if (!isValidRequest) {
      return res.status(403).json({ message: "Forbidden request." });
    }

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ message: "Invalid or missing user ID." });
    }

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userDoc.data();
    const today = new Date().toDateString();
    const lastCheckIn = user?.lastCheckInDate
      ? new Date(user.lastCheckInDate).toDateString()
      : null;

    if (lastCheckIn === today) {
      return res.status(400).json({ message: "You already checked in today." });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    let newStreak = user?.checkInStreak || 0;
    newStreak = lastCheckIn === yesterdayStr ? newStreak + 1 : 1;
    if (newStreak > 7) newStreak = 7;

    const rewardMap: { [key: number]: number } = {
      1: 0.2,
      2: 0.3,
      3: 0.4,
      4: 0.5,
      5: 0.6,
      6: 0.8,
      7: 1.0,
    };

    const reward = rewardMap[newStreak] || 0.2;

    await userRef.update({
      checkInStreak: newStreak,
      lastCheckInDate: new Date().toISOString(),
      bonusTokensEarned: admin.firestore.FieldValue.increment(reward),
      aaaBalance: admin.firestore.FieldValue.increment(reward),
    });

    return res.status(200).json({
      message: `✅ Checked in! You earned ${reward} AAA.`,
      currentStreak: newStreak,
      reward,
    });
  } catch (error: any) {
    console.error("Error during daily check-in:", error);
    return res.status(500).json({
      message: "Something went wrong during check-in.",
      error: error.message || "Unknown error",
    });
  }
});

export default router;
