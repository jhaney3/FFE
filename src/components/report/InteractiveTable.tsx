'use client';

import { Fragment } from 'react';
import { type TypeGroup } from './ReportSummary';
import { type Spotlight } from '@/lib/buildSpotlightProps';

interface Props {
  typeGroups: TypeGroup[];
  tagMeta: Map<string, boolean>;
  spotlight: Spotlight | null;
  onSpotlightChange: (s: Spotlight | null) => void;
}

function isTypeActive(spotlight: Spotlight | null, typeName: string) {
  return spotlight?.typeName === typeName && spotlight.parentAttr === null && spotlight.attrCombo === null;
}
function isParentActive(spotlight: Spotlight | null, typeName: string, parentAttr: string | null) {
  return spotlight?.typeName === typeName && spotlight.parentAttr === parentAttr && spotlight.attrCombo === null;
}
function isComboActive(spotlight: Spotlight | null, typeName: string, parentAttr: string | null, attrCombo: string) {
  return spotlight?.typeName === typeName && spotlight.parentAttr === parentAttr && spotlight.attrCombo === attrCombo;
}

function Num({ n, cls }: { n: number; cls: string }) {
  return (
    <td className={`px-3 py-2 text-right tabular-nums text-xs ${cls}`}>
      {n || <span className="text-gray-700">—</span>}
    </td>
  );
}

