import Link from 'next/link';

export default function TermosPage() {
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
            <h1 className="text-2xl font-bold text-gray-900">Termos de Uso</h1>
            <p className="text-gray-500 text-sm mt-1">Tô Organizado — Vigência: maio de 2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Aceitação</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Ao criar uma conta no Tô Organizado, você declara que leu, compreendeu e concordou
              integralmente com estes Termos de Uso. Caso não concorde com alguma disposição,
              não utilize o serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Descrição do serviço</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O Tô Organizado é um aplicativo de controle financeiro pessoal que permite registrar
              receitas e despesas, gerenciar cartões de crédito, acompanhar metas financeiras e
              visualizar relatórios de gastos. O serviço é fornecido "como está" e pode ser
              atualizado, modificado ou encerrado a qualquer momento mediante aviso prévio razoável.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Cadastro e conta</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Você deve fornecer informações verdadeiras e manter os dados da sua conta atualizados.
              É responsável por manter a confidencialidade da sua senha e por todas as atividades
              realizadas em sua conta. Menores de 18 anos devem ter autorização dos responsáveis
              para utilizar o serviço.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Uso aceitável</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Você concorda em utilizar o serviço apenas para fins lícitos e pessoais. É proibido:
              compartilhar credenciais de acesso, tentar acessar dados de outros usuários, realizar
              engenharia reversa, usar o serviço para fins comerciais sem autorização expressa, ou
              inserir conteúdo ilegal, ofensivo ou que viole direitos de terceiros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Privacidade</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O tratamento dos seus dados pessoais é regido pela nossa{' '}
              <Link href="/privacidade" className="text-blue-600 hover:underline">
                Política de Privacidade
              </Link>
              , que é parte integrante destes Termos de Uso. Ao aceitar estes termos, você também
              consente com o tratamento de dados conforme descrito na política.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Cancelamento</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Você pode excluir sua conta a qualquer momento nas configurações de Perfil. Após a
              exclusão, todos os seus dados serão removidos permanentemente de nossos sistemas no
              prazo de 30 dias, salvo obrigação legal de retenção. Podemos suspender ou encerrar
              contas que violem estes termos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Limitação de responsabilidade</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O Tô Organizado não se responsabiliza por decisões financeiras tomadas com base nas
              informações exibidas no aplicativo. Os dados exibidos dependem exclusivamente das
              informações inseridas pelo usuário. O serviço não presta consultoria financeira.
              Em nenhum caso nossa responsabilidade excederá os valores pagos pelo usuário nos
              últimos 12 meses.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Contato</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Para dúvidas, solicitações ou reclamações relacionadas a estes Termos de Uso,
              entre em contato pelo e-mail:{' '}
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
