// import fs from "fs";
// import { PDFParse } from "pdf-parse";
// import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
// import {MongoDBAtlasVectorSearch } from "@langchain/mongodb"
// import {MongoClient} from "mongodb"
// import { ChatGroq } from "@langchain/groq";
// import {PromptTemplate} from "@langchain/groq"

// export const LoadPdf = async (filepath) => {
//   const buffer = fs.readFile(filepath);
//   const parser = new PDFParse({ data: buffer });
//   const data = await parser.getText();
//   await parser.destroy();
//   return { text: data.text, page: data.total }; //this is just text from pdf and page to see total pages
// };

// //text splitter

// const splitter = new RecursiveCharacterTextSplitter({
//   chunkSize: 1000,
//   chunkOverlap: 200,
// });

// export const SplitDocument = async (text: any, metadata = {}) => {
//   const document = splitter.createDocuments([text], [metadata]);
//   return document;
// };

// //emdeddings 


// const emdeddings= new GoogleGenerativeAIEmbeddings({
//   model:"gemini-embedding-001", 
// })

// //vector db 

// const client = new MongoClient(process.env.MONGODB_URI as string)
// const db= client.db("pdf_asst")
// const collection= db.collection("documents")
// export const vectorStore= new MongoDBAtlasVectorSearch(emdeddings,{
//   collection,
//   indexName:"vecor_index",
//   textKey: "text",
//   embeddingKey:"embedding"

// })

// //llm 

// const llm= new ChatGroq({
//   apiKey: process.env.GROQ_API_KEY
// })

// const prompt= PromptTemplate.

// export const askQuestion = async (question)=>{
//   const documents= await vectorStore.similaritySearch(
//     question, 4

//   )
//   const context= documents.map((doc)=> doc.pageContent).join("\n\n")
// // }

//update
// import { NextResponse } from "next/server";
// import { LoadPdf } from "@/lib/pdf";
// import { SplitDocument } from "@/lib/splitter";

// export async function GET() {
//   return NextResponse.json({
//     message: "Upload API route is working",
//   });
// }

// export async function POST(req: Request) {
//   try {
//     const formData = await req.formData();
//     const file = formData.get("file");

//     if (!(file instanceof File)) {
//       return NextResponse.json(
//         { error: "PDF file is required" },
//         { status: 400 }
//       );
//     }

//     // Step 1: Extract PDF text
//     const result = await LoadPdf(file);

//     // Step 2: Split text into chunks
//     const documents = await SplitDocument(result.text, {
//       source: file.name,
//     });

//     // Step 3: Check generated chunks
//     console.log("Total pages:", result.page);
//     console.log("Total chunks:", documents.length);
//     console.log("First chunk:", documents[0]);

//     return NextResponse.json({
//       message: "PDF processed successfully",
//       pages: result.page,
//       chunks: documents.length,
//     });

//   } catch (error) {
//     console.error("PDF ERROR:", error);

//     return NextResponse.json(
//       { error: String(error) },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(req: Request) {
//   try {
//     const formData = await req.formData();
//     const file = formData.get("file");

//     if (!(file instanceof File)) {
//       return NextResponse.json(
//         { error: "PDF file is required" },
//         { status: 400 }
//       );
//     }

//     const result = await LoadPdf(file);

//     return NextResponse.json({
//       text: result.text,
//       pages: result.page,
//     });
//   } catch (error) {
//     console.error("PDF ERROR:", error);

//     return NextResponse.json(
//       { error: String(error) },
//       { status: 500 }
//     );
//   }
// }



import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { LoadPdf } from "@/lib/pdf";
import { SplitDocument } from "@/lib/splitter";
import { getVectorStore } from "@/lib/vector-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let step = "start";
  try {
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
    const documents = await SplitDocument(result.text, {
      documentId,
      source: file.name,
      pages: result.page,
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

