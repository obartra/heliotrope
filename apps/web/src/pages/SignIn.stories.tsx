import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { SignIn } from './SignIn';

const meta: Meta<typeof SignIn> = {
  title: 'Pages/SignIn',
  component: SignIn,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SignIn>;

export const Default: Story = {};

export const SignUpMode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Sign up' }));
    await expect(canvas.getByRole('heading')).toHaveTextContent('Sign up');
  },
};

export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'password123');
  },
};
