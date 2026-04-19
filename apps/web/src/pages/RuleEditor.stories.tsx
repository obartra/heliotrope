import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import type { RuleEditorViewProps } from './RuleEditor';
import { RuleEditorView } from './RuleEditor';

const ts = { seconds: 1700000000, nanoseconds: 0 };

const placeholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const sampleImages = [
  {
    data: {
      id: 'img-1',
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
      id: 'img-2',
      filename: 'rain.png',
      displayName: 'Rainy',
      storagePath: 'users/u1/avatars/img-2.png',
      contentType: 'image/png',
      bytes: 800,
      width: 256,
      height: 256,
      tags: ['weather'],
      createdAt: ts,
      updatedAt: ts,
    },
    downloadUrl: placeholder,
  },
];

const defaultProps: RuleEditorViewProps = {
  rule: null,
  images: sampleImages,
  loading: false,
  onSave: fn(),
};

const meta: Meta<typeof RuleEditorView> = {
  title: 'Pages/RuleEditor',
  component: RuleEditorView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RuleEditorView>;

export const NewRule: Story = {
  args: {
    ...defaultProps,
    rule: {
      id: 'new-rule-id',
      name: '',
      enabled: true,
      priority: 10,
      imageId: '',
      conditions: [],
      createdAt: ts,
      updatedAt: ts,
    },
  },
};

export const Populated: Story = {
  args: {
    ...defaultProps,
    rule: {
      id: 'rule-1',
      name: 'Sunny day avatar',
      enabled: true,
      priority: 30,
      imageId: 'img-1',
      conditions: [
        { type: 'weather', field: 'temperatureC', op: '>=', value: 25 },
        { type: 'timeOfDay', value: 'day' },
      ],
      createdAt: ts,
      updatedAt: ts,
    },
  },
};

export const Loading: Story = {
  args: { ...defaultProps, loading: true },
};

export const NotFound: Story = {
  args: { ...defaultProps, rule: null },
};
