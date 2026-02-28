import { ImageItem } from "@/components/ImageItem";
import type { ImageFile } from "@/types";

interface ImageListProps {
  images: ImageFile[];
  onSave: (id: string, description: string) => Promise<void>;
  onRemove: (id: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function ImageList({
  images,
  onSave,
  onRemove,
  loading,
  emptyMessage,
}: ImageListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  if (images.length === 0 && emptyMessage) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-base-content/60">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] overflow-auto">
      <div className="space-y-3">
        {images.map((image) => (
          <ImageItem
            key={image.id}
            image={image}
            onSave={onSave}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
