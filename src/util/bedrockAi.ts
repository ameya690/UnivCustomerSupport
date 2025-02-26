import {} from "openai";
import { BedrockRuntime } from "@aws-sdk/client-bedrock-runtime";

import { Chat } from "openai/resources/chat/chat";
export const bedrockRuntime = new BedrockRuntime({ region: "us-west-2" });
export enum BedrockModel {
  ClaudeV3Sonnet = "anthropic.claude-3-sonnet-20240229-v1:0",
  ClaudeV3Opus = "anthropic.claude-3-opus-20240229-v1:0",
  ClaudeV3Haiku = "anthropic.claude-3-haiku-20240307-v1:0",
}
export interface ChatOptions {
  prompt: string;
  max_tokens_to_sample?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
  stop_sequences?: string[];
}

export async function bedrockInference(
  modelId: BedrockModel,
  messages: Array<Chat.ChatCompletionMessageParam>,
  temperature: number = 0.9,
  stopTokens: string[] = []
) {
  let systemPrompt;
  if (messages.at(0)?.role == "system") {
    systemPrompt = messages.shift();
  }
  const data = await bedrockRuntime.invokeModel({
    body: Buffer.from(
      JSON.stringify({
        messages: messages,
        system: systemPrompt?.content,
        temperature: temperature,
        anthropic_version: "bedrock-2023-05-31",
        stop_sequences: stopTokens,
        max_tokens: 8000,
      })
    ),
    modelId: modelId,
    contentType: "application/json",
    accept: "*/*",
  });
  if (!data.body) {
    console.error("no stream for bedrock");
    return "";
  }
  const response = JSON.parse(new TextDecoder().decode(data.body));
  return response.content[0].text;
}
