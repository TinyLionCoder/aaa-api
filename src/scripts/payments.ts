import { db } from "../config/firebase";
import admin from "firebase-admin";
import { algodClient } from "../algorand/config"; // Algorand client config
import algosdk from "algosdk";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const GENESIS_REFERRAL_CODE = "GENESIS";

export async function processMonthlyPayouts(limit: any) {
  try {
    const senderMnemonic = process.env.SENDER_MNEMONIC;
    if (!senderMnemonic) throw new Error("Sender mnemonic not configured");

    const senderAccount = algosdk.mnemonicToSecretKey(senderMnemonic);
    const senderAddress = senderAccount.addr;

    // Fetch users (excluding Genesis)
    const usersSnapshot = await db
      .collection("users")
      .where("referralCode", "!=", GENESIS_REFERRAL_CODE)
      .get();

    if (usersSnapshot.empty) {
      console.log("No users found for payouts.");
      return { message: "No users found for payouts.", payouts: [] };
    }

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    // Filter eligible users
    let eligibleUsers = usersSnapshot.docs.filter((userDoc) => {
      const userData = userDoc.data();
      const lastPaidDate = userData?.lastPaid?.toDate() || new Date(0);

      return (
        // lastPaidDate >= oneMonthAgo && // At least a month ago
        userData.verified === true &&
        userData.aaaBalance > 0 &&
        userData.walletAddress
      );
    });

    if (eligibleUsers.length === 0) {
      console.log("No users eligible for payouts.");
      return { message: "No users eligible for payouts.", payouts: [] };
    }

    const userLimit = parseInt(limit, 10);
    eligibleUsers = eligibleUsers.slice(0, userLimit);

    const BATCH_SIZE = 10;
    const payouts: any = [];

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (userDoc) => {
          try {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const userWalletAddress = userData.walletAddress;

            const currentVerifiedMembers = await getVerifiedMembers(userId);
            const lastVerifiedCount = userData?.lastVerifiedCount || 0;
            const newlyVerifiedMembers =
              currentVerifiedMembers - lastVerifiedCount;

            if (newlyVerifiedMembers <= 0) {
              console.log(`User ${userId} has no new verified members.`);
              return;
            }

            const payoutAmount = 5 // * newlyVerifiedMembers; // 5 tokens per new verified referral

            // Check if user has opted in to AAA ASA
            const hasOptedIn = await algodClient
              .accountInformation(userWalletAddress)
              .do();
            const optedIn = hasOptedIn.assets.some(
              (asset: any) => asset["asset-id"] === parseInt("2004387843", 10)
            );

            if (!optedIn) {
              console.error(`User ${userId} has not opted into the ASA.`);
              return;
            }

            // Create and send transaction
            const suggestedParams = await algodClient
              .getTransactionParams()
              .do();

            const txn =
              algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                from: senderAddress,
                to: userWalletAddress,
                assetIndex: parseInt("2004387843", 10),
                amount: payoutAmount * 10000000000,
                note: new Uint8Array(Buffer.from("AAA APP: AAA Payment")),
                suggestedParams,
              });

            const signedTxn = txn.signTxn(senderAccount.sk);
            const { txId } = await algodClient
              .sendRawTransaction(signedTxn)
              .do();

            console.log(`Transaction sent for user ${userId}: ${txId}`);

            // Store payout details
            const payoutRef = db.collection("payouts").doc(userId);
            const payoutDoc = await payoutRef.get();

            if (payoutDoc.exists) {
              await payoutRef.update({
                payouts: admin.firestore.FieldValue.arrayUnion({
                  payoutAmount,
                  txId,
                  timestamp: admin.firestore.Timestamp.now(),
                }),
              });
            } else {
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

            // Update user balance and last verified count
            const userRef = db.collection("users").doc(userId);
            await userRef.update({
              aaaBalance: userData.aaaBalance - payoutAmount,
              lastPaid: admin.firestore.Timestamp.now(),
              lastVerifiedCount: currentVerifiedMembers, // Update verified count
            });

            console.log(`User ${userId} balance updated to 0.`);

            payouts.push({
              userId,
              payoutAmount,
              txId,
            });
          } catch (error) {
            console.error(`Failed transaction for user ${userDoc.id}:`, error);
          }
        })
      );
    }

    console.log("All users processed successfully.");
    return {
      message: "Monthly payouts processed successfully.",
      payouts,
    };
  } catch (error) {
    console.error("Error processing monthly payouts:", error);
    return { message: "Internal server error", error: (error as Error).message };
  }
}

async function getVerifiedMembers(userId: any) {
  const userSnapshot = await db.collection("users").doc(userId).get();
  if (!userSnapshot.exists) return 0;

  const userData = userSnapshot.data();
  const referrals = userData?.referrals || [];

  if (referrals.length === 0) return 0;

  const referralIds = referrals.map((referral: any) => referral.userId);

  let verifiedCount = 0;
  const chunkSize = 30;
  for (let i = 0; i < referralIds.length; i += chunkSize) {
    const batchIds = referralIds.slice(i, i + chunkSize);

    const referralSnapshots = await db
      .collection("users")
      .where(admin.firestore.FieldPath.documentId(), "in", batchIds)
      .get();

    referralSnapshots.forEach((doc) => {
      const referralData = doc.data();
      if (referralData.verified) verifiedCount++;
    });
  }
  return verifiedCount;
}

// ----------- Entry Point (Example) -----------
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
