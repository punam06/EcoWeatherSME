import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Groq does not yet support embeddings natively.
  // Use OpenAI embeddings client pointed at the configured OPENAI_API_KEY if present.
  // If no embedding API key is configured, throw a clear error — never silently fall back to random vectors.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for embedding generation. Set it in your .env file.');
  }
  const { OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}
