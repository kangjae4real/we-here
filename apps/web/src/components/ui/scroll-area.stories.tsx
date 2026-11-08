import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScrollArea } from "./scroll-area";

const meta = {
  title: "UI/ScrollArea",
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);

export const Default: Story = {
  render: (args) => (
    <ScrollArea {...args} className="h-64 w-48 rounded-md border">
      <div className="p-4 text-sm">
        {items.map((item) => (
          <div key={item} className="py-1">
            {item}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
