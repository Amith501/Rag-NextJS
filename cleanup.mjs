import { MongoClient } from "mongodb";

const BAD_ID = "a3c352e7-9b64-4af1-b2e4-b0a10c43a28c";
const client = new MongoClient(process.env.MONGO_URI);
await client.connect();
const col = client.db("pdf_asst").collection("documents");

const result = await col.deleteMany({ documentId: BAD_ID });
console.log("Deleted chunks:", result.deletedCount);

const summary = await col
  .aggregate([
    {
      $group: {
        _id: { id: "$documentId", source: "$source" },
        chunks: { $sum: 1 },
        pages: { $addToSet: "$page" },
        maxLength: { $max: { $strLenCP: "$text" } },
      },
    },
  ])
  .toArray();

console.log("\nWhat is left in the database:");
for (const d of summary) {
  console.log(
    `${d._id.source ?? "(no source)"}  id=${d._id.id ?? "none"}  chunks=${d.chunks}  pages=${d.pages.length}  maxLength=${d.maxLength}`
  );
}

await client.close();