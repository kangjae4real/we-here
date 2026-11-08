import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  args: {
    children: (
      <>
        <AvatarImage src="" alt="User" />
        <AvatarFallback>WH</AvatarFallback>
      </>
    ),
  },
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: { size: "lg" },
};
