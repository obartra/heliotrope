import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { GeofenceCircleConditionEditor } from './GeofenceCircleConditionEditor';

const meta: Meta<typeof GeofenceCircleConditionEditor> = {
  title: 'ConditionEditor/GeofenceCircleConditionEditor',
  component: GeofenceCircleConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof GeofenceCircleConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'geofenceCircle', center: [37.7749, -122.4194], radiusMeters: 500 },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'geofenceCircle', center: [0, 0], radiusMeters: 500 },
  },
};
