import express from "express";

import MessageResponse from "../interfaces/MessageResponse";
import setupWallet from "./setupWallet";
import totalMembers from "./totalMembers";
import payout from "./payout";
import verify from "./verify";
import myTeam from "./myTeam";
import signup from "./signup";
import login from "./login";
import {
  apiLimiter,
  strictLimiter,
  moderateLimiter,
} from "../helpers/rateLimiters";

const router = express.Router();

router.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏🌏",
  });
});
router.use("/signup", strictLimiter, signup);
router.use("/login", moderateLimiter, login);
router.use("/config", moderateLimiter, setupWallet);
router.use("/members", apiLimiter, totalMembers);
router.use("/pay", moderateLimiter, payout);
router.use("/verify", strictLimiter, verify);
router.use("/referrals", moderateLimiter, myTeam);

export default router;
