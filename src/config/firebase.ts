import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config();

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
}

const serviceAccount = JSON.parse(serviceAccountString);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://refferal-test.firebaseio.com", // Replace with your database URL
  });
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
