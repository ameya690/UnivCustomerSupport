export const dynamic = "force-dynamic"; // defaults to auto
const { MongoClient } = require("mongodb");

// connect to your Atlas deployment
const uri = "<connectionString>";

const client = new MongoClient(process.env.MONGODB_URI);

async function run() {
  try {
    const database = client.db("test");
    const collection = database.collection("faqinstances");

    // define your Atlas Vector Search index
    const index = {
      name: "vector_index",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            numDimensions: 768,
            path: "embedding",
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "customerAccountString",
          },
          {
            type: "filter",
            path: "customerAccount",
          },
        ],
      },
    };

    // run the helper method
    const result = await collection.createSearchIndex(index);
    console.log(result);
  } finally {
    await client.close();
  }
}

export async function GET(request: Request) {
  run().catch(console.dir);
  return Response.json({ success: true });
}
