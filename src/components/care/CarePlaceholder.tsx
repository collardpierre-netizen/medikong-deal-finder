interface CarePlaceholderProps {
  title: string;
  subtitle?: string;
  description?: string;
}

/**
 * Coquille d'écran Care (LOT 0) : l'ossature de routage est posée,
 * les écrans métier sont livrés à l'étape suivante.
 */
export function CarePlaceholder({ title, subtitle, description }: CarePlaceholderProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-3 px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </main>
  );
}
