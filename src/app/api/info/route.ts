import connectDB from "@/backend/connectDb";
import {
  CustomerAccount,
  FaqInstance,
  ICustomerAccount,
  IFaqInstance,
} from "@/backend/models";
import { cosineSimilarity } from "@/util/cosineSimiliarity";
import {
  FireworksModel,
  embeddingCreation,
  fireworksInference,
} from "@/util/fireworksAi";

export const dynamic = "force-dynamic"; // defaults to auto
export const maxDuration = 300; // This function can run for a maximum of 5 seconds

const fetchCall = async (id: string) => {
  const url = `https://api.vocode.dev/v1/calls?id=${id}`;
  const token = process.env.VOCODE_API_KEY; // replace with your actual token

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.agent_phone_number;
};

export async function POST(request: Request) {
  await connectDB();
  const body: {
    call_id: string;
    payload: {
      query: string;
    };
  } = await request.json();
  console.log("Call request ", body);
  const {
    payload: { query },
    call_id: callId,
  } = body;
  const phoneNumber = await fetchCall(callId);
  console.log("Found phone number as ", phoneNumber);
  const customer: ICustomerAccount | null = await CustomerAccount.findOne({
    phoneNumber,
  });
  console.log("Found customer as ", customer);
  if (!customer) {
    return Response.json({ success: false });
  }

  //   const faqs: IFaqInstance[] = await FaqInstance.find({
  //     customerAccount: customer.id,
  //   });
  const queryEmbedding = await embeddingCreation(query);
  const agg = [
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding, // Adjust the query vector as needed
        numCandidates: 10,
        limit: 5,
        filter: {
          customerAccountString: customer.id.toString(),
        },
      },
    },
  ];

  const faqs = await FaqInstance.aggregate(agg);
  const result = await fireworksInference(FireworksModel.Llama8B, [
    {
      role: "user",
      content: `
    You are a helpful assistant that wants to answer the following question:
    ${query}

    You have the following FAQs to work with:
    ${faqs
      .map((faq: IFaqInstance) => {
        return `Q: ${faq.question}, A:${
          faq.answer
        } Relevance Score: ${cosineSimilarity(
          queryEmbedding,
          faq.questionEmbedding
        )}`;
      })
      .join("\n")}

    If one of your FAQs matches the question, you should return the answer.
    If not, you should return that you don't know.

    Be willing to infer information, for example if a store is open 24/7, you should return that the store is open 24/7 even if the question is technically not in your FAQ.
    `,
    },
  ]);
  console.log(
    "FAQ",
    faqs.map((faq: IFaqInstance) => {
      return `Q: ${faq.question}, A:${
        faq.answer
      } Relevance Score: ${cosineSimilarity(
        queryEmbedding,
        faq.questionEmbedding
      )}`;
    })
  );
  console.log("Result", result);
  return Response.json({
    result: {
      success: true,
      information: result,
    },
  });
}
