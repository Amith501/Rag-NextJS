import { embeddings } from "./embeddings";

export const testEmbeddings = async () => {
  const text = "React is a JavaScript library";

  const vector = await embeddings.embedQuery(text);

  console.log("Embedding length:", vector.length);
  console.log("First 10 values:", vector.slice(0, 10));

  return vector;
};