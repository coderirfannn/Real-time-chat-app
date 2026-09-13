export interface SignedUploadDescriptor {
  uploadUrl: string;
  fileUrl: string;
  fileKey: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  token?: string;
  expiresAt: string;
}

export interface IStorageProvider {
  /**
   * Generates a signed upload URL descriptor allowing clients to upload directly to storage.
   */
  generateSignedUploadUrl(params: {
    fileKey: string;
    mimeType: string;
    size: number;
    expiresInSeconds: number;
    baseUrl?: string;
  }): Promise<SignedUploadDescriptor>;

  /**
   * Returns the publicly accessible URL for a given file key.
   */
  getPublicUrl(fileKey: string, baseUrl?: string): string;

  /**
   * Deletes a file from storage by its key.
   */
  deleteFile(fileKey: string): Promise<void>;

  /**
   * Saves a raw buffer to storage (used for local uploads or server-side processing).
   */
  saveBuffer(
    fileKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ fileUrl: string; size: number }>;

  /**
   * Verifies whether an upload signature/token is valid and not expired.
   */
  verifyUploadSignature(fileKey: string, signature: string, expires: number): boolean;
}
