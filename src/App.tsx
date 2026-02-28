import { useState, useCallback } from "react";
import { FileSelector } from "@/components/FileSelector";
import { ImageList } from "@/components/ImageList";
import { FolderTree } from "@/components/FolderTree";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { scanDirectory, findFolderById } from "@/lib/folder";
import * as jpegModule from "@/lib/jpeg";
import * as pngModule from "@/lib/png";
import * as webpModule from "@/lib/webp";
import { extractDescription, buildXmpXml } from "@/lib/xmp";
import type { ImageFormat, ImageFile, FolderNode, SourceMode } from "@/types";

function detectFormat(name: string): ImageFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return null;
}

function getFormatModule(format: ImageFormat) {
  switch (format) {
    case "jpeg":
      return jpegModule;
    case "png":
      return pngModule;
    case "webp":
      return webpModule;
  }
}

async function loadImagesFromHandles(
  handles: FileSystemFileHandle[]
): Promise<ImageFile[]> {
  const images: ImageFile[] = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    const format = detectFormat(file.name);
    if (!format) continue;

    const buffer = await file.arrayBuffer();
    const mod = getFormatModule(format);
    const xmpXml = mod.readXmp(buffer);
    const description = xmpXml ? extractDescription(xmpXml) : "";
    const thumbnailUrl = URL.createObjectURL(file);

    images.push({
      id: crypto.randomUUID(),
      handle,
      name: file.name,
      format,
      description,
      thumbnailUrl,
      existingXmpXml: xmpXml,
      saving: false,
      saved: false,
      error: null,
    });
  }
  return images;
}

function revokeImageUrls(images: ImageFile[]) {
  for (const img of images) {
    URL.revokeObjectURL(img.thumbnailUrl);
  }
}

