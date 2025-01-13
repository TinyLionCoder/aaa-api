import express, { Request, Response } from "express";
import { algoIndexerClient } from "../algorand/config";
import { massSend } from "../algorand/transactionHelpers/massSend";

const router = express.Router();

// Helper function to chunk an array
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

router.post("/send", async (req: Request, res: Response) => {
  req.setTimeout(0); // Disable request timeout
  try {
    // Example request body: { "assetId": 12345, "amount": 10, "decimals": 0 }
    const { assetId, amount, decimals } = req.body;

    if (
      assetId === undefined ||
      amount === undefined ||
      decimals === undefined
    ) {
      return res.status(400).json({
        error: "Missing one or more required fields: assetId, amount, decimals",
      });
    }

    // Use the Indexer to look up all balances for the asset
    const assetBalances = await algoIndexerClient.lookupAssetBalances(assetId).do();

    // Filter out addresses that have opted in
    // (In Algorand, "amount >= 0" in an asset’s balance means they've opted in.)
    const optedInWallets = assetBalances.balances
      .filter((bal: any) => bal.amount >= 0)
      .map((bal: any) => bal.address);

    // Decide how large each batch will be
    const BATCH_SIZE = 10;
    const addressBatches = chunkArray(optedInWallets, BATCH_SIZE);

    const results: any = [];

    // Process each batch sequentially
    for (const batch of addressBatches) {
      // For each batch, send transactions in parallel
      const batchPromises = batch.map(async (walletAddr) => {
        try {
          const txResult = await massSend(
            walletAddr,
            amount,
            assetId,
            decimals
          );
          return {
            address: walletAddr,
            txId: txResult.txId,
            status: "success" as const,
          };
        } catch (err) {
          console.error(`Failed sending to ${walletAddr}:`, err);
          return {
            address: walletAddr,
            status: "failed" as const,
            error: (err as Error).message || "Unknown error",
          };
        }
      });

      // Wait for the entire batch to finish
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Optionally: you could add a delay here if you need to throttle requests
      // await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return res.status(200).json({
      message: "Mass send to opted-in wallets completed.",
      totalWallets: optedInWallets.length,
      results,
    });
  } catch (error) {
    console.error("Error in /mass-send endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ message: errorMessage });
  }
});

export default router;
