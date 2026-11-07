import { NextResponse } from "next/server";
import { randomUUID } from "crypto";


export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  // Local development is open. A deployed site needs the secret key.
  const allowed =
    process.env.NODE_ENV !== "production" ||
    (!!process.env.DEMO_KEY && req.headers.get("x-demo-key") === process.env.DEMO_KEY);

  if (!allowed) {
    return NextResponse.json(
      { error: "Uploads are disabled in the public demo" },
      { status: 403 }
    );
  }

  let step = "start";
  try {
     const { LoadPdf } = await import("@/lib/pdf");
    const { SplitPages } = await import("@/lib/splitter");
    const { getVectorStore } = await import("@/lib/vector-store");
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Maximum file size is 5MB" }, { status: 400 });
    }

    const documentId = randomUUID();

    step = "extract";
    const result = await LoadPdf(file);
    if (!result.text.trim()) {
      return NextResponse.json({ error: "No readable text found in PDF" }, { status: 422 });
    }

    step = "split";
    const documents = await SplitPages(result.pages, {
      documentId,
      source: file.name,
    });

    step = "vector-store";
    const vectorStore = await getVectorStore();

    step = "embed-and-save";
    await vectorStore.addDocuments(documents);

    return NextResponse.json(
      {
        success: true,
        documentId,
        filename: file.name,
        pages: result.page,
        chunks: documents.length,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`UPLOAD FAILED at step [${step}]: ${message}`);
    return NextResponse.json({ success: false, step, error: message }, { status: 500 });
  }
}