function App() {
  const { preference, setTheme } = useTheme();
  const [source, setSource] = useState<SourceMode>({ kind: "none" });
  const [loading, setLoading] = useState(false);
  const [folderImagesLoading, setFolderImagesLoading] = useState(false);

  const isSupported = "showOpenFilePicker" in window;

  const updateImages = useCallback(
    (updater: (images: ImageFile[]) => ImageFile[]) => {
      setSource((prev) => {
        if (prev.kind === "files")
          return { ...prev, images: updater(prev.images) };
        if (prev.kind === "folder")
          return { ...prev, images: updater(prev.images) };
        return prev;
      });
    },
    []
  );

  const handleOpenFiles = useCallback(async () => {
    if (!isSupported) return;

    try {
      const handles: FileSystemFileHandle[] = await (
        window as unknown as {
          showOpenFilePicker(opts: OpenFilePickerOptions): Promise<
            FileSystemFileHandle[]
          >;
        }
      ).showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: "Images",
            accept: {
              "image/jpeg": [".jpg", ".jpeg"],
              "image/png": [".png"],
              "image/webp": [".webp"],
            },
          },
        ],
      });

      setLoading(true);
      const newImages = await loadImagesFromHandles(handles);

      setSource((prev) => {
        if (prev.kind === "files") {
          return { kind: "files", images: [...prev.images, ...newImages] };
        }
        if (prev.kind === "folder") {
          revokeImageUrls(prev.images);
        }
        return { kind: "files", images: newImages };
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error opening files:", err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const handleOpenFolder = useCallback(async () => {
    if (!isSupported) return;

    try {
      const dirHandle = await (
        window as unknown as {
          showDirectoryPicker(opts: {
            mode: string;
          }): Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker({ mode: "readwrite" });

      setLoading(true);

      setSource((prev) => {
        if (prev.kind === "files" || prev.kind === "folder") {
          revokeImageUrls(prev.images);
        }
        return { kind: "none" };
      });

      const root = await scanDirectory(dirHandle);

      setSource({
        kind: "folder",
        root,
        selectedFolderId: null,
        images: [],
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error opening folder:", err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const handleSelectTreeFolder = useCallback(async (folderId: string) => {
    let folderNode: FolderNode | null = null;

    setSource((prev) => {
      if (prev.kind !== "folder") return prev;
      revokeImageUrls(prev.images);
      folderNode = findFolderById(prev.root, folderId);
      return { ...prev, selectedFolderId: folderId, images: [] };
    });

    if (!folderNode) return;

    setFolderImagesLoading(true);

    try {
      const newImages = await loadImagesFromHandles(
        (folderNode as FolderNode).imageHandles
      );

      setSource((prev) => {
        if (prev.kind !== "folder" || prev.selectedFolderId !== folderId)
          return prev;
        return { ...prev, images: newImages };
      });
    } catch (err) {
      console.error("Error loading folder images:", err);
    } finally {
      setFolderImagesLoading(false);
    }
  }, []);

  const handleSave = useCallback(
    async (id: string, newDescription: string) => {
      updateImages((imgs) =>
        imgs.map((img) =>
          img.id === id
            ? { ...img, saving: true, error: null, saved: false }
            : img
        )
      );

      try {
        let imageFile: ImageFile | undefined;
        setSource((prev) => {
          const images =
            prev.kind === "files" || prev.kind === "folder"
              ? prev.images
              : [];
          imageFile = images.find((img) => img.id === id);
          return prev;
        });

        if (!imageFile) throw new Error("Image not found");

        const file = await imageFile.handle.getFile();
        const buffer = await file.arrayBuffer();

        const mod = getFormatModule(imageFile.format);
        const currentXml = mod.readXmp(buffer);
        const newXml = buildXmpXml(currentXml, newDescription);
        const newBuffer = mod.writeXmp(buffer, newXml);

        const writable = await imageFile.handle.createWritable();
        await writable.write(newBuffer);
        await writable.close();

        updateImages((imgs) =>
          imgs.map((img) =>
            img.id === id
              ? {
                  ...img,
                  description: newDescription,
                  existingXmpXml: newXml,
                  saving: false,
                  saved: true,
                  error: null,
                }
              : img
          )
        );

        setTimeout(() => {
          updateImages((imgs) =>
            imgs.map((img) =>
              img.id === id ? { ...img, saved: false } : img
            )
          );
        }, 2000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error saving file";
        updateImages((imgs) =>
          imgs.map((img) =>
            img.id === id ? { ...img, saving: false, error: message } : img
          )
        );
      }
    },
    [updateImages]
  );

  const handleRemove = useCallback(
    (id: string) => {
      updateImages((imgs) => {
        const img = imgs.find((i) => i.id === id);
        if (img) URL.revokeObjectURL(img.thumbnailUrl);
        return imgs.filter((i) => i.id !== id);
      });
    },
    [updateImages]
  );

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Browser Not Supported</h1>
          <p className="text-base-content/60">
            This app requires the File System Access API, which is only
            available in Chrome, Edge, and other Chromium-based browsers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <header className="border-b border-base-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">XMP Description Editor</h1>
            <p className="text-sm text-base-content/60">
              Edit image descriptions directly in your local files
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle preference={preference} onChangeTheme={setTheme} />
            <FileSelector
              onSelectFiles={handleOpenFiles}
              onSelectFolder={handleOpenFolder}
              loading={loading}
            />
          </div>
        </div>
      </header>

      {source.kind === "none" ? (
        <main className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="text-base-content/60 space-y-2">
              <p className="text-lg">No images loaded</p>
              <p className="text-sm">
                Select individual image files, or choose a folder to browse.
              </p>
              <p className="text-sm">
                Changes are saved directly to the files when you leave the
                description field.
              </p>
            </div>
            <FileSelector
              onSelectFiles={handleOpenFiles}
              onSelectFolder={handleOpenFolder}
              loading={loading}
            />
          </div>
        </main>
      ) : source.kind === "files" ? (
        <main className="container mx-auto px-4 py-6">
          <ImageList
            images={source.images}
            onSave={handleSave}
            onRemove={handleRemove}
          />
        </main>
      ) : (
        <div className="flex">
          <FolderTree
            root={source.root}
            selectedFolderId={source.selectedFolderId}
            onSelectFolder={handleSelectTreeFolder}
          />
          <main className="flex-1 px-4 py-6 min-w-0">
            {source.selectedFolderId === null ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-base-content/60">
                  Select a folder from the sidebar to view its images
                </p>
              </div>
            ) : (
              <ImageList
                images={source.images}
                onSave={handleSave}
                onRemove={handleRemove}
                loading={folderImagesLoading}
                emptyMessage="No images in this folder"
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
