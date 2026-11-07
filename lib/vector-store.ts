import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { connectDB } from "./db";

type VectorSearchConfig = ConstructorParameters<typeof MongoDBAtlasVectorSearch>[1];

export async function getVectorStore() {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing");
  }

  const client = await connectDB();
  const collection = client.db("pdf_asst").collection("documents");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-embedding-001",
  });

  return new MongoDBAtlasVectorSearch(embeddings, {
    // Two copies of the mongodb package have incompatible types; the runtime object is the same
    collection: collection as unknown as VectorSearchConfig["collection"],
    indexName: "vector_index",
    textKey: "text",
    embeddingKey: "embedding",
  });
}