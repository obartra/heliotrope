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

const placeholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export const WithPreview: Story = {
  args: {
    initialPreviewUrl: placeholder,
    initialProcessedInfo: {
      originalWidth: 512,
      originalHeight: 512,
      processedWidth: 512,
      processedHeight: 512,
      wasResized: false,
      wasCropped: false,
    },
  },
};

export const ResizedPreview: Story = {
  args: {
    initialPreviewUrl: placeholder,
    initialProcessedInfo: {
      originalWidth: 3000,
      originalHeight: 3000,
      processedWidth: 1024,
      processedHeight: 1024,
      wasResized: true,
      wasCropped: false,
    },
  },
};

export const CroppedAndResizedPreview: Story = {
  args: {
    initialPreviewUrl: placeholder,
    initialProcessedInfo: {
      originalWidth: 4000,
      originalHeight: 2000,
      processedWidth: 1024,
      processedHeight: 1024,
      wasResized: true,
      wasCropped: true,
    },
  },
};
