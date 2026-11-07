const BASE = "http://localhost:3000";
const DOCUMENT_ID = process.argv[2]; // pass the documentId as an argument
console.log("Testing documentId:", DOCUMENT_ID ?? "NONE (searching all documents)");
console.log("eval v2: retry + 12s pause enabled");
const tests = [
    
  { q: "What does LangServe do?", page: 10, keywords: ["endpoint", "api"], any: true },
  { q: "Which tool is used for monitoring LangServe?", page: 11, keywords: ["langsmith"] },
  { q: "How does LangServe handle high traffic?", page: 10, keywords: ["auto-scaling", "auto‑scaling"], any: true },

  { q: "What metrics can LangSmith track for LangServe?", page: 11, keywords: ["latency", "error"] },
  { q: "What are the security risks of using external providers?", page: 12, keywords: ["data exposure"] },
  { q: "Why can LangChain be complex for new users?", page: 12, keywords: ["learning curve"] },

{ q: "What is LangGraph used for?", page: [8, 9], keywords: ["state"] },
  { q: "Limitations and Criticisms?", page: 12, keywords: ["complexity", "security"] },
  {
    q: "Who won the 2018 FIFA World Cup?",
    page: null,
    keywords: ["i don't know", "could not find", "not mention", "no information"],
    any: true,
  },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function askApi(body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const limited = /429|rate_limit/i.test(String(data.error ?? ""));
    if (res.ok || !limited || attempt === 4) return { res, data };
    const wait = 6000 * attempt;
    console.log(`   rate limited, waiting ${wait / 1000}s (attempt ${attempt})`);
    await sleep(wait);
  }
}
let retrievalHits = 0;
let answerHits = 0;
let withPage = 0;

for (const t of tests) {
 const { res, data } = await askApi({ question: t.q, documentId: DOCUMENT_ID });
  
if (!res.ok) console.log(`   API ERROR (${res.status}) step=${data.step}: ${data.error}`);
  const pages = (data.sources ?? []).map((s) => s.page);
  const answer = String(data.answer ?? "").toLowerCase();

const expected = t.page === null ? [] : [].concat(t.page);
const retrievalOk = t.page === null ? true : expected.some((p) => pages.includes(p));
  const answerOk = t.any
  ? t.keywords.some((k) => answer.includes(k.toLowerCase()))
  : t.keywords.every((k) => answer.includes(k.toLowerCase()));

  if (t.page !== null) withPage++;
  if (t.page !== null && retrievalOk) retrievalHits++;
  if (answerOk) answerHits++;
if (!answerOk) console.log(`   answer: ${answer.slice(0, 200)}`);
console.log(`   pages: [${pages.join(", ")}]`);
  console.log(
    `${retrievalOk ? "R-OK" : "R-MISS"} ${answerOk ? "A-OK" : "A-MISS"}  ${t.q}`
  );
  if (!retrievalOk) console.log(`   expected page ${t.page}, got pages [${pages.join(", ")}]`);
await sleep(12000);
}

console.log(`\nRetrieval: ${retrievalHits}/${withPage}`);
console.log(`Answers:   ${answerHits}/${tests.length}`);