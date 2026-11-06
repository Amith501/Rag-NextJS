"use client";

import { useEffect, useRef, useState } from "react";

type Source = { content: string; source?: string };
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; sources?: Source[]; error?: boolean };

type UploadedDoc = { filename: string; pages: number; chunks: number };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setUploadError("File is larger than 5 MB.");
      return;
    }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setDocs((d) => [
        { filename: data.filename, pages: data.pages, chunks: data.chunks },
        ...d,
      ]);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get an answer");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: typeof data.answer === "string" ? data.answer : JSON.stringify(data.answer),
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

  return (
    <main className="min-h-screen bg-[#EDF0F3] text-[#16212C] md:flex md:h-screen">
      {/* Left: documents */}
      <aside className="border-b border-[#CBD3DB] bg-[#F7F9FA] p-6 md:w-[340px] md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">PDF Q&amp;A</h1>
        <p className="mt-1 text-sm text-[#52606D]">
          Upload a PDF, then ask questions about what is inside it.
        </p>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className="mt-6 rounded-md border-2 border-dashed border-[#9AA7B4] bg-white p-5 text-center"
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            id="pdf"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <label
            htmlFor="pdf"
            className="cursor-pointer text-sm font-medium text-[#0F6B6B] underline underline-offset-2 focus-within:outline"
          >
            Choose a PDF
          </label>
          <span className="text-sm text-[#52606D]"> or drop it here</span>
          <p className="mt-1 text-xs text-[#7B8794]">Up to 5 MB</p>

          {file && (
            <p className="mt-3 truncate rounded bg-[#EDF0F3] px-2 py-1 text-sm" title={file.name}>
              {file.name}
            </p>
          )}
        </div>

        <button
          onClick={upload}
          disabled={!file || uploading}
          className="mt-3 w-full rounded-md bg-[#0F6B6B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0B5555] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B6B] disabled:cursor-not-allowed disabled:bg-[#9AA7B4]"
        >
          {uploading ? "Processing PDF…" : "Upload PDF"}
        </button>

        {uploadError && (
          <p role="alert" className="mt-3 rounded bg-[#FDE8E8] px-3 py-2 text-sm text-[#9B1C1C]">
            {uploadError}
          </p>
        )}

        {docs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold">Ready to ask about</h2>
            <ul className="mt-2 space-y-2">
              {docs.map((d, i) => (
                <li key={i} className="rounded-md border border-[#CBD3DB] bg-white px-3 py-2">
                  <p className="truncate text-sm font-medium" title={d.filename}>
                    {d.filename}
                  </p>
                  <p className="text-xs text-[#52606D]">
                    {d.pages} {d.pages === 1 ? "page" : "pages"}, {d.chunks} passages indexed
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Right: chat */}
      <section className="flex min-h-[70vh] flex-1 flex-col md:min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.length === 0 && (
              <div className="pt-10 text-center">
                <p className="font-serif text-xl">Ask your first question</p>
                <p className="mt-1 text-sm text-[#52606D]">
                  Upload a PDF on the left, then try &ldquo;Summarize this document&rdquo;.
                </p>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-[#16212C] px-4 py-2.5 text-sm text-white">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%]">
                  <p
                    className={`whitespace-pre-wrap font-serif text-[17px] leading-7 ${
                      m.error ? "text-[#9B1C1C]" : ""
                    }`}
                  >
                    {m.text}
                  </p>
                  {m.sources && m.sources.length > 0 && (
                    <details className="mt-3 rounded-md border border-[#CBD3DB] bg-white text-sm">
                      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-[#0F6B6B]">
                        Passages used ({m.sources.length})
                      </summary>
                      <ul className="space-y-2 border-t border-[#CBD3DB] p-3">
                        {m.sources.map((s, j) => (
                          <li key={j} className="border-l-4 border-[#F2C94C] bg-[#FFFAE5] px-3 py-2">
                            <p className="line-clamp-4 text-[#3E4C59]">{s.content}</p>
                            {s.source && (
                              <p className="mt-1 text-xs text-[#7B8794]">From {s.source}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )
            )}

            {asking && <p className="text-sm text-[#52606D]">Searching the document…</p>}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-[#CBD3DB] bg-[#F7F9FA] px-4 py-4 md:px-10">
          <div className="mx-auto flex max-w-2xl gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              rows={1}
              placeholder="Ask a question about your PDF"
              aria-label="Your question"
              className="max-h-32 flex-1 resize-none rounded-md border border-[#9AA7B4] bg-white px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6B6B]"
            />
            <button
              onClick={ask}
              disabled={!question.trim() || asking}
              className="rounded-md bg-[#0F6B6B] px-5 text-sm font-medium text-white hover:bg-[#0B5555] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F6B6B] disabled:cursor-not-allowed disabled:bg-[#9AA7B4]"
            >
              Ask
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
