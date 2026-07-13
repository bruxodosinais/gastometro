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
            <p className="text-gray-500 text-sm mt-1">Tô Organizado — Última atualização: 30 de junho de 2026</p>
          </div>

          <section className="space-y-2">
            <p className="text-gray-600 text-sm leading-relaxed">
              Esta Política de Privacidade explica como o Tô Organizado coleta, usa, compartilha e
              protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
              (Lei nº 13.709/2018 — LGPD). Ao utilizar o aplicativo, você concorda com as práticas
              aqui descritas.
            </p>
          </section>

          {/* 1. Controlador */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Quem é o controlador dos dados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O controlador responsável pelo tratamento dos seus dados pessoais é:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>AIWA MARKETING DIGITAL LTDA</strong></li>
              <li>CNPJ 67.507.924/0001-50</li>
              <li>Av. Ayrton Senna da Silva, 575, Sala 5 — Londrina/PR, CEP 86.050-460</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Encarregado pelo tratamento de dados (DPO) e canal de contato:{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>
              . Responderemos às solicitações no prazo de até 15 dias úteis.
            </p>
          </section>

          {/* 2. Dados coletados */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Quais dados coletamos e como</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Coletamos apenas os dados necessários para a prestação do serviço:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Cadastro e autenticação:</strong> nome, e-mail e senha. A senha é armazenada com hash — nem o app nem nossa equipe têm acesso a ela em texto.</li>
              <li><strong>Dados financeiros que você insere:</strong> receitas e despesas, categorias, saldos, cartões de crédito (apelido, limite e datas — <strong>nunca o número do cartão</strong>), metas, orçamentos, planos mensais, obrigações, patrimônio (ativos e passivos) e a Missão de Poupança (aportes e desafios).</li>
              <li><strong>Uso e gamificação:</strong> streaks, níveis, badges, registro de atividade no app, data e hora de aceite dos termos e preferências de notificação.</li>
              <li><strong>Suporte:</strong> mensagens enviadas pelo formulário de suporte (nome, e-mail, assunto e conteúdo).</li>
              <li><strong>Notificações push:</strong> a inscrição de push do seu navegador ou dispositivo, apenas se você ativar esse recurso.</li>
              <li><strong>Dados técnicos:</strong> logs de autenticação, usados para a segurança da sua conta.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              <strong>Não coletamos</strong> número de cartão, dados bancários ou de Open Finance,
              localização, contatos, biometria, nem realizamos rastreamento para publicidade.
            </p>
          </section>

          {/* 3. Finalidades e bases legais */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Finalidades e bases legais (LGPD)</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Cada tratamento de dados tem uma finalidade e uma base legal correspondente:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Execução do contrato (Art. 7º, V):</strong> criar e manter sua conta, armazenar seus lançamentos e fornecer as funcionalidades do app.</li>
              <li><strong>Consentimento (Art. 7º, I):</strong> envio de notificações push, e-mails de relatório e lembretes, e eventuais cookies analíticos — ativados apenas mediante sua autorização.</li>
              <li><strong>Legítimo interesse (Art. 7º, IX):</strong> segurança da conta, prevenção a fraude e melhoria do produto.</li>
              <li><strong>Cumprimento de obrigação legal (Art. 7º, II):</strong> quando exigido por lei ou autoridade competente.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Não utilizamos seus dados para publicidade direcionada nem para criação de perfis de
              comportamento fora do escopo do serviço.
            </p>
          </section>

          {/* 4. Compartilhamento e transferência internacional */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Compartilhamento com terceiros</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Seus dados <strong>não são vendidos</strong>. Compartilhamos apenas com prestadores de
              serviço (operadores) essenciais ao funcionamento da plataforma, cada um tratando os
              dados estritamente conforme necessário:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Supabase:</strong> autenticação e banco de dados.</li>
              <li><strong>Vercel:</strong> hospedagem e execução do aplicativo.</li>
              <li><strong>Resend:</strong> envio de e-mails transacionais (confirmação de conta, código de verificação, suporte) e de relatórios e lembretes (resumo semanal, relatório mensal, lembrete da Missão e mensagens de onboarding).</li>
              <li><strong>Anthropic (API Claude):</strong> processamento do recurso de Assistente financeiro com IA (ver seção 5).</li>
              <li><strong>RevenueCat:</strong> gerencia as assinaturas do aplicativo (validação da compra e status da assinatura Pro). Recebemos apenas o identificador da conta e o status da assinatura.</li>
              <li><strong>Apple (App Store):</strong> processa os pagamentos das assinaturas feitas dentro do aplicativo. Os dados de pagamento são tratados pela Apple; recebemos apenas a confirmação e o status da compra.</li>
              <li><strong>Apple e Google:</strong> distribuição dos aplicativos pelas respectivas lojas.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              <strong>Não exibimos anúncios</strong> e <strong>não utilizamos ferramentas de
              analytics ou telemetria de terceiros</strong> (como Google Analytics, Sentry ou pixels
              de rastreamento).
            </p>
            <p className="text-gray-600 text-sm leading-relaxed">
              <strong>Transferência internacional:</strong> os prestadores acima operam servidores
              fora do Brasil. Essa transferência é necessária para a execução do contrato e está
              amparada nas garantias contratuais e cláusulas-padrão oferecidas por esses
              fornecedores, nos termos do Art. 33 da LGPD.
            </p>
          </section>

          {/* 5. Assistente de IA */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Assistente financeiro com IA</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O app oferece um assistente financeiro com inteligência artificial (o "GastoBot"),
              além de geração de desafios da Missão, categorização de extratos importados (CSV) e do
              texto do resumo semanal. Esses recursos são processados pela{' '}
              <strong>Anthropic</strong>, por meio da API Claude (modelos claude-sonnet-4-6 e
              claude-haiku-4-5).
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>O que é enviado:</strong> os dados financeiros necessários para gerar a resposta — histórico de lançamentos (data, valor, categoria e descrição, geralmente dos últimos meses), orçamentos por categoria, metas, patrimônio, despesas recorrentes, resumos de receita/gasto/saldo e progresso da Missão. Na importação de CSV, as descrições e categorias das transações.</li>
              <li><strong>O que <u>não</u> é enviado:</strong> seu e-mail, sua senha e o número do seu cartão.</li>
              <li><strong>Quando:</strong> apenas quando você usa esses recursos.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Esse processamento ocorre fora do Brasil (transferência internacional, conforme a
              seção 4). A Anthropic atua como operadora e, em sua API comercial, não utiliza esses
              dados para treinar seus modelos por padrão.
            </p>
          </section>

          {/* 6. Retenção */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Retenção dos dados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Seus dados são mantidos enquanto sua conta estiver ativa. Ao excluir a conta, todos os
              dados pessoais são removidos permanentemente em até 30 dias, salvo obrigação legal de
              retenção por prazo superior.
            </p>
          </section>

          {/* 7. Direitos do titular */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Seus direitos e como exercê-los</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Nos termos da LGPD, você tem direito a acesso, correção, exclusão, portabilidade,
              informação sobre compartilhamento e revogação do consentimento. Você pode exercê-los
              diretamente no app:
            </p>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Acesso e portabilidade:</strong> em <strong>Perfil → "Exportar meus dados"</strong>, você baixa um arquivo com todos os seus dados em formato estruturado (JSON).</li>
              <li><strong>Exclusão:</strong> em <strong>Perfil → "Excluir minha conta"</strong>, sua conta e todos os dados associados são apagados definitivamente.</li>
              <li><strong>Correção:</strong> edite seus registros e dados de perfil a qualquer momento dentro do app.</li>
              <li><strong>Revogação de consentimento:</strong> desative notificações push e e-mails nas preferências, sem prejuízo do tratamento já realizado.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Você também pode exercer esses direitos ou tirar dúvidas pelo e-mail{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>
              .
            </p>
          </section>

          {/* 8. Segurança */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Segurança das informações</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia em trânsito (TLS), senhas armazenadas com hash seguro, controle de acesso
              por políticas de segurança em nível de linha (RLS) no banco de dados e acesso restrito
              às chaves de serviço. Em caso de incidente de segurança que possa acarretar risco ou
              dano relevante, você será notificado conforme exigido pela LGPD.
            </p>
          </section>

          {/* 9. Cookies e armazenamento local */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">9. Cookies e armazenamento local</h2>
            <ul className="list-disc list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li><strong>Na web:</strong> utilizamos um cookie estritamente necessário para manter a sessão autenticada.</li>
              <li><strong>No aplicativo nativo (iOS/Android):</strong> a sessão é guardada no armazenamento local (localStorage) do app, e não em cookies.</li>
              <li><strong>Consentimento de cookies:</strong> sua escolha no banner ("Só essenciais" ou "Aceitar todos") fica salva localmente. Cookies analíticos só seriam ativados com o seu consentimento — e, atualmente, o app não possui nenhuma ferramenta de analytics ativa.</li>
            </ul>
            <p className="text-gray-600 text-sm leading-relaxed">
              Não utilizamos cookies de rastreamento ou de publicidade.
            </p>
          </section>

          {/* 10. Público / menores */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">10. Público e menores de idade</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O Tô Organizado não é destinado a menores de 18 anos. Menores de 18 anos só devem
              utilizar o serviço com autorização e supervisão dos responsáveis legais. Não coletamos
              intencionalmente dados de menores sem essa autorização; caso identifiquemos esse tipo
              de coleta indevida, os dados serão removidos.
            </p>
          </section>

          {/* 11. Alterações */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">11. Alterações nesta política</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Mudanças relevantes
              serão comunicadas pelos canais do app. A data da última revisão está indicada no topo
              desta página.
            </p>
          </section>

          {/* Contato */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">12. Contato</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Para dúvidas, solicitações ou reclamações sobre privacidade, fale com nosso encarregado
              de dados (DPO):{' '}
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
