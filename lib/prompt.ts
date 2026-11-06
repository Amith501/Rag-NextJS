import { PromptTemplate } from "@langchain/core/prompts";

export const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful PDF assistant.

Answer using only the provided context.
Cite the page number for each fact, like (p. 3). If the answer is not in the context, say you don't know.
If the answer is unavailable, say:
"I could not find this information in the document."

Context:
{context}

Question:
{question}

Answer:
`);