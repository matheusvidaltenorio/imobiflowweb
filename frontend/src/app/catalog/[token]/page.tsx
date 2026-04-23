import { notFound } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export default async function PublicCatalogPage({ params }: { params: { token: string } }) {
  const res = await fetch(`${API}/catalog-share/public/${params.token}`, { next: { revalidate: 0 } });
  if (!res.ok) notFound();
  const data = (await res.json()) as {
    title: string;
    message?: string | null;
    items: Array<{ lotId?: string | null; propertyId?: string | null; brokerNote?: string | null }>;
  };

  return (
    <main className="min-h-screen bg-surface p-6 md:p-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-primary-950">{data.title}</h1>
        {data.message ? <p className="text-gray-700">{data.message}</p> : null}
        <ul className="space-y-3">
          {data.items.map((it, i) => (
            <li key={i} className="rounded-xl border border-surface-muted bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-primary-900">
                {it.lotId ? `Lote (ref. ${it.lotId.slice(0, 8)}…)` : it.propertyId ? `Imóvel (ref. ${it.propertyId.slice(0, 8)}…)` : 'Item'}
              </p>
              {it.brokerNote ? <p className="mt-1 text-sm text-gray-600">{it.brokerNote}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
