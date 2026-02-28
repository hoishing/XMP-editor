import { FolderTreeItem } from "@/components/FolderTreeItem";
import type { FolderNode } from "@/types";

interface FolderTreeProps {
  root: FolderNode;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
}

export function FolderTree({
  root,
  selectedFolderId,
  onSelectFolder,
}: FolderTreeProps) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-base-300 h-[calc(100vh-73px)] flex flex-col">
      <div className="p-3 border-b border-base-300">
        <h2 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide">
          Folders
        </h2>
      </div>
      <div className="flex-1 overflow-auto p-2">
        <FolderTreeItem
          node={root}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      </div>
    </div>
  );
}