export default function InteractiveTable({ typeGroups, tagMeta, spotlight, onSpotlightChange }: Props) {
  if (typeGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-600 font-mono text-xs tracking-widest uppercase">
        No items match the current filters
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-950 border-b border-gray-800">
          <th className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500 w-[180px]">Type</th>
          <th className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.15em] uppercase text-gray-500">Attrs</th>
          <th className="px-3 py-2.5 text-right font-mono text-[10px] tracking-[0.15em] uppercase text-green-600 w-14">Exc</th>
          <th className="px-3 py-2.5 text-right font-mono text-[10px] tracking-[0.15em] uppercase text-blue-600 w-14">Gd</th>
          <th className="px-3 py-2.5 text-right font-mono text-[10px] tracking-[0.15em] uppercase text-yellow-600 w-14">Fair</th>
          <th className="px-3 py-2.5 text-right font-mono text-[10px] tracking-[0.15em] uppercase text-red-600 w-14">Poor</th>
          <th className="px-3 py-2.5 text-right font-mono text-[10px] tracking-[0.15em] uppercase text-gray-400 w-16">Total</th>
        </tr>
      </thead>
      <tbody>
        {typeGroups.map(({ typeName, typeTotal, hasParents, parentGroups }, gi) => {
          const multipleVariants = parentGroups.length > 1 || parentGroups[0]?.rows.length > 1;
          const typeActive = isTypeActive(spotlight, typeName);

          const handleTypeClick = () => {
            if (typeActive) onSpotlightChange(null);
            else onSpotlightChange({ typeName, parentAttr: null, attrCombo: null });
          };

          return (
            <Fragment key={typeName}>
              {gi > 0 && (
                <tr>
                  <td colSpan={7} className="p-0 h-px bg-gray-800" />
                </tr>
              )}

              {/* ── Type header row ── */}
              <tr
                onClick={handleTypeClick}
                className={`cursor-pointer border-l-2 transition-colors ${
                  typeActive
                    ? 'bg-blue-600/10 border-l-blue-500'
                    : 'bg-gray-900 border-l-transparent hover:bg-gray-800/60 hover:border-l-gray-700'
                }`}
              >
                <td className="px-4 py-2.5 font-semibold text-gray-100 text-sm">{typeName}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs italic font-normal">
                  {multipleVariants ? 'all variants' : (
                    parentGroups[0]?.rows[0]?.attributes.length > 0
                      ? parentGroups[0].rows[0].attributes.join(', ')
                      : <span className="text-gray-700">(no attributes)</span>
                  )}
                </td>
                <Num n={typeTotal.excellent} cls="text-green-400" />
                <Num n={typeTotal.good}      cls="text-blue-400" />
                <Num n={typeTotal.fair}      cls="text-yellow-400" />
                <Num n={typeTotal.poor}      cls="text-red-400" />
                <Num n={typeTotal.total}     cls="text-gray-300 font-semibold" />
              </tr>

              {/* ── Parent group rows + child combos ── */}
              {multipleVariants && hasParents && parentGroups.map((pg, pgi) => {
                const parentActive = isParentActive(spotlight, typeName, pg.parentAttr);
                const handleParentClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (parentActive) onSpotlightChange(null);
                  else onSpotlightChange({ typeName, parentAttr: pg.parentAttr, attrCombo: null });
                };

                return (
                  <Fragment key={pgi}>
                    {(parentGroups.length > 1 || pg.parentAttr) && (
                      <tr
                        onClick={handleParentClick}
                        className={`cursor-pointer border-l-2 transition-colors ${
                          parentActive
                            ? 'bg-blue-600/10 border-l-blue-500'
                            : 'bg-gray-900/40 border-l-transparent hover:bg-gray-800/40 hover:border-l-gray-700'
                        }`}
                      >
                        <td className="pl-7 pr-4 py-2 text-amber-400 text-xs font-semibold" colSpan={2}>
                          <span className="text-amber-700 mr-1.5">▸</span>
                          {pg.parentAttr ?? '(ungrouped)'}
                        </td>
                        <Num n={pg.totals.excellent} cls="text-green-400" />
                        <Num n={pg.totals.good}      cls="text-blue-400" />
                        <Num n={pg.totals.fair}      cls="text-yellow-400" />
                        <Num n={pg.totals.poor}      cls="text-red-400" />
                        <Num n={pg.totals.total}     cls="text-gray-400" />
                      </tr>
                    )}

                    {pg.rows.map((row, ri) => {
                      const childAttrs = pg.parentAttr
                        ? row.attributes.filter(a => a !== pg.parentAttr)
                        : row.attributes;
                      const attrCombo = row.attributes.join(', ') || '(no attributes)';
                      const comboActive = isComboActive(spotlight, typeName, pg.parentAttr, attrCombo);

                      const handleComboClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (comboActive) onSpotlightChange(null);
                        else onSpotlightChange({ typeName, parentAttr: pg.parentAttr, attrCombo });
                      };

                      return (
                        <tr
                          key={ri}
                          onClick={handleComboClick}
                          className={`cursor-pointer border-l-2 border-b border-b-gray-800/30 transition-colors ${
                            comboActive
                              ? 'bg-blue-600/10 border-l-blue-500'
                              : 'bg-gray-900 border-l-transparent hover:bg-gray-800/40 hover:border-l-gray-700'
                          }`}
                        >
                          <td className="pl-11 pr-4 py-2 text-gray-400 text-xs" colSpan={2}>
                            <span className="text-gray-700 mr-2">↳</span>
                            {childAttrs.length > 0
                              ? <span className="text-gray-300">{childAttrs.join(', ')}</span>
                              : <span className="italic text-gray-600">(no details)</span>}
                          </td>
                          <Num n={row.excellent} cls="text-green-400" />
                          <Num n={row.good}      cls="text-blue-400" />
                          <Num n={row.fair}      cls="text-yellow-400" />
                          <Num n={row.poor}      cls="text-red-400" />
                          <Num n={row.total}     cls="text-gray-400" />
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

              {/* ── Flat detail rows (no parent attrs) ── */}
              {multipleVariants && !hasParents && parentGroups[0]?.rows.map((row, ri) => {
                const attrCombo = row.attributes.join(', ') || '(no attributes)';
                const comboActive = isComboActive(spotlight, typeName, null, attrCombo);

                const handleComboClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (comboActive) onSpotlightChange(null);
                  else onSpotlightChange({ typeName, parentAttr: null, attrCombo });
                };

                return (
                  <tr
                    key={ri}
                    onClick={handleComboClick}
                    className={`cursor-pointer border-l-2 border-b border-b-gray-800/30 transition-colors ${
                      comboActive
                        ? 'bg-blue-600/10 border-l-blue-500'
                        : 'bg-gray-900 border-l-transparent hover:bg-gray-800/40 hover:border-l-gray-700'
                    }`}
                  >
                    <td className="pl-9 pr-4 py-2 text-gray-400 text-xs" colSpan={2}>
                      <span className="text-gray-700 mr-2">↳</span>
                      {row.attributes.length > 0
                        ? <span className="text-gray-300">{row.attributes.join(', ')}</span>
                        : <span className="italic text-gray-600">(no attributes)</span>}
                    </td>
                    <Num n={row.excellent} cls="text-green-400" />
                    <Num n={row.good}      cls="text-blue-400" />
                    <Num n={row.fair}      cls="text-yellow-400" />
                    <Num n={row.poor}      cls="text-red-400" />
                    <Num n={row.total}     cls="text-gray-400" />
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
