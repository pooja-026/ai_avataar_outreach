declare module "pdf-parse" {
  type PdfParseResult = { text: string };
  function pdf(buffer: Buffer): Promise<PdfParseResult>;
  export default pdf;
}
