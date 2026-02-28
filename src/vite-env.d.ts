/// <reference types="vite/client" />

// File System Access API types
interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  readonly kind: "file";
  readonly name: string;
}

interface FileSystemDirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(
    data:
      | ArrayBuffer
      | Blob
      | string
      | {
          type: string;
          data: ArrayBuffer | Blob | string;
          position?: number;
          size?: number;
        }
  ): Promise<void>;
  close(): Promise<void>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
}

interface Window {
  showOpenFilePicker(
    options?: OpenFilePickerOptions
  ): Promise<FileSystemFileHandle[]>;
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}
