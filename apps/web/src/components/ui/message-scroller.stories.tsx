import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "./message-scroller";

const meta = {
  title: "UI/MessageScroller",
  component: MessageScroller,
  render: (args) => (
    <MessageScrollerProvider>
      <MessageScroller {...args} className="h-64 w-80 rounded-lg border">
        <MessageScrollerViewport aria-label="Messages">
          <MessageScrollerContent className="p-4">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <MessageScrollerItem key={n} messageId={`m${n}`}>
                Message {n}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  ),
} satisfies Meta<typeof MessageScroller>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
