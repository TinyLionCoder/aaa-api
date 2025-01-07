import express, { Request, Response } from "express";
import { db } from "../config/firebase";
import admin from "firebase-admin";
import { optIn } from "../algorand/opt-in";
import { verifyOriginAndJWT } from "../helpers/verifyOriginandJWT";

const router = express.Router();

router.post("/create-airdrop", async (req: Request, res: Response) => {
  const { userId, email, tokenName, tokenId, amountOfTokenPerClaim } = req.body;

  //Verify request origin and JWT
  const isValidRequest = verifyOriginAndJWT(req, email, userId);
  if (!isValidRequest) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    // Ensure input validation
    if (!tokenName || !tokenId || !amountOfTokenPerClaim) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    // Opt-in to the token
    await optIn(tokenId);

    const airdropCollectionRef = db.collection("airdrops");
    const currentDate = new Date().toISOString();
    const docId = `${tokenName}-${currentDate}`;

    // Check if the document already exists
    const docRef = airdropCollectionRef.doc(docId);
    const docSnapshot = await docRef.get();

    if (docSnapshot.exists) {
      return res.status(400).json({
        message: "Airdrop already exists for the given token and date",
      });
    }

    // Create a new airdrop document
    const newAirdrop = {
      tokenName,
      tokenId,
      amountOfTokenPerClaim,
      completed: false,
      claimedAddresses: [],
      createdAt: admin.firestore.Timestamp.fromDate(new Date()), // Add timestamp for better tracking
    };

    await docRef.set(newAirdrop);

    res.status(201).json({
      message: "Airdrop created successfully",
      airdropId: docId,
    });
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
    // Query the airdrops collection to find the active document
    const airdropCollectionRef = db.collection("airdrops");
    const querySnapshot = await airdropCollectionRef
      .where("tokenName", "==", tokenName)
      .where("completed", "==", false)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No active airdrop found for this token" });
    }

    const doc = querySnapshot.docs[0];
    const docId = doc.id;
    const data = doc.data();

    // Check if the address is already in the claimedAddresses array
    if (data.claimedAddresses && data.claimedAddresses.includes(address)) {
      return res.status(400).json({ message: "Address already claimed" });
    }

    // Update the document to add the new address
    await db.collection("airdrops").doc(docId).update({
      claimedAddresses: admin.firestore.FieldValue.arrayUnion(address),
    });

    return res.status(200).json({ message: "Address added to claimed list" });
  } catch (error) {
    console.error("Error updating claimed address:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message: errorMessage });
  }
});


export default router;
