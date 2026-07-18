const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // this is actually your OpenRouter key
const MODEL = process.env.ANTHROPIC_MODEL || 'anthropic/claude-sonnet-4.5';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gpt-image-1';

if (!ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable.');
}

async function callClaude(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANTHROPIC_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('OpenRouter error:', res.status, data);
    throw new Error(data.error?.message || `OpenRouter request failed with status ${res.status}`);
  }

  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content.trim();
  }

  throw new Error('OpenRouter returned no content: ' + JSON.stringify(data));
}

async function generateImage(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&nologo=true`;

  
  try {
    const res = await fetch(imageUrl, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Pollinations request failed with status ${res.status}`);
    }
  } catch (err) {
    console.error('Pollinations image generation failed:', err.message);
    throw new Error('Failed to generate image');
  }

  return imageUrl; // just the URL — frontend can use it directly as <img src="">
}

module.exports = { callClaude, generateImage };

module.exports = { callClaude, generateImage };