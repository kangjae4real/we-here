import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Input",
  component: Input,
  args: { placeholder: "Type here", "aria-label": "Text input" },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "file"],
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: { id: "email", type: "email", "aria-label": undefined },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Email</Label>
      <Input {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "invalid value" },
};
