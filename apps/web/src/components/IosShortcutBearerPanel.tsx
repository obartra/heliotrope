import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export interface IosShortcutBearerPanelProps {
  bearerCreatedAt: string | null;
  justGeneratedBearer: string | null;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
}

export function IosShortcutBearerPanel({
  bearerCreatedAt,
  justGeneratedBearer,
  generating,
  error,
  onGenerate,
}: IosShortcutBearerPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasExisting = bearerCreatedAt !== null || justGeneratedBearer !== null;

  function handleGenerateClick() {
    if (hasExisting && !justGeneratedBearer) {
      setConfirmOpen(true);
    } else {
      onGenerate();
    }
  }

  function handleConfirm() {
    setConfirmOpen(false);
    onGenerate();
  }

  async function handleCopy() {
    if (justGeneratedBearer) {
      await navigator.clipboard.writeText(justGeneratedBearer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">iOS Shortcut Bearer</h2>

      {justGeneratedBearer && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-amber-600">
            This will not be shown again. Copy it now.
          </p>
          <div className="flex gap-2">
            <Input value={justGeneratedBearer} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {!justGeneratedBearer && bearerCreatedAt && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A bearer token was previously generated on {bearerCreatedAt}.
          </p>
        </div>
      )}

      {!justGeneratedBearer && !bearerCreatedAt && (
        <p className="text-sm text-muted-foreground mb-3">
          Generate a bearer token to authenticate your iOS Shortcut with the location ingestion
          endpoint.
        </p>
      )}

      {error && <p className="text-sm text-destructive mt-2">{error}</p>}

      <Button
        className="mt-3"
        variant={hasExisting ? 'outline' : 'default'}
        disabled={generating}
        onClick={handleGenerateClick}
      >
        {generating ? 'Generating...' : hasExisting ? 'Generate New Bearer' : 'Generate Bearer'}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate bearer token?</DialogTitle>
            <DialogDescription>
              Generating a new bearer will invalidate the current one. Any iOS Shortcut using the
              old bearer will stop working until you update it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
