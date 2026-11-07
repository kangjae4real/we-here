import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Toaster, toast } from "./toast";

const meta = {
  title: "UI/Toast",
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Toaster {...args}>
      <Button
        variant="outline"
        onClick={() =>
          toast.add({
            title: "Event created",
            description: "Sunday, December 03 at 9:00 AM",
          })
        }
      >
        Show toast
      </Button>
    </Toaster>
  ),
};
