import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import type { SettingsViewProps } from './Settings';
import { SettingsView } from './Settings';

const ts = { seconds: 1700000000, nanoseconds: 0 };

const placeholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const noop = fn();

const sampleImages = [
  {
    data: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      filename: 'sun.png',
      displayName: 'Sunny',
      storagePath: 'users/u1/avatars/img-1.png',
      contentType: 'image/png',
      bytes: 1000,
      width: 256,
      height: 256,
      tags: ['weather'],
      createdAt: ts,
      updatedAt: ts,
    },
    downloadUrl: placeholder,
  },
  {
    data: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      filename: 'moon.png',
      displayName: 'Night Mode',
      storagePath: 'users/u1/avatars/img-2.png',
      contentType: 'image/png',
      bytes: 1200,
      width: 256,
      height: 256,
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    },
    downloadUrl: placeholder,
  },
];

const defaultProps: SettingsViewProps = {
  loading: false,
  error: null,
  slack: {
    connected: false,
    teamName: null,
    userId: null,
    lastValidatedAt: null,
    submitting: false,
    error: null,
    onSubmit: noop,
  },
  bearer: {
    bearerCreatedAt: null,
    justGeneratedBearer: null,
    generating: false,
    error: null,
    onGenerate: noop,
  },
  displayName: 'Test User',
  schedulerInterval: 15,
  minSecondsBetweenUploads: 300,
  defaultImageId: null,
  images: sampleImages,
  onUpdateDisplayName: noop,
  onUpdateSchedulerInterval: noop,
  onUpdateMinSeconds: noop,
  onUpdateDefaultImage: noop,
  saveStatus: null,
};

const meta: Meta<typeof SettingsView> = {
  title: 'Pages/Settings',
  component: SettingsView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettingsView>;

export const Disconnected: Story = {
  args: { ...defaultProps },
};

export const Connected: Story = {
  args: {
    ...defaultProps,
    slack: {
      ...defaultProps.slack,
      connected: true,
      teamName: 'Acme Corp',
      userId: 'U0123456789',
      lastValidatedAt: '1/15/2026, 10:30:00 AM',
    },
    bearer: {
      ...defaultProps.bearer,
      bearerCreatedAt: '1/10/2026, 3:00:00 PM',
    },
    defaultImageId: '550e8400-e29b-41d4-a716-446655440001',
  },
};

export const Loading: Story = {
  args: { ...defaultProps, loading: true },
};

export const Error: Story = {
  args: { ...defaultProps, error: 'Failed to load settings.' },
};

export const Saved: Story = {
  args: { ...defaultProps, saveStatus: 'Saved' },
};
