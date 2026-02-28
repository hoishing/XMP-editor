import type { FolderNode } from "@/types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex < 0) return false;
  return IMAGE_EXTENSIONS.has(lower.slice(dotIndex));
}

export async function scanDirectory(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string = ""
): Promise<FolderNode> {
  const currentPath = parentPath
    ? `${parentPath}/${dirHandle.name}`
    : dirHandle.name;
  const children: FolderNode[] = [];
  const imageHandles: FileSystemFileHandle[] = [];

  for await (const entry of dirHandle.values()) {
    try {
      if (entry.kind === "directory") {
        const childNode = await scanDirectory(
          entry as FileSystemDirectoryHandle,
          currentPath
        );
        if (childNode.imageCount > 0 || childNode.children.length > 0) {
          children.push(childNode);
        }
      } else if (entry.kind === "file" && isImageFile(entry.name)) {
        imageHandles.push(entry as FileSystemFileHandle);
      }
    } catch {
      // Skip inaccessible entries
    }
  }

  children.sort((a, b) => a.name.localeCompare(b.name));
  imageHandles.sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: crypto.randomUUID(),
    name: dirHandle.name,
    path: currentPath,
    handle: dirHandle,
    children,
    imageHandles,
    imageCount: imageHandles.length,
  };
}

export function findFolderById(
  root: FolderNode,
  id: string
): FolderNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findFolderById(child, id);
    if (found) return found;
  }
  return null;
}
