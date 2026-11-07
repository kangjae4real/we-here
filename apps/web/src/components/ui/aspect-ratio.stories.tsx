import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AspectRatio } from "./aspect-ratio";

const meta = {
  title: "UI/AspectRatio",
  component: AspectRatio,
  args: {
    ratio: 16 / 9,
    className: "w-80 rounded-lg bg-muted",
    children: (
      <div className="absolute inset-0 flex items-center justify-center text-sm">
        16 / 9
      </div>
    ),
  },
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Square: Story = {
  args: { ratio: 1 },
};
