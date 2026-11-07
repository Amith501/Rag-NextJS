


import { PDFParse } from "pdf-parse";

export const LoadPdf = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return {
      text: result.text,
      page: result.total,
//t page by page and store the page number on each chunk.
      pages:result.pages.map((p)=>({num:p.num,text:p.text}))
    };
  } finally {
    await parser.destroy();
  }
};