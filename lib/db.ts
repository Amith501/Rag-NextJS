import { MongoClient } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongoPromise?: Promise<MongoClient>;
};

export async function connectDB(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in .env.local");

  if (!globalForMongo._mongoPromise) {
    console.log("DB: creating new connection");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
    globalForMongo._mongoPromise = client.connect().catch((err) => {
      globalForMongo._mongoPromise = undefined; // allow retry
      throw err;
    });
  }
  return globalForMongo._mongoPromise;
}