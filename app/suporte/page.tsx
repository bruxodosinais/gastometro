import Link from 'next/link';

export default function SuportePage() {
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
            <h1 className="text-2xl font-bold text-gray-900">Central de Ajuda</h1>
            <p className="text-gray-500 text-sm mt-1">Tô Organizado — Suporte ao usuário</p>
          </div>

          <section className="space-y-2">
            <p className="text-gray-600 text-sm leading-relaxed">
              Precisa de ajuda com o Tô Organizado? Nesta página você encontra as respostas
              para as dúvidas mais comuns e como falar com a nossa equipe.
            </p>
          </section>

          {/* Contato */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Fale com a gente</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Não encontrou o que precisava? Escreva para{' '}
              <a href="mailto:contato@toorganizado.com.br" className="text-blue-600 hover:underline">
                contato@toorganizado.com.br
              </a>{' '}
              descrevendo sua dúvida ou problema. Respondemos no prazo de até 15 dias úteis.
            </p>
          </section>

          {/* FAQ */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Perguntas frequentes</h2>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900">Como criar uma conta?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Abra o app, escolha criar uma conta e informe seu e-mail e uma senha. Em seguida,
                enviamos um código de confirmação para o seu e-mail — basta digitá-lo no app para
                ativar a conta.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900">Esqueci minha senha — como recuperar?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Na tela de login, toque em <strong>"Esqueci minha senha"</strong> e informe o e-mail
                da sua conta. Você receberá um link por e-mail para cadastrar uma nova senha.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900">Como excluir minha conta e meus dados?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Você pode excluir tudo diretamente no app, em <strong>Perfil → Excluir minha conta</strong>,
                ou solicitar por e-mail. O passo a passo completo está na página{' '}
                <Link href="/excluir-conta" className="text-blue-600 hover:underline">
                  Excluir sua conta e seus dados
                </Link>
                .
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900">Como funciona a Missão de Poupança?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                A Missão de Poupança ajuda você a criar o hábito de guardar dinheiro rumo às suas
                metas. Você define um objetivo e o app acompanha seu progresso, incentivando você a
                registrar quanto conseguiu poupar ao longo do tempo.
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900">Meus dados estão seguros?</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Sim. Seus dados são tratados de acordo com a LGPD e ficam vinculados apenas à sua
                conta. Detalhamos como coletamos, usamos e protegemos suas informações na nossa{' '}
                <Link href="/privacidade" className="text-blue-600 hover:underline">
                  Política de Privacidade
                </Link>
                .
              </p>
            </div>
          </section>

          {/* Rodapé */}
          <section className="border-t border-gray-100 pt-6">
            <p className="text-gray-500 text-sm leading-relaxed">
              Veja também:{' '}
              <Link href="/privacidade" className="text-blue-600 hover:underline">
                Política de Privacidade
              </Link>
              {' · '}
              <Link href="/termos" className="text-blue-600 hover:underline">
                Termos de Uso
              </Link>
              {' · '}
              <Link href="/excluir-conta" className="text-blue-600 hover:underline">
                Excluir conta
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
