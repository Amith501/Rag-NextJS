// // import { NextResponse } from "next/server";
// // import { connectDB } from "@/lib/db";

// // export async function GET() {
// //   try {
// //     const db = await connectDB();

// //     return NextResponse.json({
// //       success: true,
// //       message: "MongoDB connected successfully",
// //       database: db.connection.name,
// //       readyState: db.connection.readyState,
// //     });
// //   } catch (error: unknown) {
// //     console.error("DB TEST ERROR:", error);

// //     return NextResponse.json(
// //       {
// //         success: false,
// //         error:
// //           error instanceof Error
// //             ? error.message
// //             : String(error),
// //       },
// //       { status: 500 }
// //     );
// //   }
// // }



// import { connectDB } from "@/lib/db";
// import { NextResponse } from "next/server";

// export const runtime = "nodejs";

// export async function GET() {
//   try {
//     const client = await connectDB();

//     return NextResponse.json({
//       success: true,
//       message: "MongoDB connected!",
//       database: client.db("pdf_asst").databaseName,
//     });
//   } catch (error) {
//     return NextResponse.json(
//       {
//         success: false,
//         error:
//           error instanceof Error
//             ? error.message
//             : String(error),
//       },
//       { status: 500 }
//     );
//   }
// }

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const env = {
    MONGO_URI: Boolean(process.env.MONGO_URI),
    GOOGLE_API_KEY: Boolean(process.env.GOOGLE_API_KEY),
    GROQ_API_KEY: Boolean(process.env.GROQ_API_KEY),
  };

  try {
    const client = await connectDB();
    await client.db("pdf_asst").command({ ping: 1 });
    return NextResponse.json({ ok: true, env });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, env, error: message }, { status: 500 });
  }
}