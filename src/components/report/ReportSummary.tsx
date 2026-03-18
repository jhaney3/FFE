'use client';

import { Fragment, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Totals { total: number; excellent: number; good: number; fair: number; poor: number; }
interface ComboRow extends Totals { attributes: string[]; }

interface ParentGroup {
  parentAttr: string | null; // null = no parent level (flat fallback)
  totals: Totals;
  rows: ComboRow[];
}

interface TypeGroup {
  typeName: string;
  typeTotal: Totals;
  hasParents: boolean;
  parentGroups: ParentGroup[];
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    total:     a.total     + b.total,
    excellent: a.excellent + b.excellent,
    good:      a.good      + b.good,
    fair:      a.fair      + b.fair,
    poor:      a.poor      + b.poor,
  };
}

const ZERO: Totals = { total: 0, excellent: 0, good: 0, fair: 0, poor: 0 };

function buildGroups(items: any[], tagMeta: Map<string, boolean>): TypeGroup[] {
  // typeId → Set of parent attr names for that type
  const typesWithParents = new Set<string>();
  tagMeta.forEach((_, key) => {
    const typeId = key.split(':')[0];
    typesWithParents.add(typeId);
  });

  // typeName → { typeId, hasParents, parentKey → { parentAttr, attrKey → ComboRow } }
  const typeMap = new Map<string, {
    typeId: string;
    hasParents: boolean;
    parentMap: Map<string, { parentAttr: string | null; rowMap: Map<string, ComboRow> }>;
  }>();

  items.forEach(item => {
    const typeName = item.ItemTypes?.name || 'Unknown';
    const typeId   = item.item_type_id || '';
    const attrs    = [...(item.attributes || [])].sort();
    const e = item.qty_excellent || 0;
    const g = item.qty_good      || 0;
    const f = item.qty_fair      || 0;
    const p = item.qty_poor      || 0;
    const t = e + g + f + p;

    if (!typeMap.has(typeName)) {
      typeMap.set(typeName, { typeId, hasParents: false, parentMap: new Map() });
    }
    const te = typeMap.get(typeName)!;
    if (typesWithParents.has(typeId)) te.hasParents = true;

    // Determine parent attr for this item
    const parentAttr = te.hasParents
      ? (attrs.find(a => tagMeta.get(`${typeId}:${a}`)) ?? null)
      : null;
    const parentKey = parentAttr ?? '__flat__';

    if (!te.parentMap.has(parentKey)) {
      te.parentMap.set(parentKey, { parentAttr, rowMap: new Map() });
    }
    const pg = te.parentMap.get(parentKey)!;

    const attrKey = attrs.join(',');
    if (!pg.rowMap.has(attrKey)) {
      pg.rowMap.set(attrKey, { attributes: attrs, total: 0, excellent: 0, good: 0, fair: 0, poor: 0 });
    }
    const row = pg.rowMap.get(attrKey)!;
    row.total     += t;
    row.excellent += e;
    row.good      += g;
    row.fair      += f;
    row.poor      += p;
  });

  return Array.from(typeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([typeName, te]) => {
      const parentGroups: ParentGroup[] = Array.from(te.parentMap.entries())
        .sort(([a], [b]) => {
          if (a === '__flat__') return 0;
          if (a === null) return 1;
          return a.localeCompare(b ?? '');
        })
        .map(([, pg]) => {
          const rows = Array.from(pg.rowMap.values())
            .sort((a, b) => a.attributes.join(',').localeCompare(b.attributes.join(',')));
          const totals = rows.reduce((acc, r) => addTotals(acc, r), { ...ZERO });
          return { parentAttr: pg.parentAttr, totals, rows };
        });

      const typeTotal = parentGroups.reduce((acc, pg) => addTotals(acc, pg.totals), { ...ZERO });

      return { typeName, typeTotal, hasParents: te.hasParents, parentGroups };
    });
}

function QCell({ n, color }: { n: number; color: string }) {
  return (
    <td className={`px-4 py-2 border border-gray-200 text-right text-${color}-700 text-xs`}>
      {n || '—'}
    </td>
  );
}

function AttrPills({ attrs, tagMeta, typeId }: { attrs: string[]; tagMeta: Map<string, boolean>; typeId?: string }) {
  if (attrs.length === 0) return <span className="italic text-gray-400">(no attributes)</span>;
  const parentAttrs = attrs.filter(a => typeId ? tagMeta.get(`${typeId}:${a}`) : false);
  const childAttrs  = attrs.filter(a => !(typeId ? tagMeta.get(`${typeId}:${a}`) : false));
  return (
    <span className="flex flex-wrap gap-1 items-center">
      {parentAttrs.map(a => (
        <span key={a} className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-amber-50 text-amber-700 border border-amber-200">{a}</span>
      ))}
      {childAttrs.length > 0 && <span className="text-xs text-gray-700">{childAttrs.join(', ')}</span>}
    </span>
  );
}

