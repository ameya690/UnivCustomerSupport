import { makeStream } from "@/util/makeStream";
import { BotCreationEvent } from "./botCreationEvent";
import { NextRequest } from "next/server";
import FireCrawlApp from "@mendable/firecrawl-js";
import { StreamingResponse } from "@/util/streamingResponse";
import { extractWebpageFaq } from "./extractFaq";
import { extractWebpageContent } from "./extractWebpageContent";
import connectDB from "@/backend/connectDb";
export const maxDuration = 300; // This function can run for a maximum of 5 seconds

import {
  CustomerAccount,
  FaqInstance,
  ICustomerAccount,
} from "@/backend/models";
import normalizeUrl from "normalize-url";
import mongoose from "mongoose";
import { embeddingCreation } from "@/util/fireworksAi";
import { v4 as uuidv4 } from "uuid";
type Item = {
  key: string;
  value: string;
};
export const firecrawl = new FireCrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export const extractOutermostJSON = (input: string): string | null => {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}") + 1;

  // Check if both start and end are valid indices
  if (start === -1 || end === 0) {
    return null;
  }

  return input.substring(start, end);
};

async function getFaqInstancesForCompany(companyId: mongoose.Types.ObjectId) {
  try {
    // Populate the customer account information in the FAQ instances
    const faqInstances = await FaqInstance.find({
      customerAccount: companyId,
    }).exec();

    return faqInstances;
  } catch (error) {
    console.error("Error getting FAQ instances for company:", error);
    throw error;
  }
}
async function* createBot(
  url: string,
  name: string
): AsyncGenerator<BotCreationEvent, void, unknown> {
  url = normalizeUrl(url);
  await connectDB();

  const existingCustomer = await CustomerAccount.findOne({ website: url });
  if (existingCustomer) {
    yield {
      type: "phoneNumberAssigned",
      phoneNumber: existingCustomer.phoneNumber,
    };
    return
  }

  const { pageContent, screenshot } = await extractWebpageContent(url);
  yield {
    type: "webpageScraped",
    content: pageContent,
    screenshot: screenshot,
    url: url,
  };

  console.log("scraping complete, extracting webpage FAQ", url);
  const faq = await extractWebpageFaq(pageContent);
  yield {
    type: "qaGenerated",
    siteSummary: faq.pageSummary,
    qaPairs: faq.qaPairs,
  };
  const { customer } = await createOrFindCustomerAccount(url);
  await Promise.all(
    faq.qaPairs.map(async (pair) => {
      const faqInstance = new FaqInstance({
        question: pair.question,
        answer: pair.answer,
        customerAccount: customer.id,
        questionEmbedding: await embeddingCreation(pair.question),
        answerEmbedding: await embeddingCreation(pair.answer),
        embedding: await embeddingCreation(pair.question + pair.answer),
      });
      await faqInstance.save();
    })
  );
  if (!customer.phoneNumber) {
    const number = await buyNumber();
    console.log("number", number);
    customer.phoneNumber = number.number;
    await customer.save();
  }
  const result = await setAgent(customer.phoneNumber, name);
  console.log("result", JSON.stringify(result, null, 2));
  yield {
    type: "phoneNumberAssigned",
    phoneNumber: customer.phoneNumber,
  };
}
async function buyNumber() {
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOCODE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: '{"area_code":"415","telephony_provider":"vonage"}',
  };

  return (await fetch("https://api.vocode.dev/v1/numbers/buy", options).then(
    (response) => response.json()
  )) as {
    number: string;
  };
}
async function setAgent(number: string, name: string) {
  const agentId = uuidv4();
  const promptId = uuidv4();
  const actionId = uuidv4();
  const voiceId = uuidv4();
  const prompt = `
        OBJECTIVES
1. You are an AI employed by ${name} to answer questions
2. This conversation is being had over the phone via Twilio/Speech Synthesis, so remember that the transcriptions may not be perfect and that there may be interruptions


Remember that the conversation is on the phone, so the transcriptions won't be perfect.

Always make sure to confirm what they've told you before moving on to the next thing.


Sample conversation that you can reference:

"Hi this is ${name} how are you doing today?"

...

END SAMPLE /

Remember that this isn't perfect and that certain situations or objections may come up. Handle them with grace and bring the conversation back to finishing the [TASK]

NEVER type out a number or symbol, instead ALWAYS type it in word form. And always split up abbreviations.
Here are some examples:
- $130,000 should be "one hundred and thirty thousand dollars"
– 50% should be "fifty percent"
– "API" should be "A P I"


Remember that this conversation is being had on the phone. So the messages you receive will include transcription errors, your responses should be short and friendly since it is being synthesized into audio, and there may be some interruptions.

# Linguistic Register
Keep you language short and concise, and throw in some disfluencies and lexical fillers like "um", "so like", "uh"

Any time you answer a question about the website, use the information lookup tool!
...
`;
  const url = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` 
    : "https://quick-treefrog-modest.ngrok-free.app";
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOCODE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inbound_agent: {
        id: agentId,
        user_id: agentId,
        name: "hoyo-bot-" + name.toLocaleLowerCase().replaceAll(" ", "-"),
        voice: {
          id: voiceId,
          user_id: voiceId,
          type: "voice_azure",
          voice_name: "en-US-SteffanNeural",
        },
        initial_message: `Hello, this is ${name}, how can I help you today?`,
        actions: [
          {
            id: actionId,
            user_id: actionId,
            type: "action_external",
            config: {
              name: "information_fetch",
              description:
                "You must always call this before answering a question. Use it to fetch factual and accurate information about the business. When calling this, just say you'll need a moment to check, then return with the answer that you're given",
              url: `${url}/api/info`,
              input_schema: {
                type: "object",
                properties: { query: { type: "string" } },
              },
              speak_on_receive: true,
              speak_on_send: false,
            },
          },
        ],

        prompt: {
          id: promptId,
          user_id: promptId,
          content: prompt,
        },
      },
    }),
  };

  return (await fetch(
    `https://api.vocode.dev/v1/numbers/update?phone_number=${number}`,
    options
  ).then((response) => response.json())) as {
    number: string;
  };
}
async function createOrFindCustomerAccount(
  url: string
): Promise<{ customer: ICustomerAccount; created: boolean }> {
  try {
    // First, try to find the document
    let customer = await CustomerAccount.findOne({ website: url });

    if (customer) {
      // If found, it means the customer was not newly created
      return { customer, created: false };
    } else {
      // If not found, create a new customer account
      customer = new CustomerAccount({ website: url });
      await customer.save();
      customer.customerAccountString = customer.id.toString();
      await customer.save();
      // Return the new customer account and indicate it was created
      return { customer, created: true };
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("Error creating or finding customer account:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const bodyData = await req.json();

  const stream = makeStream(createBot(bodyData.url, bodyData.name));
  const response = new StreamingResponse(stream);
  return response;
}
