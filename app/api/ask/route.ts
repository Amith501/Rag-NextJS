// import { NextRequest, NextResponse } from "next/server";
// import { promptTemplate } from "@/lib/prompt";
// import { llm } from "@/lib/llm";

// export const runtime = "nodejs";

// export async function POST(req: NextRequest) {
//   try {
//     const { question } = await req.json();

//     if (!question || typeof question !== "string") {
//       return NextResponse.json(
//         { error: "Question is required" },
//         { status: 400 }
//       );
//     }

//     // // 1. Get vector store instance
//     // const vectorStore = await getVectorStore();

//     // 2. Search similar documents
//     const documents = await vectorStore.similaritySearch(
//       question,
//       4
//     );

//     if (documents.length === 0) {
//       return NextResponse.json({
//         success: true,
//         answer: "No relevant information found.",
//         sources: [],
//       });
//     }

//     // 3. Extract context
//     const context = documents
//       .map((doc) => doc.pageContent)
//       .join("\n\n");

//     // 4. Format prompt
//     const prompt = await promptTemplate.format({
//       context,
//       question,
//     });

//     // 5. Send prompt to Groq
//     const response = await llm.invoke(prompt);

//     // 6. Return response
//     return NextResponse.json({
//       success: true,
//       answer: response.content,
//       sources: documents.map((doc) => ({
//         content: doc.pageContent,
//         source: doc.metadata.source,
//       })),
//     });

//   } catch (error) {
//     console.error("RAG ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         error:
//           error instanceof Error
//             ? error.message
//             : "Failed to generate answer",
//       },
//       { status: 500 }
//     );
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import { promptTemplate } from "@/lib/prompt";
import { llm } from "@/lib/llm";
import { getVectorStore } from "@/lib/vector-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let step = "start";
  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    step = "search";
    const vectorStore = await getVectorStore();
    const documents = await vectorStore.similaritySearch(question, 4);

    if (documents.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "No relevant information found.",
        sources: [],
      });
    }

    step = "llm";
    const context = documents.map((d) => d.pageContent).join("\n\n");
    const prompt = await promptTemplate.format({ context, question });
    const response = await llm.invoke(prompt);

    return NextResponse.json({
      success: true,
      answer: response.content,
      sources: documents.map((d) => ({
        content: d.pageContent,
        source: d.metadata.source,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate answer";
    console.log(`ASK FAILED at step [${step}]: ${message}`);
    return NextResponse.json({ success: false, step, error: message }, { status: 500 });
  }
}