import { useState, useCallback, useRef, useEffect } from "react";
import type { ImageFile } from "@/types";

interface ImageItemProps {
  image: ImageFile;
  onSave: (id: string, description: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export function ImageItem({ image, onSave, onRemove }: ImageItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [thumbSize, setThumbSize] = useState(0);
  const [localValue, setLocalValue] = useState(image.description);
  const [lastSaved, setLastSaved] = useState(image.description);

  if (image.description !== lastSaved) {
    setLastSaved(image.description);
  }

  const isDirty = localValue !== lastSaved;

  const handleBlur = useCallback(() => {
    if (isDirty) {
      onSave(image.id, localValue);
      setLastSaved(localValue);
    }
  }, [image.id, localValue, isDirty, onSave]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setThumbSize(Math.round(entry.contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formatLabel =
    image.format === "jpeg"
      ? "JPEG"
      : image.format === "png"
        ? "PNG"
        : "WebP";

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4">
        <div className="flex gap-4">
          <img
            src={image.thumbnailUrl}
            alt={image.name}
            className="object-contain rounded-md flex-shrink-0"
            style={{ width: thumbSize, height: thumbSize }}
          />
          <div ref={contentRef} className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {image.name}
                </span>
                <span className="badge badge-sm badge-soft flex-shrink-0">
                  {formatLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {image.saving && (
                  <span className="text-xs text-base-content/60">
                    Saving...
                  </span>
                )}
                {image.saved && (
                  <span className="text-xs text-success">Saved</span>
                )}
                {image.error && (
                  <span className="text-xs text-error" title={image.error}>
                    Error
                  </span>
                )}
                {isDirty && !image.saving && (
                  <span className="text-xs text-warning">Unsaved</span>
                )}
                <button
                  className="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-error"
                  onClick={() => onRemove(image.id)}
                  title="Remove from list"
                >
                  ×
                </button>
              </div>
            </div>
            <textarea
              className={`textarea textarea-bordered w-full ${isDirty ? "textarea-warning" : ""}`}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleBlur}
              placeholder="Enter image description..."
              disabled={image.saving}
              rows={2}
            />
            {image.error && (
              <p className="text-xs text-error">{image.error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
