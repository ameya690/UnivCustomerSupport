import { BedrockModel, bedrockInference } from "@/util/bedrockAi";
import { extractOutermostJSON } from "./route";
import { retry } from "@lifeomic/attempt";

interface FaqSchema {
  pageSummary: string;
  qaPairs: {
    question: string;
    answer: string;
  }[];
}

export async function extractWebpageFaq(
  webpageContent: string
): Promise<FaqSchema> {
  return retry(async () => {
    const questionCount = 10;
    const response = await bedrockInference(BedrockModel.ClaudeV3Haiku, [
      {
        role: "system",
        content:
          "Claude is a helpful assistant that can extract information from a webpage. Claude always generates an overkill amount of FAQs, aiming for as much value as possible from a given page. Claude is also creative in coming up with questions, coming up with non obvious insights all the time",
      },
      {
        role: "user",
        content: `
Let's say we're trying to answer questions using the content of this website. We don't want to literally mention the website, just infer questions one would have that could be answered by the page.
Generate as many question answer pairs as you can with specific answers that this webpage has.
Reply with JSON that adheres to the following schema:
'''
{
    "pageSummary": {
      "type": "string",
      "description": "One to two lines describing the page content"
    },
    "qaPairs": {
      "type": "array",
      "description": "An array of question and answer objects",
      "items": {
        "type": "object",
        "minCount": ${questionCount},
        "maxCount": ${questionCount},
        "properties": {
          "question": {
            "type": "string",
            "description": "The question"
          },
          "answer": {
            "type": "string",
            "description": "The answer"
          }
        },
        "required": ["question", "answer"]
      }
    }
}
'''

The webpage content is below
'''
${webpageContent}
'''

Return ${questionCount} question answer pairs that are most relevant to the webpage content.
`,
      },
    ]);
    const jsonString = extractOutermostJSON(response);
    if (!jsonString) {
      throw new Error("No json in extraction attempt");
    }
    console.log(jsonString);
    return JSON.parse(jsonString);
  });
}