export default function ReportSummary({ items }: { items: any[] }) {
  // tagMeta: `${item_type_id}:${name}` → true (is_parent only)
  const [tagMeta, setTagMeta] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    const typeIds = [...new Set(items.map(i => i.item_type_id).filter(Boolean))];
    if (typeIds.length === 0) return;
    supabase.from('ItemTypeAttributes')
      .select('item_type_id, name')
      .in('item_type_id', typeIds)
      .eq('is_parent', true)
      .then(({ data }) => {
        const meta = new Map<string, boolean>();
        (data || []).forEach(t => meta.set(`${t.item_type_id}:${t.name}`, true));
        setTagMeta(meta);
      });
  }, [items]);

  const typeGroups = buildGroups(items, tagMeta);

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
          {typeGroups.map(({ typeName, typeTotal, hasParents, parentGroups }, gi) => {
            const typeId = items.find(i => i.ItemTypes?.name === typeName)?.item_type_id;
            const multipleVariants = parentGroups.length > 1 || parentGroups[0]?.rows.length > 1;

            return (
              <Fragment key={typeName}>
                {gi > 0 && (
                  <tr key={`${typeName}-spacer`}>
                    <td colSpan={7} className="p-0 h-0 border-0 border-t-2 border-t-gray-400" />
                  </tr>
                )}

                {/* ── Type header row ── */}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2.5 border border-gray-200 text-gray-800">{typeName}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-gray-400 text-xs italic font-normal">
                    {multipleVariants ? 'all variants' : (
                      parentGroups[0]?.rows[0]
                        ? <AttrPills attrs={parentGroups[0].rows[0].attributes} tagMeta={tagMeta} typeId={typeId} />
                        : '(no attributes)'
                    )}
                  </td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-gray-800">{typeTotal.total}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-green-700">{typeTotal.excellent || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-blue-700">{typeTotal.good || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-yellow-700">{typeTotal.fair || '—'}</td>
                  <td className="px-4 py-2.5 border border-gray-200 text-right text-red-700">{typeTotal.poor || '—'}</td>
                </tr>

                {multipleVariants && hasParents && parentGroups.map((pg, pgi) => (
                  <Fragment key={pgi}>
                    {/* ── Parent attr sub-header ── */}
                    {(parentGroups.length > 1 || pg.parentAttr) && (
                      <tr className="bg-amber-50/60">
                        <td className="pl-6 pr-4 py-2 border border-gray-200 text-amber-800 text-xs font-semibold" colSpan={2}>
                          <span className="text-amber-400 mr-1.5">▸</span>
                          {pg.parentAttr ?? '(ungrouped)'}
                        </td>
                        <td className="px-4 py-2 border border-gray-200 text-right text-amber-700 text-xs font-semibold">{pg.totals.total}</td>
                        <QCell n={pg.totals.excellent} color="green" />
                        <QCell n={pg.totals.good}      color="blue"  />
                        <QCell n={pg.totals.fair}      color="yellow"/>
                        <QCell n={pg.totals.poor}      color="red"   />
                      </tr>
                    )}

                    {/* ── Child combo rows ── */}
                    {pg.rows.map((row, ri) => {
                      const childAttrs = pg.parentAttr
                        ? row.attributes.filter(a => a !== pg.parentAttr)
                        : row.attributes;
                      return (
                        <tr key={ri} className="bg-white">
                          <td className="pl-10 pr-4 py-2 border border-gray-200 text-gray-500 text-xs" colSpan={2}>
                            <span className="text-gray-300 mr-2">↳</span>
                            {childAttrs.length > 0
                              ? <span className="text-gray-700">{childAttrs.join(', ')}</span>
                              : <span className="italic text-gray-400">(no details)</span>}
                          </td>
                          <td className="px-4 py-2 border border-gray-200 text-right text-gray-600 text-xs">{row.total}</td>
                          <QCell n={row.excellent} color="green" />
                          <QCell n={row.good}      color="blue"  />
                          <QCell n={row.fair}      color="yellow"/>
                          <QCell n={row.poor}      color="red"   />
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}

                {/* ── Flat detail rows (no parent attrs defined for this type) ── */}
                {multipleVariants && !hasParents && parentGroups[0]?.rows.map((row, ri) => (
                  <tr key={ri} className="bg-white">
                    <td className="pl-8 pr-4 py-2 border border-gray-200 text-gray-500 text-xs" colSpan={2}>
                      <span className="text-gray-300 mr-2">↳</span>
                      {row.attributes.length > 0
                        ? row.attributes.join(', ')
                        : <span className="italic text-gray-400">(no attributes)</span>}
                    </td>
                    <td className="px-4 py-2 border border-gray-200 text-right text-gray-600 text-xs">{row.total}</td>
                    <QCell n={row.excellent} color="green" />
                    <QCell n={row.good}      color="blue"  />
                    <QCell n={row.fair}      color="yellow"/>
                    <QCell n={row.poor}      color="red"   />
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
