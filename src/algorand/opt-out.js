import algosdk from "algosdk";
import { algodClient } from "./config.js";

export async function optOut(address, assetId) {
  try {
    // Input validation
    if (!algosdk.isValidAddress(address)) {
      throw new Error("Invalid Algorand address provided.");
    }

    const suggestedParams = await algodClient.getTransactionParams().do();

    // Create an asset transfer transaction with the close-to address
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      address, // from account (also the sender)
      address, // to account (receiver, same as sender)
      address, // close remainder to (to close the asset holding)
      undefined, // revocation target (not used in opting out)
      0, // amount (0 for opting out)
      undefined, // note field (optional)
      parseInt(assetId, 10), // asset ID
      suggestedParams // transaction parameters
    );

    const singleTxnGroups = [{ txn, signers: [address] }];
    return singleTxnGroups;
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
}

// export async function autoOptOutRewardedAsset(assetId) {
//   const mnemonic = process.env.REACT_APP_MNEMONIC;
//   const rewardProviderAccount = algosdk.mnemonicToSecretKey(mnemonic);

//   try {
//     const suggestedParams = await algodClient.getTransactionParams().do();

//     const assetBalance = await checkAssetBalance(
//       rewardProviderAccount.addr,
//       assetId
//     );

//     let txn;
//     console.log("Asset balance: ", assetBalance);
//     if (assetBalance === 0) {
//       // Opt-out transaction since balance is zero
//       txn = algosdk.makeAssetTransferTxnWithSuggestedParams(
//         rewardProviderAccount.addr, // from account (also the sender)
//         rewardProviderAccount.addr, // to account (receiver, same as sender)
//         rewardProviderAccount.addr, // close remainder to (to close the asset holding)
//         undefined, // revocation target (not used in opting out)
//         0, // amount (0 for opting out)
//         undefined, // note field (optional)
//         parseInt(assetId, 10), // asset ID
//         suggestedParams // transaction parameters
//       );

//       const signedTxn = algosdk.signTransaction(txn, rewardProviderAccount.sk);
//       const txConfirmation = await algodClient
//         .sendRawTransaction(signedTxn.blob)
//         .do();

//       console.log("Transaction ID:", txConfirmation.txId);
//     }
//   } catch (error) {
//     console.error("An error occurred:", error);
//     throw error;
//   }
// }

async function checkAssetBalance(address, assetId) {
  try {
    const accountAssetInfo = await algodClient
      .accountAssetInformation(address, assetId)
      .do();

    return accountAssetInfo["asset-holding"]?.amount;
  } catch (error) {
    console.error("Error checking asset holdings: ", error);
    return false;
  }
}
