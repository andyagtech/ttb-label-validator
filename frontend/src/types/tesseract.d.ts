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

  interface Worker {
    recognize(
      image: string | HTMLCanvasElement | HTMLImageElement | Blob | File,
      options?: { rectangle?: { top: number; left: number; width: number; height: number } },
    ): Promise<RecognizeResult>;
    setParameters(params: Record<string, string>): Promise<void>;
    terminate(): Promise<void>;
  }

  export function createWorker(
    lang: string,
    oem?: number,
    options?: Record<string, unknown>,
  ): Promise<Worker>;

  export function recognize(
    image: string | HTMLCanvasElement | HTMLImageElement | Blob | File,
    lang?: string,
    options?: { logger?: (m: Logger) => void },
  ): Promise<RecognizeResult>;
}
