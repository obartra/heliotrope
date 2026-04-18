import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DateConditionEditor } from './DateConditionEditor';

const meta: Meta<typeof DateConditionEditor> = {
  title: 'ConditionEditor/DateConditionEditor',
  component: DateConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof DateConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'date', monthDay: '12-25', windowDaysBefore: 3, windowDaysAfter: 1 },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'date', monthDay: '01-01' },
  },
};
