import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DayOfWeekConditionEditor } from './DayOfWeekConditionEditor';

const meta: Meta<typeof DayOfWeekConditionEditor> = {
  title: 'ConditionEditor/DayOfWeekConditionEditor',
  component: DayOfWeekConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof DayOfWeekConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'dayOfWeek', days: [1, 2, 3, 4, 5] },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'dayOfWeek', days: [1] },
  },
};

export const Invalid: Story = {
  args: {
    // @ts-expect-error empty days array for invalid state demo
    value: { type: 'dayOfWeek', days: [] },
  },
};
