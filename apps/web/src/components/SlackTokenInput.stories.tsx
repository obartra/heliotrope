import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import type { SlackTokenInputProps } from './SlackTokenInput';
import { SlackTokenInput } from './SlackTokenInput';

const noop = fn();

const defaultProps: SlackTokenInputProps = {
  connected: false,
  teamName: null,
  userId: null,
  lastValidatedAt: null,
  submitting: false,
  error: null,
  onSubmit: noop,
};

const meta: Meta<typeof SlackTokenInput> = {
  title: 'Components/SlackTokenInput',
  component: SlackTokenInput,
};

export default meta;
type Story = StoryObj<typeof SlackTokenInput>;

export const Disconnected: Story = {
  args: { ...defaultProps },
};

export const Connected: Story = {
  args: {
    ...defaultProps,
    connected: true,
    teamName: 'Acme Corp',
    userId: 'U0123456789',
    lastValidatedAt: '1/15/2026, 10:30:00 AM',
  },
};

export const Submitting: Story = {
  args: {
    ...defaultProps,
    submitting: true,
  },
};

export const Error: Story = {
  args: {
    ...defaultProps,
    error: 'Could not verify this token. Please check that it is correct and try again.',
  },
};
