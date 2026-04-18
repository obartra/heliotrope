import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import type { RulesViewProps } from './Rules';
import { RulesView } from './Rules';

const ts = { seconds: 1700000000, nanoseconds: 0 };

const placeholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const noop = fn();

const sampleRules = [
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    name: 'Sunny day avatar',
    enabled: true,
    priority: 30,
    imageId: '550e8400-e29b-41d4-a716-446655440001',
    conditions: [
      { type: 'weather' as const, field: 'temperatureC' as const, op: '>=' as const, value: 25 },
      { type: 'timeOfDay' as const, value: 'day' as const },
    ],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Weekend mode',
    enabled: true,
    priority: 20,
    imageId: '550e8400-e29b-41d4-a716-446655440002',
    conditions: [{ type: 'dayOfWeek' as const, days: [6, 7] as [number, ...number[]] }],
    createdAt: ts,
    updatedAt: ts,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Default',
    enabled: false,
    priority: 10,
    imageId: '',
    conditions: [],
    createdAt: ts,
    updatedAt: ts,
  },
];

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
      filename: 'weekend.png',
      displayName: 'Weekend',
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

const defaultProps: RulesViewProps = {
  rules: [],
  images: [],
  loading: false,
  error: null,
  onAdd: noop,
  onToggleEnabled: noop,
  onReorder: noop,
  onDelete: noop,
};

const meta: Meta<typeof RulesView> = {
  title: 'Pages/Rules',
  component: RulesView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RulesView>;

export const Empty: Story = {
  args: { ...defaultProps },
};

export const Populated: Story = {
  args: { ...defaultProps, rules: sampleRules, images: sampleImages },
};

export const Loading: Story = {
  args: { ...defaultProps, loading: true },
};

export const Error: Story = {
  args: { ...defaultProps, error: 'Failed to load rules.' },
};
