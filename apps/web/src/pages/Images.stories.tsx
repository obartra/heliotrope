import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import type { ImagesViewProps } from './Images';
import { ImagesView } from './Images';

const ts = { seconds: 1700000000, nanoseconds: 0 };

const placeholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const noopAsync = fn();

const defaultProps: ImagesViewProps = {
  images: [],
  loading: false,
  error: null,
  onUpload: noopAsync,
  onDelete: noopAsync,
  onDeleteImageAndRules: noopAsync,
  onReassignAndDelete: noopAsync,
  onRename: noopAsync,
  onUpdateTags: noopAsync,
  onReplace: noopAsync,
  getReferencingRules: fn().mockResolvedValue([]),
};

const meta: Meta<typeof ImagesView> = {
  title: 'Pages/Images',
  component: ImagesView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ImagesView>;

export const Empty: Story = {
  args: {
    ...defaultProps,
  },
};

export const Populated: Story = {
  args: {
    ...defaultProps,
    images: [
      {
        data: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          filename: 'sunset.png',
          displayName: 'Sunset',
          storagePath: 'users/abc/avatars/550e8400-e29b-41d4-a716-446655440001.png',
          contentType: 'image/png',
          bytes: 204800,
          width: 512,
          height: 512,
          tags: ['weather'],
          createdAt: ts,
          updatedAt: ts,
        },
        downloadUrl: placeholder,
      },
      {
        data: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          filename: 'beach.png',
          displayName: 'Beach Day',
          storagePath: 'users/abc/avatars/550e8400-e29b-41d4-a716-446655440002.png',
          contentType: 'image/png',
          bytes: 153600,
          width: 256,
          height: 256,
          tags: ['location', 'weather'],
          createdAt: ts,
          updatedAt: ts,
        },
        downloadUrl: placeholder,
      },
      {
        data: {
          id: '550e8400-e29b-41d4-a716-446655440003',
          filename: 'default.png',
          displayName: 'Default Avatar',
          storagePath: 'users/abc/avatars/550e8400-e29b-41d4-a716-446655440003.png',
          contentType: 'image/png',
          bytes: 51200,
          width: 128,
          height: 128,
          tags: [],
          createdAt: ts,
          updatedAt: ts,
        },
        downloadUrl: placeholder,
      },
      {
        data: {
          id: '550e8400-e29b-41d4-a716-446655440004',
          filename: 'xmas.png',
          displayName: 'Christmas',
          storagePath: 'users/abc/avatars/550e8400-e29b-41d4-a716-446655440004.png',
          contentType: 'image/png',
          bytes: 307200,
          width: 512,
          height: 512,
          tags: ['holiday'],
          createdAt: ts,
          updatedAt: ts,
        },
        downloadUrl: placeholder,
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    ...defaultProps,
    loading: true,
  },
};

export const Error: Story = {
  args: {
    ...defaultProps,
    error: 'Failed to subscribe to image collection. Check your network connection.',
  },
};
