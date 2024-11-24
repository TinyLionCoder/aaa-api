import {
  poolUtils,
  getAccountInformation,
  RemoveLiquidity,
} from "@tinymanorg/tinyman-js-sdk";
import { algodClient } from "../config";

export const getTokenHoldingFromLP = async (
  userAddress: any,
  asset1ID: any,
  asset1UnitName: any,
  asset2ID: any,
  asset2UnitName: any
) => {
  try {
    const asset_1 = { id: asset1ID, unit_name: asset1UnitName };
    const asset_2 = { id: asset2ID, unit_name: asset2UnitName };

    const poolInfo = await poolUtils.v2.getPoolInfo({
      network: "mainnet",
      client: algodClient,
      asset1ID: Number(asset_1.id),
      asset2ID: Number(asset_2.id),
    });

    const poolReserves = await poolUtils.v2.getPoolReserves(
      algodClient,
      poolInfo
    );

    const ownedPoolTokens = await getOwnedAssetAmount(
      userAddress,
      poolInfo.poolTokenID
    );

    const quote = RemoveLiquidity.v2.getSingleAssetRemoveLiquidityQuote({
      pool: poolInfo,
      reserves: poolReserves,
      poolTokenIn: ownedPoolTokens,
      assetOutID: poolInfo.asset1ID,
      decimals: { assetIn: 6, assetOut: 6 },
    });

    return Number(quote?.assetOut?.amount) / Math.pow(10, 6);
  } catch (error) {
    return 0;
  }
};

async function getOwnedAssetAmount(accountAddress: any, assetId: any) {
  const { assets } = await getAccountInformation(algodClient, accountAddress);
  return assets.find((asset) => asset["asset-id"] === assetId)?.amount || 0;
}
