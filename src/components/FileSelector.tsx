import { Button } from "@/components/ui/button";

interface FileSelectorProps {
  onSelect: () => void;
  loading: boolean;
}

export function FileSelector({ onSelect, loading }: FileSelectorProps) {
  return (
    <Button onClick={onSelect} disabled={loading}>
      {loading ? "Loading..." : "Select Images"}
    </Button>
  );
}
