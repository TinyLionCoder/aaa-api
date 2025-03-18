import { db } from "../config/firebase";
import admin from "firebase-admin";
import { algodClient } from "../algorand/config"; // Algorand client config
import algosdk from "algosdk";
import dotenv from "dotenv";
dotenv.config();

const GENESIS_REFERRAL_CODE = "GENESIS";

export async function processMonthlyPayouts(limit) {
  try {
    const senderMnemonic = process.env.SENDER_MNEMONIC; // Use a secure method to retrieve this
    if (!senderMnemonic) {
      throw new Error("Sender mnemonic not configured");
    }

    // Decode sender's account
    const senderAccount = algosdk.mnemonicToSecretKey(senderMnemonic);
    const senderAddress = senderAccount.addr;

    // Fetch users excluding Genesis user
    const usersSnapshot = await db
      .collection("users")
      .where("referralCode", "!=", GENESIS_REFERRAL_CODE) // Exclude Genesis user
      .get();

    if (usersSnapshot.empty) {
      throw new Error("No users found for payouts.");
    }

    // Calculate the date one month ago considering variable month lengths
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Filter users who haven't been paid in the last month
    let verifiedNonZeroBalanceUsers = usersSnapshot.docs.filter((userDoc) => {
      const userData = userDoc.data();

      // Convert Firebase Timestamp to JS Date
      const lastPaidDate = userData?.lastPaid?.toDate() || new Date(0);

      return (
        lastPaidDate >= oneMonthAgo && // Ensure last paid is at least a month ago
        userData.verified === true &&
        userData.aaaBalance > 0 &&
        userData.walletAddress
      );
    });

    if (verifiedNonZeroBalanceUsers.length === 0) {
      throw new Error("No users eligible for payouts.");
    }

    // Limit the number of users processed
    const userLimit = parseInt(limit, 10);
    verifiedNonZeroBalanceUsers = verifiedNonZeroBalanceUsers.slice(
      0,
      userLimit
    );

    const BATCH_SIZE = 10; // Number of users to process in each batch
    const payouts = [];

    // Process in batches
    for (let i = 0; i < verifiedNonZeroBalanceUsers.length; i += BATCH_SIZE) {
      const batch = verifiedNonZeroBalanceUsers.slice(i, i + BATCH_SIZE);

      // Process users in the batch concurrently
      await Promise.all(
        batch.map(async (userDoc) => {
          const userData = userDoc.data();
          const userId = userDoc.id;
          const membersToPay = await getVerifiedMembers(userId);
          const payoutAmount = 5 * membersToPay || 0;
          const userWalletAddress = userData.walletAddress;

          try {
            const hasOptedIn = await algodClient
              .accountInformation(userWalletAddress)
              .do();
            const optedIn = hasOptedIn.assets.some(
              (asset) => asset["asset-id"] === parseInt("2004387843", 10)
            );

            if (!optedIn) {
              console.error(`User ${userId} has not opted into the ASA.`);
              return; // Skip this user
            }

            // Create and send Algorand transaction
            const suggestedParams = await algodClient
              .getTransactionParams()
              .do();

            const txn =
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: senderAddress,
                to: userWalletAddress,
                assetIndex: parseInt("2004387843", 10), // ASA ID
                amount: Number(payoutAmount) * 10000000000,
                note: new Uint8Array(Buffer.from("AAA APP: AAA Payment")),
                suggestedParams,
              });

            // Sign transaction
            const signedTxn = txn.signTxn(senderAccount.sk);

            // Send transaction
            const { txId } = await algodClient
              .sendRawTransaction(signedTxn)
              .do();

            console.log(`Transaction sent for user ${userId}: ${txId}`);

            // Check if the payout document already exists
            const payoutRef = db.collection("payouts").doc(userId);
            const payoutDoc = await payoutRef.get();

            if (payoutDoc.exists) {
              // Update existing payout list
              await payoutRef.update({
                payouts: admin.firestore.FieldValue.arrayUnion({
                  payoutAmount,
                  txId,
                  timestamp: admin.firestore.Timestamp.now(),
                }),
              });
            } else {
              // Create a new document for the user
              await payoutRef.set({
                userId,
                payouts: [
                  {
                    payoutAmount,
                    txId,
                    timestamp: admin.firestore.Timestamp.now(),
                  },
                ],
              });
            }

            // Update user balance
            const userRef = db.collection("users").doc(userId);
            await userRef.update({
              aaaBalance: 0,
              lastPaid: admin.firestore.Timestamp.now(),
            });
            console.log(`User ${userId} balance updated to 0.`);

            // Add to payouts array for response
            payouts.push({
              userId,
              payoutAmount,
              txId,
            });
          } catch (error) {
            console.error(`Failed transaction for user ${userId}:`, error);
          }
        })
      );
    }

    return {
      message: "Monthly payouts processed successfully.",
      payouts,
    };
  } catch (error) {
    console.error("Error processing monthly payouts:", error);
    // Re-throw or return an error object as needed
    throw new Error("Internal server error");
  }
}

async function getVerifiedMembers(userId) {
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

  const referralIds = referrals.map((referral) => referral.userId);

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
  return verifiedCount;
}

// ----------- Entry Point (Example) -----------

// Wrap in an IIFE for async/await
(async () => {
  try {
    const limitArg = "1250";
    const result = await processMonthlyPayouts(parseInt(limitArg, 10));
    console.log("Payout result:", result);
  } catch (e) {
    console.error("Error running payout script:", e);
    process.exit(1);
  }
})();
