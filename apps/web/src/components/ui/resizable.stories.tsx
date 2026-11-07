import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";

const meta = {
  title: "UI/Resizable",
  component: ResizablePanelGroup,
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
} satisfies Meta<typeof ResizablePanelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <ResizablePanelGroup
      {...args}
      className="min-h-48 max-w-md rounded-lg border"
    >
      <ResizablePanel defaultSize="50%">
        <div className="flex h-full items-center justify-center p-4">One</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="50%">
        <div className="flex h-full items-center justify-center p-4">Two</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <ResizablePanelGroup
      {...args}
      className="min-h-64 max-w-md rounded-lg border"
    >
      <ResizablePanel defaultSize="30%">
        <div className="flex h-full items-center justify-center p-4">Top</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="70%">
        <div className="flex h-full items-center justify-center p-4">
          Bottom
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ),
};
