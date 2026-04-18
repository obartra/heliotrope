import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TimeRangeConditionEditor } from './TimeRangeConditionEditor';

const meta: Meta<typeof TimeRangeConditionEditor> = {
  title: 'ConditionEditor/TimeRangeConditionEditor',
  component: TimeRangeConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof TimeRangeConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'timeRange', fromLocal: '22:00', toLocal: '06:00' },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'timeRange', fromLocal: '09:00', toLocal: '17:00' },
  },
};
