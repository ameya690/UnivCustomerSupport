import { retry } from "@lifeomic/attempt";
import { firecrawl } from "./route";

export async function extractWebpageContent(url: string) {
  return retry(async () => {
    console.log("Scraping URL", url);

    const scrapeResult = await firecrawl.scrapeUrl(url, {
      pageOptions: {
        screenshot: true,
      },
    });

    return {
      pageContent: scrapeResult.data.content,
      screenshot: scrapeResult.data?.metadata?.screenshot,
    };
  });
}
