interface SummaryRow {
  itemType: string;
  attributes: string[];
  total: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

function buildSummaryRows(items: any[]): SummaryRow[] {
  const map = new Map<string, SummaryRow>();

  items.forEach(item => {
    const attrs = [...(item.attributes || [])].sort();
    const typeName = item.ItemTypes?.name || 'Unknown';
    const key = `${typeName}||${attrs.join(',')}`;

    if (!map.has(key)) {
      map.set(key, { itemType: typeName, attributes: attrs, total: 0, excellent: 0, good: 0, fair: 0, poor: 0 });
    }
    const row = map.get(key)!;
    const e = item.qty_excellent || 0;
    const g = item.qty_good || 0;
    const f = item.qty_fair || 0;
    const p = item.qty_poor || 0;
    row.excellent += e;
    row.good += g;
    row.fair += f;
    row.poor += p;
    row.total += e + g + f + p;
  });

  return Array.from(map.values()).sort((a, b) => {
    const tc = a.itemType.localeCompare(b.itemType);
    return tc !== 0 ? tc : a.attributes.join(',').localeCompare(b.attributes.join(','));
  });
}

import { Fragment } from 'react';

type Totals = { total: number; excellent: number; good: number; fair: number; poor: number };

function sumRows(rows: SummaryRow[]): Totals {
  return rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, excellent: acc.excellent + r.excellent, good: acc.good + r.good, fair: acc.fair + r.fair, poor: acc.poor + r.poor }),
    { total: 0, excellent: 0, good: 0, fair: 0, poor: 0 }
  );
}

export default function ReportSummary({ items }: { items: any[] }) {
  const rows = buildSummaryRows(items);

  // Group rows by item type for per-type subtotal rows
  const typeGroups: { typeName: string; rows: SummaryRow[] }[] = [];
  rows.forEach(row => {
    const existing = typeGroups.find(g => g.typeName === row.itemType);
    if (existing) existing.rows.push(row);
    else typeGroups.push({ typeName: row.itemType, rows: [row] });
  });

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-800 mb-3">Summary by Item Type</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 text-left border border-gray-200">Item Type</th>
            <th className="px-4 py-3 text-left border border-gray-200">Attributes</th>
            <th className="px-4 py-3 text-right border border-gray-200 font-bold text-gray-700">Total</th>
            <th className="px-4 py-3 text-right border border-gray-200 text-green-700">Excellent</th>
            <th className="px-4 py-3 text-right border border-gray-200 text-blue-700">Good</th>
            <th className="px-4 py-3 text-right border border-gray-200 text-yellow-700">Fair</th>
            <th className="px-4 py-3 text-right border border-gray-200 text-red-700">Poor</th>
          </tr>
        </thead>
        <tbody>
          {typeGroups.map(({ typeName, rows: typeRows }, gi) => {
            const sub = sumRows(typeRows);
            const hasVariants = typeRows.length > 1;
            return (
              <Fragment key={typeName}>
                {/* Spacer row between groups */}
                {gi > 0 && (
                  <tr key={`${typeName}-spacer`}>
                    <td colSpan={7} className="p-0 h-0 border-0 border-t-2 border-t-gray-400" />
                  </tr>
                )}

                {/* Total / header row — always first, always 7 cells */}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2.5 border border-gray-200 text-gray-800">{typeName}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-gray-400 text-xs italic font-normal">
                    {hasVariants
                      ? 'all variants'
                      : (typeRows[0].attributes.length > 0 ? typeRows[0].attributes.join(', ') : '(no attributes)')}
                  </td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-gray-800">{sub.total}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-green-700">{sub.excellent || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-blue-700">{sub.good || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-yellow-700">{sub.fair || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-red-700">{sub.poor || '—'}</td>
                </tr>

                {/* Indented detail rows — only when multiple variants exist */}
                {hasVariants && typeRows.map((row, i) => (
                  <tr key={`${typeName}-${i}`} className="bg-white">
                    <td className="pl-8 pr-4 py-2 border border-gray-200 text-gray-500 text-xs" colSpan={2}>
                      <span className="text-gray-300 mr-2">↳</span>
                      {row.attributes.length > 0
                        ? row.attributes.join(', ')
                        : <span className="italic text-gray-400">(no attributes)</span>}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-gray-600 text-xs">{row.total}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-green-600 text-xs">{row.excellent || '—'}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-blue-600 text-xs">{row.good || '—'}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-yellow-600 text-xs">{row.fair || '—'}</td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-red-600 text-xs">{row.poor || '—'}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
