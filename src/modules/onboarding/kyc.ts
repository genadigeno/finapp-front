// Identity verification reads and document encoding (P18-TSK-014).
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../platform/api/api-error.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';

export const KYC_QUERY = ['kyc'] as const;

/** The customer's latest verification case, or `none` when finapp has none (404). */
export type KycCase = { exists: false } | { exists: true; status: string };

export function useKycCase() {
  const api = useApi();
  return useQuery({
    queryKey: KYC_QUERY,
    queryFn: async (): Promise<KycCase> => {
      try {
        const { data } = await ok(api.GET('/v1/me/kyc'));
        return { exists: true, status: data.status ?? 'UNKNOWN' };
      } catch (error) {
        // "No verification case exists for this session" - an answer, not a failure.
        if (error instanceof ApiError && error.status === 404) return { exists: false };
        throw error;
      }
    },
  });
}

/** finapp's limits (DocumentUploadRequest / DocumentBytes): 1 byte to 512 KiB, JPEG, PNG or PDF. */
export const MAX_DOCUMENT_BYTES = 512 * 1024;

export type DocumentContentType = 'JPEG' | 'PNG' | 'PDF';
export type DocumentType = 'PASSPORT' | 'ID_CARD_FRONT' | 'ID_CARD_BACK' | 'DRIVING_LICENCE' | 'PROOF_OF_ADDRESS';

export function contentTypeOf(mime: string): DocumentContentType | undefined {
  switch (mime) {
    case 'image/jpeg':
      return 'JPEG';
    case 'image/png':
      return 'PNG';
    case 'application/pdf':
      return 'PDF';
    default:
      return undefined;
  }
}

export type FileProblem = 'type' | 'empty' | 'too-large';

export function checkFile(file: { type: string; size: number }): FileProblem | undefined {
  if (contentTypeOf(file.type) === undefined) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_DOCUMENT_BYTES) return 'too-large';
  return undefined;
}

/** Standard base64 of the bytes, as finapp's `content` expects. Never logged; dropped once sent. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** The file's bytes, read through FileReader (supported everywhere the application runs). */
export function readBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error('The file could not be read.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}
