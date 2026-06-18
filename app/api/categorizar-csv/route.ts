import Anthropic from '@anthropic-ai/sdk';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

interface TransactionInput {
  id: number;
  description: string;
  nubank_category: string;
}

const MAX_TRANSACTIONS = 200;
const MAX_FIELD_LEN = 200;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(ip, 'categorizar-csv', 20, 60 * 1000)) {
      return Response.json({ error: 'Limite de requisições atingido.' }, { status: 429 });
    }

    const { user } = await getRequestUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { transactions?: unknown };
    const { transactions } = body;

    if (!Array.isArray(transactions)) {
      return Response.json({ error: 'transactions deve ser um array' }, { status: 400 });
    }
    if (transactions.length === 0) {
      return Response.json({ categories: [] });
    }
    if (transactions.length > MAX_TRANSACTIONS) {
      return Response.json(
        { error: `Limite de ${MAX_TRANSACTIONS} transações por requisição` },
        { status: 400 },
      );
    }

    // Sanitiza cada item: aceita SOMENTE os campos esperados (id, description,
    // nubank_category) e descarta qualquer outro, impedindo injeção de dados
    // arbitrários do cliente no prompt da IA. Campos de texto truncados.
    const sanitized: TransactionInput[] = [];
    for (const t of transactions) {
      if (typeof t !== 'object' || t === null) {
        return Response.json({ error: 'Transação inválida no payload' }, { status: 400 });
      }
      const { id, description, nubank_category } = t as Record<string, unknown>;
      if (typeof id !== 'number' || typeof description !== 'string') {
        return Response.json({ error: 'Transação inválida no payload' }, { status: 400 });
      }
      sanitized.push({
        id,
        description: description.slice(0, MAX_FIELD_LEN),
        nubank_category:
          typeof nubank_category === 'string' ? nubank_category.slice(0, MAX_FIELD_LEN) : '',
      });
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
          content: `Categorize estas transações: ${JSON.stringify(sanitized)}`,
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
