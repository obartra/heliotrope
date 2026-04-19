import type { FirestoreTimestamp } from '@heliotrope/schema';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IosShortcutBearerPanel,
  type IosShortcutBearerPanelProps,
} from '@/components/IosShortcutBearerPanel';
import { SlackTokenInput, type SlackTokenInputProps } from '@/components/SlackTokenInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { callFunction } from '@/lib/callFunction';
import { useImages, type ImageWithUrl } from '@/lib/useImages';
import { useProfile } from '@/lib/useProfile';

export interface SettingsViewProps {
  loading: boolean;
  error: string | null;
  slack: SlackTokenInputProps;
  bearer: IosShortcutBearerPanelProps;
  displayName: string;
  schedulerInterval: number;
  minSecondsBetweenUploads: number;
  defaultImageId: string | null;
  images: ImageWithUrl[];
  onUpdateDisplayName: (name: string) => void;
  onUpdateSchedulerInterval: (minutes: number) => void;
  onUpdateMinSeconds: (seconds: number) => void;
  onUpdateDefaultImage: (imageId: string | null) => void;
  saveStatus: string | null;
}

export function SettingsView({
  loading,
  error,
  slack,
  bearer,
  displayName,
  schedulerInterval,
  minSecondsBetweenUploads,
  defaultImageId,
  images,
  onUpdateDisplayName,
  onUpdateSchedulerInterval,
  onUpdateMinSeconds,
  onUpdateDefaultImage,
  saveStatus,
}: SettingsViewProps) {
  const [localName, setLocalName] = useState(displayName);
  const [localInterval, setLocalInterval] = useState(String(schedulerInterval));
  const [localMinSec, setLocalMinSec] = useState(String(minSecondsBetweenUploads));

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button variant="outline" asChild>
          <Link to="/dashboard">Back</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <SlackTokenInput {...slack} />
        <IosShortcutBearerPanel {...bearer} />

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={() => {
                  if (localName.trim() && localName !== displayName) {
                    onUpdateDisplayName(localName.trim());
                  }
                }}
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="scheduler-interval">Scheduler interval (minutes)</Label>
              <Input
                id="scheduler-interval"
                type="number"
                min={5}
                max={1440}
                value={localInterval}
                onChange={(e) => setLocalInterval(e.target.value)}
                onBlur={() => {
                  const val = parseInt(localInterval, 10);
                  if (!isNaN(val) && val >= 5 && val <= 1440 && val !== schedulerInterval) {
                    onUpdateSchedulerInterval(val);
                  } else {
                    setLocalInterval(String(schedulerInterval));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                How often the avatar is re-evaluated (5 to 1440 minutes).
              </p>
            </div>
            <div>
              <Label htmlFor="min-seconds">Min seconds between Slack uploads</Label>
              <Input
                id="min-seconds"
                type="number"
                min={60}
                max={86400}
                value={localMinSec}
                onChange={(e) => setLocalMinSec(e.target.value)}
                onBlur={() => {
                  const val = parseInt(localMinSec, 10);
                  if (
                    !isNaN(val) &&
                    val >= 60 &&
                    val <= 86400 &&
                    val !== minSecondsBetweenUploads
                  ) {
                    onUpdateMinSeconds(val);
                  } else {
                    setLocalMinSec(String(minSecondsBetweenUploads));
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum gap between consecutive Slack profile photo updates (60 to 86400 seconds).
              </p>
            </div>
            <div>
              <Label htmlFor="default-image">Default image</Label>
              <select
                id="default-image"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={defaultImageId ?? ''}
                onChange={(e) => onUpdateDefaultImage(e.target.value || null)}
              >
                <option value="">None</option>
                {images.map((img) => (
                  <option key={img.data.id} value={img.data.id}>
                    {img.data.displayName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Fallback image when no rule matches and no override is active.
              </p>
            </div>
            {saveStatus && <p className="text-sm text-green-600">{saveStatus}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatTimestamp(ts: FirestoreTimestamp | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts.seconds * 1000).toLocaleString();
}

interface SlackResponse {
  ok: boolean;
  slackTeamId?: string;
  slackUserId?: string;
  error?: string;
}

interface BearerResponse {
  ok: boolean;
  bearer?: string;
}

export function Settings() {
  const { profile, loading, error, updateProfile } = useProfile();
  const { images } = useImages();

  const [slackSubmitting, setSlackSubmitting] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [bearerGenerating, setBearerGenerating] = useState(false);
  const [bearerError, setBearerError] = useState<string | null>(null);
  const [justGeneratedBearer, setJustGeneratedBearer] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  function flashSaved() {
    setSaveStatus('Saved');
    setTimeout(() => setSaveStatus(null), 2000);
  }

  const handleSlackSubmit = useCallback(async (token: string) => {
    setSlackSubmitting(true);
    setSlackError(null);
    try {
      const result = await callFunction<SlackResponse>('setSlackToken', { token });
      if (!result.ok) {
        setSlackError(
          'Could not verify this token. Please check that it is correct and try again.',
        );
      }
    } catch {
      setSlackError('Failed to connect. Please try again.');
    } finally {
      setSlackSubmitting(false);
    }
  }, []);

  const handleBearerGenerate = useCallback(async () => {
    setBearerGenerating(true);
    setBearerError(null);
    try {
      const result = await callFunction<BearerResponse>('generateIosShortcutBearer', {});
      if (result.ok && result.bearer) {
        setJustGeneratedBearer(result.bearer);
      } else {
        setBearerError('Failed to generate bearer token.');
      }
    } catch {
      setBearerError('Failed to generate bearer token.');
    } finally {
      setBearerGenerating(false);
    }
  }, []);

  const slackProps: SlackTokenInputProps = {
    connected: profile?.slack?.connected ?? false,
    teamName: profile?.slack?.teamName ?? null,
    userId: profile?.slack?.userId ?? null,
    lastValidatedAt: formatTimestamp(profile?.slack?.lastValidatedAt),
    submitting: slackSubmitting,
    error: slackError,
    onSubmit: (token) => void handleSlackSubmit(token),
  };

  const bearerProps: IosShortcutBearerPanelProps = {
    bearerCreatedAt: formatTimestamp(profile?.iosShortcutBearer?.createdAt),
    justGeneratedBearer,
    generating: bearerGenerating,
    error: bearerError,
    onGenerate: () => void handleBearerGenerate(),
  };

  return (
    <SettingsView
      loading={loading}
      error={error}
      slack={slackProps}
      bearer={bearerProps}
      displayName={profile?.displayName ?? ''}
      schedulerInterval={profile?.scheduler?.intervalMinutes ?? 15}
      minSecondsBetweenUploads={profile?.scheduler?.minSecondsBetweenSlackUploads ?? 300}
      defaultImageId={profile?.defaultImageId ?? null}
      images={images}
      onUpdateDisplayName={(name) => {
        void updateProfile({ displayName: name }).then(flashSaved);
      }}
      onUpdateSchedulerInterval={(minutes) => {
        void updateProfile({
          scheduler: {
            intervalMinutes: minutes,
            minSecondsBetweenSlackUploads: profile?.scheduler?.minSecondsBetweenSlackUploads ?? 300,
          },
        }).then(flashSaved);
      }}
      onUpdateMinSeconds={(seconds) => {
        void updateProfile({
          scheduler: {
            intervalMinutes: profile?.scheduler?.intervalMinutes ?? 15,
            minSecondsBetweenSlackUploads: seconds,
          },
        }).then(flashSaved);
      }}
      onUpdateDefaultImage={(imageId) => {
        void updateProfile({ defaultImageId: imageId }).then(flashSaved);
      }}
      saveStatus={saveStatus}
    />
  );
}
