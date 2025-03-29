import express from "express";

import MessageResponse from "../interfaces/MessageResponse";
import setupWallet from "./setupWallet";
import totalMembers from "./totalMembers";
import payout from "./payout";
import verify from "./verify";
import myTeam from "./myTeam";
import signup from "./signup";
import login from "./login";
import getUserDetails from "./getUserDetails";
import createAirdrop from "./airdrop";
import massSendToOptedInWallet from "./massSendToOptedInWallet";
import user from "./user";
import dailyCheckIn from "./dailyCheckIn";
import {
  apiLimiter,
  strictLimiter,
  moderateLimiter,
  signupLimiter,
} from "../helpers/rateLimiters";

const router = express.Router();

router.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏🌏",
  });
});
//routes
router.use("/signup", signupLimiter, signup);
router.use("/login", moderateLimiter, login);
router.use("/userDetails", moderateLimiter, getUserDetails);
router.use("/config", moderateLimiter, setupWallet);
router.use("/members", apiLimiter, totalMembers);
router.use("/pay", moderateLimiter, payout);
router.use("/user", moderateLimiter, user);
router.use("/verify", strictLimiter, verify);
router.use("/referrals", moderateLimiter, myTeam);
router.use("/airdrop", moderateLimiter, createAirdrop);
router.use("/mass", massSendToOptedInWallet);
router.use("/checkin", moderateLimiter, dailyCheckIn);

export default router;
