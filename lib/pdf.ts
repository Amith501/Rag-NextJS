// import { PDFParse } from "pdf-parse";

// export const LoadPdf = async (file: File) => {
//   const buffer = Buffer.from(await file.arrayBuffer());

//   const parser = new PDFParse({ data: buffer });

//   try {
//     const data = await parser.getText();

//     return {
//       text: data.text,
//       page: data.total,
//     };
//   } finally {
//     await parser.destroy();
//   }
// };


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
    };
  } finally {
    await parser.destroy();
  }
};