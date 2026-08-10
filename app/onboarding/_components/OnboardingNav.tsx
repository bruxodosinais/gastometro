'use client';

type PrimaryButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Rótulo do estado de carregamento. Nem toda espera é uma gravação — o
   *  convite de notificações espera o diálogo de permissão do sistema. */
  loadingLabel?: string;
  children: React.ReactNode;
};

export function PrimaryButton({
  onClick,
  disabled,
  loading,
  loadingLabel = 'Salvando...',
  children,
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
      style={{ background: 'var(--accent)' }}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

type SecondaryButtonProps = {
  onClick: () => void;
  children: React.ReactNode;
};

export function SecondaryButton({ onClick, children }: SecondaryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="py-3.5 px-5 rounded-xl font-semibold transition-colors flex-shrink-0"
      style={{
        border: '1.5px solid var(--accent)',
        color: 'var(--accent)',
        background: '#fff',
      }}
    >
      {children}
    </button>
  );
}

type SkipLinkProps = {
  label?: string;
  onSkip: () => void;
};

export function SkipLink({ label, onSkip }: SkipLinkProps) {
  return (
    <button
      onClick={onSkip}
      className="mt-4 text-gray-400 text-sm text-center w-full"
    >
      {label ?? 'Pular'}
    </button>
  );
}

type OnboardingNavProps = {
  onBack: () => void;
  showBack?: boolean;
  onPrimary: () => void;
  primaryLabel: React.ReactNode;
  primaryDisabled?: boolean;
  loading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
};

export function OnboardingNav({
  onBack,
  showBack = true,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  loading,
  onSkip,
  skipLabel,
}: OnboardingNavProps) {
  return (
    <>
      <div className="flex gap-3">
        {showBack && <SecondaryButton onClick={onBack}>Voltar</SecondaryButton>}
        <div className="flex-1">
          <PrimaryButton
            onClick={onPrimary}
            disabled={primaryDisabled}
            loading={loading}
          >
            {primaryLabel}
          </PrimaryButton>
        </div>
      </div>
      {onSkip && <SkipLink label={skipLabel} onSkip={onSkip} />}
    </>
  );
}
