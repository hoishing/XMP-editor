import { ImagePlus, FolderOpen } from "lucide-react";

interface FileSelectorProps {
  onSelectFiles: () => void;
  onSelectFolder: () => void;
  loading: boolean;
}

export function FileSelector({
  onSelectFiles,
  onSelectFolder,
  loading,
}: FileSelectorProps) {
  return (
    <div className="flex gap-2">
      <button
        className="btn btn-ghost btn-sm"
        onClick={onSelectFiles}
        disabled={loading}
      >
        <ImagePlus className="h-4 w-4" />
        {loading ? "Loading..." : "Select Files"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={onSelectFolder}
        disabled={loading}
      >
        <FolderOpen className="h-4 w-4" />
        {loading ? "Loading..." : "Select Folder"}
      </button>
    </div>
  );
}
