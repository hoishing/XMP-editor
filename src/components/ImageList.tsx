import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageItem } from "@/components/ImageItem";
import type { ImageFile } from "@/App";

interface ImageListProps {
  images: ImageFile[];
  onSave: (id: string, description: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export function ImageList({ images, onSave, onRemove }: ImageListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-140px)]">
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
    </ScrollArea>
  );
}
