import algosdk from "algosdk";

const ALGOD_API_ADDR = "https://mainnet-api.algonode.network";
const ALGOD_INDEXER_ADDR = "https://mainnet-idx.algonode.network";
const ALGOD_PORT = "443";
const ALGOD_API_TOKEN = "";

const algodClient = new algosdk.Algodv2(
  ALGOD_API_TOKEN,
  ALGOD_API_ADDR,
  ALGOD_PORT
);
const algoIndexerClient = new algosdk.Indexer(
  ALGOD_API_TOKEN,
  ALGOD_INDEXER_ADDR,
  ALGOD_PORT
);

export { algodClient, algoIndexerClient };
