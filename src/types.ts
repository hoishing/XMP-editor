export type ImageFormat = "jpeg" | "png" | "webp";

export interface ImageFile {
  id: string;
  handle: FileSystemFileHandle;
  name: string;
  format: ImageFormat;
  description: string;
  thumbnailUrl: string;
  existingXmpXml: string | null;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  handle: FileSystemDirectoryHandle;
  children: FolderNode[];
  imageHandles: FileSystemFileHandle[];
  imageCount: number;
}

export type SourceMode =
  | { kind: "none" }
  | { kind: "files"; images: ImageFile[] }
  | {
      kind: "folder";
      root: FolderNode;
      selectedFolderId: string | null;
      images: ImageFile[];
    };
