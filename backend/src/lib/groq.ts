import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  console.warn('[Groq] WARNING: GROQ_API_KEY is not set. AI features will be unavailable.');
}

export const groq = new Groq({
  apiKey: (process.env.GROQ_API_KEY || 'missing-key').trim(),
});

export const GROQ_MODEL = 'llama-3.3-70b-versatile';

export const isGroqConfigured = (): boolean =>
  Boolean(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes('missing'));
