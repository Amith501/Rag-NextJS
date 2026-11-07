import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { promptTemplate } from "@/lib/prompt";
import { llm } from "@/lib/llm";
import { getVectorStore } from "@/lib/vector-store";
import { rewriteQuestion, type Turn } from "@/lib/rewrite";

export const runtime = "nodejs";

// Only create limiters when Upstash is configured, so local dev works without it
const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasRedis ? Redis.fromEnv() : null;
const perMinute = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(4, "1 m"), prefix: "rag-min" })
  : null;
const perDay = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(40, "1 d"), prefix: "rag-day" })
  : null;

export async function POST(req: NextRequest) {
  let step = "start";
  try {
    const { question, documentId, history } = await req.json();

    if (typeof question !== "string" || !question.trim() || question.length > 500) {
      return NextResponse.json(
        { error: "Question is required and must be under 500 characters" },
        { status: 400 }
      );
    }

    const isOwner =
      !!process.env.DEMO_KEY && req.headers.get("x-demo-key") === process.env.DEMO_KEY;

    // The server decides which document is searched, never the browser
    const effectiveDocId = isOwner ? documentId : process.env.DEMO_DOCUMENT_ID;
    if (!isOwner && !effectiveDocId) {
      return NextResponse.json({ error: "Demo is not configured" }, { status: 500 });
    }

    if (!isOwner) {
      if (perMinute && perDay) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
        const [m, d] = await Promise.all([perMinute.limit(ip), perDay.limit(ip)]);
        if (!m.success || !d.success) {
          return NextResponse.json(
            { error: "Too many questions. Please wait a minute and try again." },
            { status: 429 }
          );
        }
      } else if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Rate limiting is not configured" }, { status: 503 });
      }
    }

    const safeHistory: Turn[] = Array.isArray(history)
      ? history
          .filter(
            (t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string"
          )
          .slice(-6)
          .map((t) => ({ role: t.role, text: t.text.slice(0, 500) }))
      : [];

    step = "rewrite";
    const standalone = await rewriteQuestion(question, safeHistory);

    step = "search";
    const vectorStore = await getVectorStore();
    const documents = await vectorStore.similaritySearch(
      standalone,
      4,
      effectiveDocId ? { preFilter: { documentId: { $eq: effectiveDocId } } } : undefined
    );

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "No relevant information found.",
        rewritten: standalone,
        sources: [],
      });
    }

    step = "llm";
    const context = documents
      .map((d) => `${d.metadata.page ? `[Page ${d.metadata.page}] ` : ""}${d.pageContent}`)
      .join("\n\n");
    const prompt = await promptTemplate.format({
      context,
      question: standalone,
      standalone,
    });
    const response = await llm.invoke(prompt);

    return NextResponse.json({
      success: true,
      answer: response.content,
      rewritten: standalone,
      sources: documents.map((d) => ({
        content: d.pageContent,
        source: d.metadata.source,
        page: d.metadata.page,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate answer";
    const limited = /429|rate_limit/i.test(message);
    console.log(`ASK FAILED at step [${step}]: ${message.slice(0, 200)}`);
    return NextResponse.json(
      {
        success: false,
        step,
        error: limited
          ? "The AI service is busy right now. Please wait a few seconds and try again."
          : message,
      },
      { status: limited ? 429 : 500 }
    );
  }
}