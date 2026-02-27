import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ImageFile } from "@/App";

interface ImageItemProps {
  image: ImageFile;
  onSave: (id: string, description: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export function ImageItem({ image, onSave, onRemove }: ImageItemProps) {
  const [localValue, setLocalValue] = useState(image.description);
  const lastSavedRef = useRef(image.description);

  // Sync when the parent updates (e.g., after save)
  useEffect(() => {
    lastSavedRef.current = image.description;
  }, [image.description]);

  const isDirty = localValue !== lastSavedRef.current;

  const handleBlur = useCallback(() => {
    if (localValue !== lastSavedRef.current) {
      onSave(image.id, localValue);
      lastSavedRef.current = localValue;
    }
  }, [image.id, localValue, onSave]);

  const formatLabel =
    image.format === "jpeg"
      ? "JPEG"
      : image.format === "png"
        ? "PNG"
        : "WebP";

  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <img
          src={image.thumbnailUrl}
          alt={image.name}
          className="w-20 h-20 object-cover rounded-md flex-shrink-0"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{image.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground flex-shrink-0">
                {formatLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {image.saving && (
                <span className="text-xs text-muted-foreground">Saving...</span>
              )}
              {image.saved && (
                <span className="text-xs text-green-600">Saved</span>
              )}
              {image.error && (
                <span className="text-xs text-destructive" title={image.error}>
                  Error
                </span>
              )}
              {isDirty && !image.saving && (
                <span className="text-xs text-amber-500">Unsaved</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(image.id)}
                title="Remove from list"
              >
                ×
              </Button>
            </div>
          </div>
          <Textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            placeholder="Enter image description..."
            disabled={image.saving}
            className={isDirty ? "border-amber-400" : ""}
            rows={2}
          />
          {image.error && (
            <p className="text-xs text-destructive">{image.error}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
