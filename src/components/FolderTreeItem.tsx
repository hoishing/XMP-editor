import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen } from "lucide-react";
import type { FolderNode } from "@/types";

interface FolderTreeItemProps {
  node: FolderNode;
  depth: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
}

export function FolderTreeItem({
  node,
  depth,
  selectedFolderId,
  onSelectFolder,
}: FolderTreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.children.length > 0;

  const handleClick = useCallback(() => {
    onSelectFolder(node.id);
    if (hasChildren) {
      setExpanded(true);
    }
  }, [node.id, hasChildren, onSelectFolder]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-base-300 ${
          isSelected ? "bg-base-300 font-medium" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={handleToggle}
            className="flex-shrink-0 p-0.5 -ml-1 hover:bg-base-content/10 rounded"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}
        {isSelected || expanded ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-base-content/60" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-base-content/60" />
        )}
        <span className="truncate">{node.name}</span>
        {node.imageCount > 0 && (
          <span className="ml-auto text-xs text-base-content/50 flex-shrink-0">
            {node.imageCount}
          </span>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
