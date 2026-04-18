import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DateRangeConditionEditor } from './DateRangeConditionEditor';

const meta: Meta<typeof DateRangeConditionEditor> = {
  title: 'ConditionEditor/DateRangeConditionEditor',
  component: DateRangeConditionEditor,
  args: { onChange: fn() },
};

export default meta;
type Story = StoryObj<typeof DateRangeConditionEditor>;

export const Populated: Story = {
  args: {
    value: { type: 'dateRange', fromISO: '2026-06-01', toISO: '2026-08-31' },
  },
};

export const Empty: Story = {
  args: {
    value: { type: 'dateRange', fromISO: '2026-01-01', toISO: '2026-12-31' },
  },
};

export const Invalid: Story = {
  args: {
    value: { type: 'dateRange', fromISO: '2026-09-15', toISO: '2026-03-01' },
  },
};
