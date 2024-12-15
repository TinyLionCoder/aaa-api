import express from "express";

import MessageResponse from "../interfaces/MessageResponse";
import auth from "./auth";
import setupWallet from "./setupWallet";
import totalMembers from "./totalMembers";
import payout from "./payout";

const router = express.Router();

router.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏🌏",
  });
});
router.use("/", auth);
router.use("/", setupWallet);
router.use("/", totalMembers);
router.use("/", payout);

export default router;
