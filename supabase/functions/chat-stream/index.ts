import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts";

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const openai = new OpenAI({
            apiKey: Deno.env.get('OPENAI_KEY'),
        });

        const { messages } = await req.json()

        // Create stream
        const stream = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages,
            stream: true,
        });
        /*const readableStream = new ReadableStream({
            async start(controller) {
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                for await (const chunk of stream.toReadableStream()) {
                    const text = decoder.decode(chunk);
                    controller.enqueue(encoder.encode(`data: ${text}\n\n`));
                }
                controller.close();
            },
        });

        return new Response(readableStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });*/

        // Create and return the streaming response
        const readableStream = new ReadableStream({
          async start(controller) {
            for await (const part of stream) {
              const content = part.choices[0]?.delta?.content
              if (content) {
                // Format as SSE event
                const data = JSON.stringify({ choices: [{ delta: { content } }] });
                controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
              }
            }
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
    
        return new Response(readableStream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
}) 