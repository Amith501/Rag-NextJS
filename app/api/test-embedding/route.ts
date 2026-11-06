import { NextResponse } from "next/server";
import { testEmbeddings } from "@/lib/testEmbeddings";

export async function GET() {
  try {
    const vector = await testEmbeddings();

    return NextResponse.json({
      success: true,
      dimensions: vector.length,
      sample: vector.slice(0, 10),
    });
  } catch (error) {
    console.error("EMBEDDING ERROR:", error);

    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}