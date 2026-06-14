export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'API key not configured on server' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid JSON' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Конвертируем Anthropic-формат в OpenAI-формат для Polza.ai
  const messages = [];
  if (body.system) {
    messages.push({ role: 'system', content: body.system });
  }
  for (const msg of body.messages || []) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const openaiBody = {
    model: 'anthropic/claude-3-5-sonnet',
    max_tokens: body.max_tokens || 512,
    messages,
  };

  const upstream = await fetch('https://api.polza.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openaiBody),
  });

  const data = await upstream.json();

  // Конвертируем ответ обратно в Anthropic-формат для tutor.html
  let converted;
  if (data.choices && data.choices[0]) {
    converted = {
      content: [{ text: data.choices[0].message.content }],
    };
  } else {
    converted = { error: data.error || { message: 'Unknown error' } };
  }

  return new Response(JSON.stringify(converted), {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
