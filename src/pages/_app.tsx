import "@/styles/globals.css";
import { Theme } from "@radix-ui/themes";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Theme scaling="110%" appearance="dark">
      <Component {...pageProps} />
    </Theme>
  );
}
