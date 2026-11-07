import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: { placeholder: "Type your message here", "aria-label": "Message" },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: { id: "message", "aria-label": undefined },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor={args.id}>Message</Label>
      <Textarea {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};
