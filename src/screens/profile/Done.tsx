import { Button } from '@/components/ui/button';

export function Done({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="plain" size="sm" className="font-bold" onClick={onClose}>
      Done
    </Button>
  );
}
