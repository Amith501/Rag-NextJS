"use client";

import { useEffect, useRef, useState } from "react";

type Source = { content: string; source?: string; page?: number };
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources?: Source[]; error?: boolean };

type UploadedDoc = {
  documentId: string;
  filename: string;
  pages: number;
  chunks: number;
};

// Fixed at build time. In demo mode uploads are hidden and the server
// always searches the DEMO_DOCUMENT_ID document.
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const STORAGE_KEY = "rag-docs";
const SUGGESTIONS = [
  "Summarize this document",
  "What are the key points?",
  "List any important dates or numbers",
];
const DEMO_SUGGESTIONS = [
  "What does LangServe do?",
  "What are the limitations of LangChain?",
  "What is LangGraph used for?",
];

const DEMO_DOC: UploadedDoc = {
  documentId: "demo",
  filename: "langchain.pdf",
  pages: 14,
  chunks: 31,
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  const [docs, setDocs] = useState<UploadedDoc[]>(DEMO ? [DEMO_DOC] : []);
  const [activeId, setActiveId] = useState<string | null>(
    DEMO ? DEMO_DOC.documentId : null
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const activeDoc = docs.find((d) => d.documentId === activeId);
  const suggestions = DEMO ? DEMO_SUGGESTIONS : SUGGESTIONS;

  // Remember uploaded documents across refreshes (full app only)
  useEffect(() => {
    if (DEMO) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      ) as UploadedDoc[];
      if (saved.length) {
        setDocs(saved);
        setActiveId(saved[0].documentId);
      }
    } catch {
      /* ignore bad data */
    }
  }, []);

  useEffect(() => {
    if (DEMO) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch {
      /* storage unavailable */
    }
  }, [docs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  function pickFile(f: File | undefined | null) {
    setUploadError("");
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadError("File is larger than 5 MB. Choose a smaller PDF.");
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file || DEMO) return;
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.step
            ? `${data.error} (failed at: ${data.step})`
            : data.error || "Upload failed"
        );
      }
      const doc: UploadedDoc = {
        documentId: data.documentId,
        filename: data.filename,
        pages: data.pages,
        chunks: data.chunks,
      };
      setDocs((d) => [doc, ...d]);
      setActiveId(doc.documentId);
      setMessages([]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || asking) return;

    // Last few turns, so follow-up questions can be rewritten on the server
    const history = messages
      .filter((m) => m.role === "user" || !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    if (textRef.current) textRef.current.style.height = "auto";
    setAsking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          documentId: activeId ?? undefined,
          history,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get an answer");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            typeof data.answer === "string"
              ? data.answer
              : JSON.stringify(data.answer),
          sources: data.sources,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: e instanceof Error ? e.message : "Could not get an answer",
          error: true,
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const focusRing =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B6B]";

  return (
    <main className="min-h-screen bg-[#EDF0F3] text-[#16212C] md:flex md:h-screen">
      {/* Left: documents */}
      <aside className="border-b border-[#CBD3DB] bg-[#F7F9FA] p-6 md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          PDF Q&amp;A
        </h1>
        <p className="mt-1 text-sm text-[#52606D]">
          {DEMO
            ? "Ask questions about a sample paper on LangChain."
            : "Upload a PDF, then ask questions about what is inside it."}
        </p>

        {DEMO && (
          <div className="mt-6 rounded-md border border-[#CBD3DB] bg-white px-3 py-3">
            <p className="truncate text-sm font-medium">{DEMO_DOC.filename}</p>
            <p className="text-xs text-[#52606D]">
              {DEMO_DOC.pages} pages, {DEMO_DOC.chunks} passages indexed
            </p>
            <p className="mt-2 text-xs text-[#7B8794]">
              Uploads are turned off in this public demo. Answers come from this
              document and cite the page they used.
            </p>
          </div>
        )}

        {!DEMO && (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`mt-6 rounded-md border-2 border-dashed p-5 text-center transition-colors ${
                dragging
                  ? "border-[#0F6B6B] bg-[#E3F2F2]"
                  : "border-[#9AA7B4] bg-white"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="peer sr-only"
                id="pdf"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <label
                htmlFor="pdf"
                className="cursor-pointer text-sm font-medium text-[#0F6B6B] underline underline-offset-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0F6B6B]"
              >
                Choose a PDF
              </label>
              <span className="text-sm text-[#52606D]"> or drop it here</span>
              <p className="mt-1 text-xs text-[#7B8794]">Up to 5 MB</p>

              {file && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded bg-[#EDF0F3] px-2 py-1 text-left text-sm">
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-[#52606D]">
                    {formatSize(file.size)}
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={upload}
              disabled={!file || uploading}
              className={`mt-3 w-full rounded-md bg-[#0F6B6B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0B5555] disabled:cursor-not-allowed disabled:bg-[#9AA7B4] ${focusRing}`}
            >
              {uploading ? "Reading and indexing PDF…" : "Upload PDF"}
            </button>

            {uploadError && (
              <p
                role="alert"
                className="mt-3 rounded bg-[#FDE8E8] px-3 py-2 text-sm text-[#9B1C1C]"
              >
                {uploadError}
              </p>
            )}
          </>
        )}

        {!DEMO && docs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold">Ask about</h2>
            <ul className="mt-2 space-y-2">
              {docs.map((d) => {
                const selected = d.documentId === activeId;
                return (
                  <li key={d.documentId}>
                    <button
                      onClick={() => setActiveId(d.documentId)}
                      aria-pressed={selected}
                      className={`w-full rounded-md border px-3 py-2 text-left ${focusRing} ${
                        selected
                          ? "border-[#0F6B6B] bg-[#E3F2F2]"
                          : "border-[#CBD3DB] bg-white hover:border-[#9AA7B4]"
                      }`}
                    >
                      <p
                        className="truncate text-sm font-medium"
                        title={d.filename}
                      >
                        {d.filename}
                      </p>
                      <p className="text-xs text-[#52606D]">
                        {d.pages} {d.pages === 1 ? "page" : "pages"}, {d.chunks}{" "}
                        passages indexed
                      </p>
                    </button>
                  </li>
                );
              })}
              {docs.length > 1 && (
                <li>
                  <button
                    onClick={() => setActiveId(null)}
                    aria-pressed={activeId === null}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm font-medium ${focusRing} ${
                      activeId === null
                        ? "border-[#0F6B6B] bg-[#E3F2F2]"
                        : "border-[#CBD3DB] bg-white hover:border-[#9AA7B4]"
                    }`}
                  >
                    All documents
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
      </aside>

      {/* Right: chat */}
      <section className="flex min-h-[70vh] flex-1 flex-col md:min-h-0">
        <header className="flex items-center justify-between gap-3 border-b border-[#CBD3DB] bg-[#F7F9FA] px-4 py-3 md:px-10">
          <p className="truncate text-sm text-[#52606D]">
            {activeDoc
              ? `Answering from ${activeDoc.filename}`
              : docs.length > 0
                ? "Answering from all documents"
                : "No document yet"}
          </p>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className={`shrink-0 rounded px-2 py-1 text-sm text-[#52606D] hover:bg-[#EDF0F3] ${focusRing}`}
            >
              Clear chat
            </button>
          )}
        </header>

        <div
          className="flex-1 overflow-y-auto px-4 py-6 md:px-10"
          aria-live="polite"
        >
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && (
              <div className="pt-10 text-center">
                <p className="font-serif text-xl">
                  {docs.length
                    ? "What do you want to know?"
                    : "Start by uploading a PDF"}
                </p>
                <p className="mt-1 text-sm text-[#52606D]">
                  {docs.length
                    ? "Pick a question below or type your own."
                    : "Your PDF is indexed first, then you can ask about it here."}
                </p>
                {docs.length > 0 && (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className={`rounded-full border border-[#9AA7B4] bg-white px-3 py-1.5 text-sm hover:border-[#0F6B6B] hover:text-[#0F6B6B] ${focusRing}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-[#16212C] px-4 py-2.5 text-sm text-white">
                      {m.text}
                    </p>
                  </div>
                );
              }
              const pages = m.sources
                ? [
                    ...new Set(
                      m.sources
                        .map((s) => s.page)
                        .filter((p): p is number => !!p)
                    ),
                  ].sort((a, b) => a - b)
                : [];
              return (
                <div key={i} className="max-w-[92%]">
                  <p
                    className={`whitespace-pre-wrap font-serif text-[17px] leading-7 ${
                      m.error ? "text-[#9B1C1C]" : ""
                    }`}
                  >
                    {m.text}
                  </p>

                  {!m.error && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#52606D]">
                      <button
                        onClick={() => copy(m.text, i)}
                        className={`rounded px-2 py-1 hover:bg-[#E1E6EB] ${focusRing}`}
                      >
                        {copied === i ? "Copied" : "Copy answer"}
                      </button>
                      {pages.length > 0 && (
                        <span className="rounded bg-[#FFF3C4] px-2 py-1 text-[#5C4A00]">
                          {pages.length === 1 ? "Page" : "Pages"}{" "}
                          {pages.join(", ")}
                        </span>
                      )}
                    </div>
                  )}

                  {m.sources && m.sources.length > 0 && (
                    <details className="mt-3 rounded-md border border-[#CBD3DB] bg-white text-sm">
                      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-[#0F6B6B]">
                        Passages used ({m.sources.length})
                      </summary>
                      <ul className="space-y-2 border-t border-[#CBD3DB] p-3">
                        {m.sources.map((s, j) => (
                          <li
                            key={j}
                            className="border-l-4 border-[#F2C94C] bg-[#FFFAE5] px-3 py-2"
                          >
                            <p className="line-clamp-4 text-[#3E4C59]">
                              {s.content}
                            </p>
                            {(s.source || s.page) && (
                              <p className="mt-1 text-xs text-[#7B8794]">
                                {s.source}
                                {s.page ? `, page ${s.page}` : ""}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}

            {asking && (
              <div
                className="flex items-center gap-2 text-sm text-[#52606D]"
                role="status"
              >
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 rounded-full bg-[#0F6B6B] motion-safe:animate-pulse"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </span>
                Searching the document…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-[#CBD3DB] bg-[#F7F9FA] px-4 py-4 md:px-10">
          <div className="mx-auto flex max-w-2xl gap-2">
            <textarea
              ref={textRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              rows={1}
              maxLength={500}
              placeholder={
                docs.length
                  ? "Ask a question about the document"
                  : "Upload a PDF first"
              }
              disabled={docs.length === 0}
              aria-label="Your question"
              className="max-h-32 flex-1 resize-none rounded-md border border-[#9AA7B4] bg-white px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6B6B] disabled:bg-[#EDF0F3]"
            />
            <button
              onClick={() => ask()}
              disabled={!question.trim() || asking || docs.length === 0}
              className={`rounded-md bg-[#0F6B6B] px-5 text-sm font-medium text-white hover:bg-[#0B5555] disabled:cursor-not-allowed disabled:bg-[#9AA7B4] ${focusRing}`}
            >
              Ask
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-xs text-[#7B8794]">
            Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </section>
    </main>
  );
}