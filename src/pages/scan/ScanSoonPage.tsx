export default function ScanSoonPage({ title }: { title: string }) {
  return (
    <div className="px-5 pt-10 space-y-2">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-muted-foreground">Bientôt disponible.</p>
    </div>
  );
}
