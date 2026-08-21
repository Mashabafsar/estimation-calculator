import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function ClientsPage() {
  const { token } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { name: '', industry: '', countryId: '', currencyId: '', notes: '' },
  });

  async function load() {
    const [c, countriesData, currenciesData] = await Promise.all([
      api<any[]>('/clients', { token }),
      api<any[]>('/countries', { token }),
      api<any[]>('/currencies', { token }),
    ]);
    setClients(c);
    setCountries(countriesData);
    setCurrencies(currenciesData);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [token]);

  async function onSubmit(values: any) {
    await api('/clients', {
      method: 'POST',
      token,
      body: JSON.stringify({
        ...values,
        countryId: values.countryId || undefined,
        currencyId: values.currencyId || undefined,
      }),
    });
    reset();
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Clients</h1>
        <p className="page-subtitle">
          Accounts, industries, and number of estimates per client.
        </p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={handleSubmit(onSubmit)} className="card p-4 space-y-3 h-fit">
          <h2 className="font-semibold">Add Client</h2>
          <input className="input" placeholder="Client name" {...register('name', { required: true })} />
          <input className="input" placeholder="Industry" {...register('industry')} />
          <select className="input" {...register('countryId')}>
            <option value="">Country</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" {...register('currencyId')}>
            <option value="">Currency</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          <textarea className="input min-h-20" placeholder="Notes" {...register('notes')} />
          <button className="btn btn-primary w-full">Create</button>
        </form>
        <div className="lg:col-span-2 card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] bg-[var(--color-canvas)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Industry</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">No. of Estimates</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const count = c.estimatesCount ?? c._count?.estimates ?? 0;
                return (
                  <tr key={c.id} className="border-t border-[var(--color-line)]">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.industry ?? '—'}</td>
                    <td className="px-4 py-3">{c.country?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/estimates?clientId=${c.id}`}
                        className="badge bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        title="View estimates for this client"
                      >
                        {count}
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!clients.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
