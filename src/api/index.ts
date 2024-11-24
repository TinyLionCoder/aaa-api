import express from "express";

import MessageResponse from "../interfaces/MessageResponse";
import auth from "./auth";

const router = express.Router();

router.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "API - 👋🌎🌍🌏",
  });
});
router.use("/", auth);

export default router;
