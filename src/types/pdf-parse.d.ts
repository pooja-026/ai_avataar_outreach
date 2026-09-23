declare module "pdf-parse/lib/pdf-parse" {
  type PdfParseResult = { text: string };
  function pdf(buffer: Buffer): Promise<PdfParseResult>;
  export default pdf;
}
