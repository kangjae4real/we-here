import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Checkbox } from "./checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "./field";
import { Input } from "./input";

const meta = {
  title: "UI/Field",
  component: Field,
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal", "responsive"],
    },
  },
  render: (args) => (
    <Field {...args} className="max-w-sm">
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" placeholder="you@example.com" />
      <FieldDescription>We will never share your email.</FieldDescription>
    </Field>
  ),
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Invalid: Story = {
  render: (args) => (
    <Field {...args} data-invalid className="max-w-sm">
      <FieldLabel htmlFor="email-invalid">Email</FieldLabel>
      <Input id="email-invalid" type="email" defaultValue="nope" aria-invalid />
      <FieldError>Enter a valid email address.</FieldError>
    </Field>
  ),
};

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <FieldGroup className="max-w-sm">
      <Field {...args}>
        <Checkbox id="newsletter" />
        <FieldLabel htmlFor="newsletter">Subscribe to newsletter</FieldLabel>
      </Field>
    </FieldGroup>
  ),
};
