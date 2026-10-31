import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview, ReactRenderer } from "@storybook/nextjs-vite";
import { geistMono, geistSans } from "../src/app/fonts";
import "../src/app/globals.css";

// Mirror the <html> classes from app/layout.tsx
document.documentElement.classList.add(
  geistSans.variable,
  geistMono.variable,
  "antialiased",
);

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    // Toggles `.dark` on <html>, matching `@custom-variant dark` in globals.css
    withThemeByClassName<ReactRenderer>({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
    }),
  ],
};

export default preview;
