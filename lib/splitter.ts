import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  // chunkSize: 1000,
  chunkSize:1500,
  chunkOverlap: 200,
});



export async function SplitPages(
  pages:{num:number,text:string}[],
  metadata:Record<string, unknown >={}
) {
  const docs= []
  for(const p of pages){
    if(!p.text.trim()) continue
    const chunks= await splitter.createDocuments(
      [p.text],[{...metadata,page:p.num}]
    ) 
    docs.push(...chunks)
  }
  return docs;
}