import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

interface TransactionInput {
  id: number;
  description: string;
  nubank_category: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { transactions: TransactionInput[] };
    const { transactions } = body;

    if (!transactions?.length) {
      return Response.json({ categories: [] });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system:
        'Você é um categorizador de gastos pessoais. Receberá uma lista de transações financeiras e deve retornar SOMENTE um JSON array com a categoria sugerida para cada uma. Use apenas estas categorias: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Vestuário, Delivery, Internet, Assinaturas, Farmácia, Combustível, Telefone, Beleza, Pet, Viagem, Investimentos, Outros. Responda SOMENTE com o JSON array, sem explicações.',
      messages: [
        {
          role: 'user',
          content: `Categorize estas transações: ${JSON.stringify(transactions)}`,
        },
      ],
    });

    const raw =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';

    let categories: Array<{ id: number; category: string }> = [];
    try {
      const cleaned = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim();
      categories = JSON.parse(cleaned);
    } catch {
      // Caller will use nubank_category fallback
    }

    return Response.json({ categories });
  } catch (err) {
    console.error('[categorizar-csv]', err);
    return Response.json({ categories: [] }, { status: 500 });
  }
}
