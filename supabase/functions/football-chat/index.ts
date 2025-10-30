// supabase/functions/football-chat/index.ts
// Stateless football (soccer) knowledge chatbot via OpenAI

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-version, x-client-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Content-Type': 'application/json',
} as const;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `You are a football (soccer) expert assistant. Answer questions about:
- Football rules, tactics, positions
- Player statistics and history
- Team information and competitions
- Training tips and techniques
- Match analysis and strategies

Guidelines:
- Keep answers concise and helpful
- If asked about non-football topics, politely redirect to football
- If asked for live stats or current events you don't know, say you may be outdated`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Access-Control-Max-Age': '86400' 
      } 
    });
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Only allow POST for chat
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('⚽ football-chat invoked');

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Parse request body
    let userMessage = '';
    let history: ChatMessage[] = [];
    
    try {
      const raw = await req.text();
      if (!raw || raw.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Empty request body' }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }
      
      const parsed = JSON.parse(raw) as { message?: string; history?: ChatMessage[] };
      userMessage = String(parsed.message || '').trim();
      history = Array.isArray(parsed.history) ? parsed.history : [];
    } catch (err) {
      console.error('❌ JSON parse error:', err);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON', 
        details: String((err as Error).message || err) 
      }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Input validation and limits
    const trimmed = userMessage.slice(0, 2000);
    const safeHistory = history
      .slice(-8)
      .map((m) => ({ 
        role: m.role, 
        content: String(m.content).slice(0, 2000) 
      })) as ChatMessage[];

    // Prepare OpenAI request
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...safeHistory,
        { role: 'user', content: trimmed },
      ],
      max_tokens: 400,
      temperature: 0.7,
    };

    // Timeout guard (15s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log('✅ OpenAI response status:', resp.status);

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ 
        error: 'OpenAI API error', 
        details: txt 
      }), { 
        status: 502, 
        headers: corsHeaders 
      });
    }

    const data = await resp.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? "Désolé, je n'ai pas pu générer de réponse.";

    return new Response(JSON.stringify({ response: reply }), { 
      status: 200,
      headers: corsHeaders 
    });
    
  } catch (err) {
    console.error('❌ Unexpected error football-chat:', err);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: String((err as Error).message || err) 
    }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});