import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HomeIcon, InboxIcon, SettingsIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const items = [
  { title: "Home", icon: HomeIcon },
  { title: "Inbox", icon: InboxIcon },
  { title: "Settings", icon: SettingsIcon },
];

const meta = {
  title: "UI/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen" },
  argTypes: {
    side: { control: "inline-radio", options: ["left", "right"] },
    variant: { control: "select", options: ["sidebar", "floating", "inset"] },
    collapsible: { control: "select", options: ["offcanvas", "icon", "none"] },
  },
  render: (args, { parameters }) => (
    <SidebarProvider
      className="min-h-96"
      defaultOpen={parameters.sidebarOpen ?? true}
    >
      <Sidebar {...args} className="absolute">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map(({ title, icon: Icon }, i) => (
                  <SidebarMenuItem key={title}>
                    <SidebarMenuButton isActive={i === 0}>
                      <Icon />
                      <span>{title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="p-2">
          <SidebarTrigger />
        </header>
      </SidebarInset>
    </SidebarProvider>
  ),
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Starts collapsed so the icon rail is what the story shows
export const IconCollapsible: Story = {
  args: { collapsible: "icon" },
  parameters: { sidebarOpen: false },
};
