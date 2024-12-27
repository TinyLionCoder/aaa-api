import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const verifyToken = (token: string, email: string, userId: string) => {
  let isValid = false;
  
  jwt.verify(`${token}`, `${process.env.JWT_SECRET_KEY}`, (err, decoded) => {
    if (err) {
      console.log(err);
      isValid = false;
    }
    if (
      typeof decoded !== "string" &&
      decoded?.email !== email &&
      decoded?.userId !== userId
    ) {
      isValid = false;
    } else {
      isValid = true;
    }
  });

  return isValid;
};

export default verifyToken;
