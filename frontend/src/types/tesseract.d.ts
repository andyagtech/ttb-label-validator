declare module "tesseract.js" {
  interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
    };
  }

  interface Logger {
    status: string;
    progress: number;
  }

  export function recognize(
    image: string | HTMLCanvasElement | HTMLImageElement | Blob | File,
    lang?: string,
    options?: { logger?: (m: Logger) => void },
  ): Promise<RecognizeResult>;
}
