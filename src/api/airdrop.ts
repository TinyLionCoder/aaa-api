import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import admin from "firebase-admin";
import { optIn } from "../algorand/opt-in";
import { sendRewards } from "../algorand/transactionHelpers/sendReward";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

router.post("/create-airdrop", async (req: Request, res: Response) => {
  const {
    userId,
    email,
    tokenName,
    tokenId,
    amountOfTokenPerClaim,
    totalAmountOfTokens,
  } = req.body;

  // Verify request origin and JWT
  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    // Validate input
    if (
      !tokenName ||
      !tokenId ||
      !amountOfTokenPerClaim ||
      !totalAmountOfTokens ||
      amountOfTokenPerClaim <= 0 ||
      totalAmountOfTokens <= 0 ||
      totalAmountOfTokens < amountOfTokenPerClaim
    ) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    await db.runTransaction(async (transaction) => {
      const airdropCollectionRef = db.collection("airdrops");
      const existingAirdropQuery = await transaction.get(
        airdropCollectionRef
          .where("tokenName", "==", tokenName)
          .where("completed", "==", false)
          .limit(1)
      );

      if (!existingAirdropQuery.empty) {
        throw new Error("An active airdrop already exists for this token");
      }

      const currentDate = new Date().toISOString();
      const docId = `${tokenName}-${currentDate}`;

      const newAirdrop = {
        userId,
        email,
        tokenName,
        tokenId,
        amountOfTokenPerClaim,
        totalAmountOfTokens,
        totalAmountOfTokensClaimed: 0,
        completed: false,
        claimedAddresses: [],
        createdAt: admin.firestore.Timestamp.fromDate(new Date()),
      };

      const docRef = airdropCollectionRef.doc(docId);
      transaction.set(docRef, newAirdrop);
    });

    res.status(201).json({ message: "Airdrop created successfully" });
  } catch (error) {
    console.error("Error creating airdrop:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ message: errorMessage });
  }
});

router.post("/update-claimed-address", async (req: Request, res: Response) => {
  const { userId, email, tokenName, address } = req.body;

  // Verify user identity
  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    if (!address || !tokenName) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const airdropCollectionRef = db.collection("airdrops");

    await db.runTransaction(async (transaction) => {
      const querySnapshot = await transaction.get(
        airdropCollectionRef
          .where("tokenName", "==", tokenName)
          .where("completed", "==", false)
          .limit(1)
      );

      if (querySnapshot.empty) {
        throw new Error("No active airdrop found for this token");
      }

      const doc = querySnapshot.docs[0];
      const docId = doc.id;
      const data = doc.data();

      if (data.claimedAddresses && data.claimedAddresses.includes(address)) {
        throw new Error("Address already claimed");
      }

      if (data.totalAmountOfTokensClaimed >= data.totalAmountOfTokens) {
        transaction.update(airdropCollectionRef.doc(docId), { completed: true });
        throw new Error("Airdrop is fully claimed");
      }

      await sendRewards(address, Number(data.amountOfTokenPerClaim), data.tokenId);

      transaction.update(airdropCollectionRef.doc(docId), {
        claimedAddresses: admin.firestore.FieldValue.arrayUnion(address),
        totalAmountOfTokensClaimed: admin.firestore.FieldValue.increment(
          data.amountOfTokenPerClaim
        ),
      });
    });

    res.status(200).json({ message: "Address added to claimed list" });
  } catch (error) {
    console.error("Error updating claimed address:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message: errorMessage });
  }
});


export default router;
