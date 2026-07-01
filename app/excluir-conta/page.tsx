import Link from 'next/link';

export default function ExcluirContaPage() {
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
            <h1 className="text-2xl font-bold text-gray-900">Excluir sua conta e seus dados</h1>
            <p className="text-gray-500 text-sm mt-1">Tô Organizado — Última atualização: 30 de junho de 2026</p>
          </div>

          <section className="space-y-2">
            <p className="text-gray-600 text-sm leading-relaxed">
              Esta página explica como excluir sua conta do Tô Organizado e todos os dados
              associados a ela. Você pode fazer isso diretamente no aplicativo ou, caso não tenha
              mais o app instalado, solicitar a exclusão por e-mail.
            </p>
          </section>

          {/* 1. Pelo app */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Excluir pelo aplicativo</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Se você tem o app instalado, este é o caminho mais rápido:
            </p>
            <ol className="list-decimal list-inside text-gray-600 text-sm leading-relaxed space-y-1 pl-2">
              <li>Abra o Tô Organizado e faça login.</li>
              <li>Vá em <strong>Perfil</strong>.</li>
              <li>Toque em <strong>"Excluir minha conta"</strong>.</li>
              <li>Confirme a ação na janela que aparece.</li>
            </ol>
            <p className="text-gray-600 text-sm leading-relaxed">
              A exclusão é imediata e definitiva: sua conta e todos os dados associados são
              removidos. Esta ação não pode ser desfeita.
            </p>
          </section>

          {/* 2. Por e-mail */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Solicitar por e-mail</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Se você não tem mais o app instalado, escreva para{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>{' '}
              informando o <strong>e-mail da conta</strong> que deseja excluir. Atenderemos a
              solicitação no prazo de até 15 dias úteis.
            </p>
          </section>

          {/* 3. O que é excluído */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. O que é excluído</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              São removidos <strong>todos os dados pessoais e financeiros</strong> da conta:
              cadastro (nome, e-mail e credenciais de acesso), lançamentos de receitas e despesas,
              categorias, cartões, orçamentos, metas, patrimônio, a Missão de Poupança e os dados
              de uso (streaks, níveis, badges e histórico de atividade).
            </p>
          </section>

          {/* 4. Retenção */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Prazo de remoção</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Os dados são removidos permanentemente em até 30 dias, salvo obrigação legal de
              retenção por prazo superior. O tratamento dos seus dados é detalhado na nossa{' '}
              <Link href="/privacidade" className="text-blue-600 hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          {/* 5. Controlador */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Controlador dos dados</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              O controlador responsável é <strong>AIWA MARKETING DIGITAL LTDA</strong>, CNPJ
              67.507.924/0001-50. Dúvidas sobre privacidade e exclusão de dados:{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
