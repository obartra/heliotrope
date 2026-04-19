import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ImageUploader } from './ImageUploader';

const meta: Meta<typeof ImageUploader> = {
  title: 'Components/ImageUploader',
  component: ImageUploader,
  args: {
    onUpload: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ImageUploader>;

export const Idle: Story = {};

export const Uploading: Story = {
  args: {
    initialUploading: true,
    initialProgress: 45,
  },
};

export const ValidationError: Story = {
  args: {
    initialErrors: ['File must be PNG or JPEG.', 'Image must be at least 128x128 pixels.'],
  },
};

export const Warning: Story = {
  args: {
    initialWarnings: [
      "This image exceeds Slack's 1 MB limit. It will upload to the library but may fail when Slack tries to use it.",
      'This image is not square. Slack may crop it unexpectedly.',
    ],
  },
};
