import { Link } from "react-router-dom";

export default function CareNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="text-muted-foreground">
        Cette adresse n'existe pas sur MediKong Care.
      </p>
      <Link to="/" className="text-mk-blue underline underline-offset-4">
        Retour au portail Care
      </Link>
    </main>
  );
}
