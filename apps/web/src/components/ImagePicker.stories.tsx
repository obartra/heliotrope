import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter } from 'react-router-dom';
import { ImagePicker } from './ImagePicker';

function ts() {
  return Timestamp.now();
}

const sampleImages = [
  {
    data: {
      id: 'img-1',
      filename: 'sun.png',
      displayName: 'Sunny day',
      storagePath: 'users/u1/avatars/img-1.png',
      contentType: 'image/png',
      bytes: 1000,
      width: 256,
      height: 256,
      tags: ['weather'],
      createdAt: ts(),
      updatedAt: ts(),
    },
    downloadUrl: 'https://placehold.co/256x256/f59e0b/fff?text=Sun',
  },
  {
    data: {
      id: 'img-2',
      filename: 'rain.png',
      displayName: 'Rainy day',
      storagePath: 'users/u1/avatars/img-2.png',
      contentType: 'image/png',
      bytes: 1200,
      width: 256,
      height: 256,
      tags: ['weather'],
      createdAt: ts(),
      updatedAt: ts(),
    },
    downloadUrl: 'https://placehold.co/256x256/3b82f6/fff?text=Rain',
  },
  {
    data: {
      id: 'img-3',
      filename: 'office.png',
      displayName: 'At the office',
      storagePath: 'users/u1/avatars/img-3.png',
      contentType: 'image/png',
      bytes: 800,
      width: 256,
      height: 256,
      tags: ['location'],
      createdAt: ts(),
      updatedAt: ts(),
    },
    downloadUrl: 'https://placehold.co/256x256/22c55e/fff?text=Office',
  },
  {
    data: {
      id: 'img-4',
      filename: 'default.png',
      displayName: 'Default avatar',
      storagePath: 'users/u1/avatars/img-4.png',
      contentType: 'image/png',
      bytes: 500,
      width: 256,
      height: 256,
      tags: [],
      createdAt: ts(),
      updatedAt: ts(),
    },
    downloadUrl: 'https://placehold.co/256x256/6b7280/fff?text=Default',
  },
];

const meta: Meta<typeof ImagePicker> = {
  title: 'Components/ImagePicker',
  component: ImagePicker,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: { onSelect: fn() },
};

export default meta;
type Story = StoryObj<typeof ImagePicker>;

export const Populated: Story = {
  args: {
    images: sampleImages,
    selectedImageId: 'img-2',
  },
};

export const Empty: Story = {
  args: {
    images: [],
    selectedImageId: null,
  },
};

export const NoneSelected: Story = {
  args: {
    images: sampleImages,
    selectedImageId: null,
  },
};
