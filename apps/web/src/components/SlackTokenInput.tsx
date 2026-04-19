import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SlackTokenInputProps {
  connected: boolean;
  teamName: string | null;
  userId: string | null;
  lastValidatedAt: string | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (token: string) => void;
}

export function SlackTokenInput({
  connected,
  teamName,
  userId,
  lastValidatedAt,
  submitting,
  error,
  onSubmit,
}: SlackTokenInputProps) {
  const [token, setToken] = useState('');
  const [showInput, setShowInput] = useState(!connected);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (token.trim()) {
      onSubmit(token.trim());
      setToken('');
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Slack Connection</h2>

      {connected && !showInput && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Workspace:</span>{' '}
            <span className="font-medium">{teamName ?? 'Unknown'}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">User ID:</span>{' '}
            <span className="font-mono text-xs">{userId ?? 'Unknown'}</span>
          </p>
          {lastValidatedAt && (
            <p className="text-sm">
              <span className="text-muted-foreground">Last validated:</span>{' '}
              <span>{lastValidatedAt}</span>
            </p>
          )}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowInput(true)}>
            Reconnect
          </Button>
        </div>
      )}

      {(showInput || !connected) && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {connected && (
            <p className="text-sm text-muted-foreground">
              Enter a new Slack token to replace the current connection.
            </p>
          )}
          <div>
            <Label htmlFor="slack-token">Slack API Token</Label>
            <Input
              id="slack-token"
              type="password"
              placeholder="xoxp-..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={!token.trim() || submitting}>
              {submitting ? 'Connecting...' : 'Connect'}
            </Button>
            {connected && (
              <Button type="button" variant="ghost" onClick={() => setShowInput(false)}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
