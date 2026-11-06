import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { getVectorStore } from "@/lib/vector-store";

export const runtime = "nodejs";

export async function GET() {
  let step = "embeddings";
  try {
    // 1. Test the Google embeddings call on its own
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-embedding-001",
    });
    const vector = await embeddings.embedQuery("hello world");

    // 2. Test building the vector store
    step = "vector-store";
    const store = await getVectorStore();

    // 3. Test saving one document
    step = "save";
    await store.addDocuments([
      { pageContent: "test document", metadata: { source: "test" } },
    ]);

    return NextResponse.json({ ok: true, dimensions: vector.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, step, error: message }, { status: 500 });
  }
}