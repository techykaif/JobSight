import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';

export type SupportedMimeType = 
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain';

export interface ParseResult {
  text: string;
  sourceType: string;
  metadata?: any;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: SupportedMimeType
): Promise<ParseResult> {
  if (buffer.length === 0) {
    throw new Error('Empty file uploaded');
  }

  // 5MB limit
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('File size exceeds 5MB limit');
  }

  try {
    switch (mimeType) {
      case 'application/pdf': {
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const data = await pdfParse(buffer);
        if (!data.text || data.text.trim() === '') {
          throw new Error('No text found in PDF. It might be an image-based PDF or corrupted.');
        }
        
        return {
          text: data.text.trim(),
          sourceType: 'PDF',
          metadata: {
            numpages: data.numpages,
            info: data.info
          }
        };
      }
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const result = await mammoth.extractRawText({ buffer });
        if (!result.value || result.value.trim() === '') {
          throw new Error('No text found in DOCX file.');
        }
        return {
          text: result.value.trim(),
          sourceType: 'DOCX',
          metadata: {
            messages: result.messages
          }
        };
      }
      
      case 'text/plain': {
        const text = buffer.toString('utf-8');
        if (text.trim() === '') {
          throw new Error('Text file is empty.');
        }
        return {
          text: text.trim(),
          sourceType: 'TXT'
        };
      }
      
      default:
        throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  } catch (error: any) {
    throw new Error(`Document extraction failed: ${error.message}`);
  }
}
