import algosdk from "algosdk";
import 'dotenv/config'

const ALGOD_API_ADDR = "https://testnet-api.voi.nodly.io";
const ALGOD_PORT = "";
const ALGOD_API_TOKEN = {
  "X-API-Key": '',
};
const algodClient = new algosdk.Algodv2(ALGOD_API_TOKEN, ALGOD_API_ADDR, ALGOD_PORT);

async function createASA() {
  const passphrase = process.env["MNEMONIC"];
  const myAddress = algosdk.mnemonicToSecretKey(passphrase).addr;
  const mySk = algosdk.mnemonicToSecretKey(passphrase).sk;
  
  // Get the suggested transaction parameters
  const suggestedParams = await algodClient.getTransactionParams().do();

  // Define the asset creation parameters
  const assetDef = {
    total: 1000000000000,
    decimals: 0,
    defaultFrozen: false,
    unitName: "TRND",
    assetName: "TRND",
    manager: myAddress,
    reserve: myAddress,
    freeze: myAddress,
    clawback: myAddress,
    url: "https://twitter.com/trendyCrypto01",
    metadataHash: ""
  };

  // Create the ASA creation transaction
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParams(
    myAddress,
    algosdk.encodeObj("Creating TRND Asset"),
    assetDef.total,
    assetDef.decimals,
    assetDef.defaultFrozen,
    assetDef.manager,
    assetDef.reserve,
    assetDef.freeze,
    assetDef.clawback,
    assetDef.unitName,
    assetDef.assetName,
    assetDef.url,
    assetDef.metadataHash,
    suggestedParams
  );


  // Sign the transaction
  const signedTxn = txn.signTxn(mySk);

  // // Send the transaction
  const txConfirmation = await algodClient.sendRawTransaction(signedTxn).do();

  return txConfirmation.txId;
}

createASA().then(txId => {
  console.log("Transaction ID:", txId);
}).catch(error => {
  console.error("Error creating ASA:", error);
});
