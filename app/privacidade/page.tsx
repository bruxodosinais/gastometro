import Link from 'next/link';

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Voltar
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
            <p className="text-gray-500 text-sm mt-1">Tô Organizado — Vigência: maio de 2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Dados coletados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Coletamos os seguintes dados para a prestação do serviço:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Dados de cadastro:</strong> nome, endereço de e-mail e senha (armazenada com hash).</li>
              <li><strong>Dados financeiros:</strong> lançamentos de receitas e despesas, cartões de crédito, metas e orçamentos inseridos por você.</li>
              <li><strong>Dados de uso:</strong> data e hora de aceite dos termos, preferências de notificação e configurações de perfil.</li>
              <li><strong>Dados técnicos:</strong> logs de autenticação para segurança da conta.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Como usamos seus dados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Utilizamos seus dados exclusivamente para:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li>Fornecer, manter e melhorar as funcionalidades do aplicativo.</li>
              <li>Enviar notificações e resumos que você habilitou nas preferências.</li>
              <li>Garantir a segurança e integridade da sua conta.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Não utilizamos seus dados para publicidade direcionada nem para criação de perfis
              de comportamento fora do escopo do serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Compartilhamento</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Seus dados não são vendidos a terceiros. Compartilhamos apenas com prestadores de
              serviço essenciais ao funcionamento da plataforma:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Supabase:</strong> banco de dados e autenticação (infraestrutura AWS).</li>
              <li><strong>Resend:</strong> envio de e-mails transacionais (confirmação de conta, recuperação de senha, resumos).</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Esses parceiros processam seus dados apenas conforme necessário para a prestação do
              serviço e possuem suas próprias políticas de privacidade.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Segurança</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia em trânsito (TLS), senhas armazenadas com hash seguro (bcrypt),
              controle de acesso por políticas de segurança em nível de linha (RLS) no banco de
              dados, e acesso restrito às chaves de serviço. Em caso de incidente de segurança
              que afete seus dados, você será notificado conforme exigido pela LGPD.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Seus direitos (LGPD)</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Acesso:</strong> solicitar uma cópia dos seus dados pessoais.</li>
              <li><strong>Correção:</strong> atualizar dados incompletos ou incorretos.</li>
              <li><strong>Exclusão:</strong> solicitar a remoção dos seus dados (disponível diretamente nas configurações de Perfil).</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado.</li>
              <li><strong>Revogação do consentimento:</strong> retirar o consentimento a qualquer momento, sem prejuízo do tratamento realizado anteriormente.</li>
              <li><strong>Informação:</strong> ser informado sobre com quem seus dados são compartilhados.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Para exercer esses direitos, entre em contato pelo e-mail{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>
              . Responderemos no prazo de até 15 dias úteis.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Retenção de dados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Seus dados são mantidos enquanto sua conta estiver ativa. Ao excluir a conta,
              todos os dados pessoais são removidos permanentemente em até 30 dias, salvo
              obrigação legal de retenção por prazo superior (ex: dados fiscais exigidos
              por legislação tributária).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Cookies</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Utilizamos cookies estritamente necessários para manter a sessão autenticada.
              Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
              Os cookies de sessão são removidos ao encerrar a sessão ou ao expirar o prazo
              de validade definido pelo sistema de autenticação.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Contato</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Para exercer seus direitos, dúvidas ou reclamações sobre privacidade, entre em
              contato com nosso encarregado de dados (DPO) pelo e-mail:{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
