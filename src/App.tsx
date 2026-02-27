import { useState, useCallback } from "react";
import { FileSelector } from "@/components/FileSelector";
import { ImageList } from "@/components/ImageList";
import * as jpegModule from "@/lib/jpeg";
import * as pngModule from "@/lib/png";
import * as webpModule from "@/lib/webp";
import { extractDescription, buildXmpXml } from "@/lib/xmp";

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

function App() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);

  const isSupported = "showOpenFilePicker" in window;

  const handleOpenFiles = useCallback(async () => {
    if (!isSupported) return;

    try {
      const handles: FileSystemFileHandle[] = await (
        window as never as {
          showOpenFilePicker(opts: {
            multiple: boolean;
            types: {
              description: string;
              accept: Record<string, string[]>;
            }[];
          }): Promise<FileSystemFileHandle[]>;
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

      const newImages: ImageFile[] = [];

      for (const handle of handles) {
        const file = await handle.getFile();
        const format = detectFormat(file.name);
        if (!format) continue;

        const buffer = await file.arrayBuffer();
        const mod = getFormatModule(format);
        const xmpXml = mod.readXmp(buffer);
        const description = xmpXml ? extractDescription(xmpXml) : "";
        const thumbnailUrl = URL.createObjectURL(file);

        newImages.push({
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

      setImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      // User cancelled the picker
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Error opening files:", err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const handleSave = useCallback(
    async (id: string, newDescription: string) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, saving: true, error: null, saved: false } : img
        )
      );

      try {
        // Find the image entry
        let imageFile: ImageFile | undefined;
        setImages((prev) => {
          imageFile = prev.find((img) => img.id === id);
          return prev;
        });

        if (!imageFile) throw new Error("Image not found");

        // Read fresh buffer from disk
        const file = await imageFile.handle.getFile();
        const buffer = await file.arrayBuffer();

        // Build new XMP and write
        const mod = getFormatModule(imageFile.format);
        const currentXml = mod.readXmp(buffer);
        const newXml = buildXmpXml(currentXml, newDescription);
        const newBuffer = mod.writeXmp(buffer, newXml);

        // Write back to disk
        const writable = await (imageFile.handle as FileSystemFileHandle & {
          createWritable(): Promise<FileSystemWritableFileStream>;
        }).createWritable();
        await writable.write(newBuffer);
        await writable.close();

        setImages((prev) =>
          prev.map((img) =>
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

        // Clear "saved" indicator after 2 seconds
        setTimeout(() => {
          setImages((prev) =>
            prev.map((img) =>
              img.id === id ? { ...img, saved: false } : img
            )
          );
        }, 2000);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error saving file";
        setImages((prev) =>
          prev.map((img) =>
            img.id === id ? { ...img, saving: false, error: message } : img
          )
        );
      }
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.thumbnailUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">
            Browser Not Supported
          </h1>
          <p className="text-muted-foreground">
            This app requires the File System Access API, which is only available
            in Chrome, Edge, and other Chromium-based browsers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              XMP Description Editor
            </h1>
            <p className="text-sm text-muted-foreground">
              Edit image descriptions directly in your local files
            </p>
          </div>
          <FileSelector onSelect={handleOpenFiles} loading={loading} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="text-muted-foreground space-y-2">
              <p className="text-lg">No images loaded</p>
              <p className="text-sm">
                Click "Select Images" to open JPEG, PNG, or WebP files from your
                computer.
              </p>
              <p className="text-sm">
                Changes are saved directly to the files when you leave the
                description field.
              </p>
            </div>
            <FileSelector onSelect={handleOpenFiles} loading={loading} />
          </div>
        ) : (
          <ImageList
            images={images}
            onSave={handleSave}
            onRemove={handleRemove}
          />
        )}
      </main>
    </div>
  );
}

export default App;
