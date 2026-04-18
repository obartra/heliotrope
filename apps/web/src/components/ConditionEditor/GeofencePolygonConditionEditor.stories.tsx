import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { GeofencePolygonConditionEditor } from './GeofencePolygonConditionEditor';

const meta: Meta<typeof GeofencePolygonConditionEditor> = {
  title: 'ConditionEditor/GeofencePolygonConditionEditor',
  component: GeofencePolygonConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof GeofencePolygonConditionEditor>;

export const Populated: Story = {
  args: {
    value: {
      type: 'geofencePolygon',
      points: [
        [37.78, -122.42],
        [37.77, -122.42],
        [37.77, -122.41],
        [37.78, -122.41],
      ],
    },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'geofencePolygon', points: [] },
  },
};

export const Invalid: Story = {
  args: {
    value: {
      type: 'geofencePolygon',
      points: [
        [37.78, -122.42],
        [37.77, -122.42],
      ],
    },
  },
};
