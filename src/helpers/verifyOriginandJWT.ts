import { Request, Response } from "express";
import verifyToken from "./jwtVerification";

export const verifyOriginAndJWT = (
  req: Request,
  email: string,
  userId: string
) => {
  let validOrigin = false;
  const origin = req.get("origin");
  if (origin === "https://algoadoptairdrop.vercel.app") {
    validOrigin = true;
  }

  let validJWT = false;
  const token = req.headers.authorization?.replace("Bearer ", "").trim();
  const isJwtValid = verifyToken(`${token}`, email, userId);
  if (isJwtValid) {
    validJWT = true;
  }

  if (validOrigin === true && validJWT === true) {
    return true;
  } else {
    return false;
  }
};
