import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Label",
  component: Label,
  args: { children: "Your name", htmlFor: "name" },
  render: (args) => (
    <div className="grid max-w-sm gap-2">
      <Label {...args} />
      <Input id="name" placeholder="Jane Doe" />
    </div>
  ),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
