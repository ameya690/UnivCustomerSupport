import { BotCreationEvent } from "@/app/api/bot/botCreationEvent";
import { useEffect, useState } from "react";
import { useAsyncEffect } from "use-async-effect";
import { Button, Flex, TextField, Card, Heading, Text } from "@radix-ui/themes";
import parsePhoneNumber from "libphonenumber-js";

export async function* streamingFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): AsyncGenerator<T, void, unknown> {
  const response = await fetch(input, init);
  const reader = response.body?.getReader();
  const decoder = new TextDecoder("utf-8");

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    try {
      yield JSON.parse(decoder.decode(value)) as T;
    } catch (e: any) {
      console.warn(e.message);
    }
  }
}

export default function RenderStreamData() {
  const [faq, setFaq] = useState<
    {
      question: string;
      answer: string;
    }[]
  >([]);
  const [url, setUrl] = useState<any[]>([]);
  const [name, setName] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string>("");

  const handleSubmit = async () => {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const events = streamingFetch<BotCreationEvent>("/api/bot", {
      headers,
      method: "POST",
      body: JSON.stringify({
        url,
        name,
      }),
    });
    setLoading(true);
    for await (const event of events) {
      console.log("New Bot Creation Event", event);
      if (event.type === "webpageScraped") {
        setScreenshot(event.screenshot);
      }
      if (event.type === "qaGenerated") {
        setFaq(event.qaPairs);
      }
      if (event.type === "phoneNumberAssigned") {
        setPhoneNumber(formatPhoneNumber(event.phoneNumber));
      }
    }
    setLoading(false);
  };

  return (
    <Card m={"9"}>
      <Flex direction={"column"} gap="2">
        <Heading>
          hoyo: Create an AI customer support number for your website!
        </Heading>
        <Heading size={"2"}>Enter your URL</Heading>
        <TextField.Root
          placeholder="Where can we find your information…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Heading size={"2"}>Enter your Business Name</Heading>
        <TextField.Root
          placeholder="Search the docs…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          onClick={handleSubmit}
          disabled={!url || !name}
          loading={loading}
        >
          Submit
        </Button>
        <img src={screenshot} />
        <Flex gap="2" direction={"column"}>
          {faq.map((pair) => (
            <Card key={pair.question} variant="surface">
              <Heading>{pair.question}</Heading>
              <Text>{pair.answer}</Text>
            </Card>
          ))}
        </Flex>
        {phoneNumber && (
          <Flex direction={"column"}>
            <Heading size={"6"}>Your Phone Number</Heading>
            <Heading size={"8"}>{phoneNumber}</Heading>
          </Flex>
        )}
      </Flex>
    </Card>
  );
}

function formatPhoneNumber(phoneNumberString : string) {
  var cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  var match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phoneNumberString;
}