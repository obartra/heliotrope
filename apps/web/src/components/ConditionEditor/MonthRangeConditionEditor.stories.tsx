import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { MonthRangeConditionEditor } from './MonthRangeConditionEditor';

const meta: Meta<typeof MonthRangeConditionEditor> = {
  title: 'ConditionEditor/MonthRangeConditionEditor',
  component: MonthRangeConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof MonthRangeConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'monthRange', fromMonth: 11, toMonth: 2 },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'monthRange', fromMonth: 1, toMonth: 12 },
  },
};
