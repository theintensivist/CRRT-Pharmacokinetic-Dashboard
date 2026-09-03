import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Activity,
  ChevronDown,
  CircleHelp,
  Droplets,
  FlaskConical,
  Info,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  calculateSummary,
  generateConcentrationProfile,
  type CrrtModality,
  type DilutionMode,
  type PkInputs,
} from '@/utils/pkMath';
import {
  DEFAULT_DRUG,
  ICU_DRUG_DATABASE,
  findDrug,
  type DrugReference,
} from '@/data/drugDatabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type NumericField =
  | 'dose'
  | 'vdLPerKg'
  | 'proteinBinding'
  | 'molecularWeight'
  | 'interval'
  | 'weight'
  | 'residualClearance'
  | 'effluent'
  ;

type FormState = {
  drugId: string;
  drugName: string;
  dose: number;
  vdLPerKg: number;
  proteinBinding: number;
  molecularWeight: number;
  interval: number;
  weight: number;
  residualClearance: number;
  modality: CrrtModality;
  effluent: number;
  dilutionMode: DilutionMode;
};

type TooltipPayload = {
  dataKey?: string;
  value?: number;
  color?: string;
};

const initialForm: FormState = {
  drugId: DEFAULT_DRUG.id,
  drugName: DEFAULT_DRUG.name,
  dose: DEFAULT_DRUG.defaultDoseMg,
  vdLPerKg: DEFAULT_DRUG.vdLPerKg,
  proteinBinding: DEFAULT_DRUG.proteinBindingPercent,
  molecularWeight: DEFAULT_DRUG.molecularWeightDa,
  interval: DEFAULT_DRUG.defaultIntervalHours,
  weight: 74,
  residualClearance: 14,
  modality: 'CVVH' as CrrtModality,
  effluent: 25,
  dilutionMode: 'pre' as DilutionMode,
};

const customDrugDefaults: Pick<
  FormState,
  'drugName' | 'dose' | 'vdLPerKg' | 'proteinBinding' | 'molecularWeight' | 'interval'
> = {
  drugName: 'Custom drug',
  dose: 1000,
  vdLPerKg: 0.5,
  proteinBinding: 20,
  molecularWeight: 300,
  interval: 12,
};

const glossary: Record<string, string> = {
  'Bolus dose': 'The amount given at each dose time in this simplified model.',
  'Dosing interval': 'How often the bolus is repeated, measured in hours.',
  'Vd per kg': 'Volume of distribution per kilogram: a rough measure of how widely the drug spreads beyond the bloodstream.',
  'Protein binding': 'The percentage attached to proteins. The unbound portion is the part assumed available to cross the CRRT membrane.',
  'Molecular weight': 'The size of one drug molecule. Higher values make the membrane-passage approximation less certain.',
  'Patient weight': 'Body weight used to convert the prescribed effluent rate into an hourly flow.',
  'Residual clearance': 'Clearance that remains from the patient’s own kidneys, entered directly in mL/min.',
  'Effluent flow': 'The CRRT fluid removal rate used as the effective convective or diffusive flow.',
  Modality: 'The CRRT technique being modeled: CVVH removes solute mainly by convection, while CVVHD uses diffusion.',
  'CVVH': 'Continuous venovenous hemofiltration: clearance is modeled mainly by convection across the filter.',
  'CVVHD': 'Continuous venovenous hemodialysis: clearance is modeled mainly by diffusion into dialysate.',
  'Pre-filter': 'Replacement fluid enters before the filter and dilutes blood reaching the membrane.',
  'Post-filter': 'Replacement fluid enters after the filter and does not dilute the blood crossing the membrane.',
};

function formatNumber(value: number, digits = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function TermHelp({ term }: { term: string }) {
  const description = glossary[term];
  if (!description) return null;

  return (
    <span className="term-help" tabIndex={0} aria-label={`Help for ${term}`}>
      <CircleHelp size={12} strokeWidth={2.2} />
      <span className="term-tooltip" role="tooltip">
        <strong>{term}</strong>
        <span>{description}</span>
      </span>
    </span>
  );
}

function ClinicalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">HOUR {label ?? 0}</div>
       {payload.map((item, index) => (
         <div className="chart-tooltip-row" key={`${item.dataKey}-${item.color}-${index}`}>
          <span className="chart-tooltip-dot" style={{ background: item.color }} />
          <span>{item.dataKey === 'withCrrt' ? 'With CRRT' : 'Without CRRT'}</span>
          <strong className="ml-auto">{formatNumber(item.value ?? 0, 2)} mg/L</strong>
        </div>
      ))}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  range,
  help,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  range?: { min: number; max: number; step?: number };
  help?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label htmlFor={id}>
      <span className="input-label inline-flex items-center gap-1.5">
        {label}
        {help ? <TermHelp term={help} /> : null}
      </span>
      <div className="input-unit">
        <input
          id={id}
          data-testid={`input-${id}`}
          className="input-field"
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
        />
        <span>{unit}</span>
      </div>
      {range ? (
        <input
          type="range"
          aria-label={`${label} slider`}
          min={range.min}
          max={range.max}
          step={range.step ?? step}
          value={value}
          onChange={onChange}
          className="mt-2 h-1.5 w-full cursor-pointer accent-[hsl(var(--primary))]"
        />
      ) : null}
    </label>
  );
}

function SectionHeading({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof FlaskConical;
  label: string;
  detail?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <div>
        <h2 className="text-[12px] font-bold tracking-tight text-foreground">{label}</h2>
        {detail ? <p className="text-[10px] text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [showAssumptions, setShowAssumptions] = useState(true);

  const updateNumeric = (key: NumericField) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setForm((current) => ({ ...current, [key]: Number.isFinite(nextValue) ? nextValue : 0 }));
  };

  const selectDrug = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value === 'custom') {
      setForm((current) => ({
        ...current,
        drugId: 'custom',
        ...customDrugDefaults,
      }));
      return;
    }

    const drug = findDrug(event.target.value);
    setForm((current) => ({
      ...current,
      drugId: drug.id,
      drugName: drug.name,
      dose: drug.defaultDoseMg,
      vdLPerKg: drug.vdLPerKg,
      proteinBinding: drug.proteinBindingPercent,
      molecularWeight: drug.molecularWeightDa,
      interval: drug.defaultIntervalHours,
    }));
  };

  const updateDrugName = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, drugName: event.target.value }));
  };

  const reset = () => {
    setForm(initialForm);
    setShowAssumptions(true);
  };

  const calculated = useMemo(() => {
    const inputs: PkInputs = {
      vdLPerKg: Math.max(form.vdLPerKg, 0.01),
      proteinBindingPercent: Math.min(Math.max(form.proteinBinding, 0), 100),
      molecularWeightDa: Math.max(form.molecularWeight, 1),
      bolusDoseMg: Math.max(form.dose, 0),
      intervalHours: Math.max(form.interval, 0.25),
      weightKg: Math.max(form.weight, 0.1),
      residualClearanceMlMin: Math.max(form.residualClearance, 0),
      effluentMlKgH: Math.max(form.effluent, 0),
      modality: form.modality,
      dilutionMode: form.dilutionMode,
    };
    const summary = calculateSummary(inputs);
    const profile = generateConcentrationProfile(inputs, summary);
    const curve = profile.map((point) => ({
      hour: point.time,
      withCrrt: point.withCrrt,
      withoutCrrt: point.withoutCrrt,
    }));
    const targetLow = 8;
    const targetHigh = 16;
    const at24 = profile[24]?.withCrrt ?? 0;
    const status =
      at24 < targetLow
        ? 'below target'
        : at24 > targetHigh
          ? 'above target'
          : 'within target';

    return {
      inputs,
      summary,
      curve,
      initialConcentration: curve[0]?.withCrrt ?? 0,
      endogenousClearanceMlMin: summary.endogenousClearanceLh * 1000 / 60,
      crrtClearance: summary.crrtClearanceLh,
      totalClearance: summary.totalClearanceWithCrrtLh,
      unboundFraction: summary.sievingCoefficient,
      dilutionFactor: summary.dilutionFactor,
      at24,
      at48: profile[48]?.withCrrt ?? 0,
      at72: profile[72]?.withCrrt ?? 0,
      withoutAt72: profile[72]?.withoutCrrt ?? 0,
      targetLow,
      targetHigh,
      status,
      yMax: Math.max(curve[0]?.withCrrt ?? 0, targetHigh * 1.35, 1),
    };
  }, [form]);

  const selectedDrug: DrugReference | null =
    form.drugId === 'custom' ? null : findDrug(form.drugId);
  const statusClass =
    calculated.status === 'within target'
      ? 'bg-primary/10 text-primary'
      : calculated.status === 'above target'
        ? 'bg-accent/15 text-[#a45b18]'
        : 'bg-destructive/10 text-destructive';

  return (
    <div className="dashboard-shell dark">
      <div className="flex min-h-[100dvh] flex-col md:flex-row">
        <aside className="dashboard-sidebar sidebar-grid w-full shrink-0 px-4 py-4 md:w-[318px] md:px-5 md:py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow text-teal-200/70">Bedside reference</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5ac9bd] text-[#102d31]">
                  <Activity size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <div className="text-[15px] font-bold tracking-[-0.03em] text-slate-50">CRRT / PK</div>
                  <div className="text-[10px] text-slate-400">pharmacokinetic dashboard</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="icon-button border-slate-600/70 bg-slate-900/20 text-slate-400 hover:bg-slate-800 hover:text-[#79d9cd]"
              data-testid="button-reset-top"
              aria-label="Reset simulation"
              title="Reset simulation"
              onClick={reset}
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-[#5ac9bd]/20 bg-[#5ac9bd]/[.07] p-3">
            <div className="flex items-center gap-2">
              <span className="live-dot h-2 w-2 rounded-full bg-[#79d9cd]" />
              <span className="eyebrow text-[#9de4da]">Live model</span>
              <span className="ml-auto mono text-[10px] text-slate-400">72 h horizon</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
              Every control change recalculates both clearance paths immediately.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <section>
               <SectionHeading icon={FlaskConical} label="Drug profile" detail="repeated bolus model" />
              <div className="space-y-3">
                 <div>
                   <span className="input-label inline-flex items-center gap-1.5 text-slate-400">
                     ICU drug reference
                     <TermHelp term="Drug name" />
                   </span>
                   <select
                     id="drug-select"
                     data-testid="select-drug"
                     className="input-field border-slate-600 bg-slate-900/40 text-slate-100"
                     value={form.drugId}
                     onChange={selectDrug}
                   >
                     {ICU_DRUG_DATABASE.map((drug) => (
                       <option value={drug.id} key={drug.id}>{drug.name}</option>
                     ))}
                     <option value="custom">Custom drug profile</option>
                   </select>
                   {selectedDrug ? (
                     <div className="mt-2 rounded-md border border-slate-700/80 bg-slate-900/25 px-2.5 py-2">
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[10px] font-semibold text-slate-300">{selectedDrug.className}</span>
                         <span className="eyebrow text-[#79d9cd]">reference set</span>
                       </div>
                       <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{selectedDrug.renalHandling}</p>
                       <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                         {selectedDrug.sources.map((source) => (
                           <a
                             key={source.url}
                             href={source.url}
                             target="_blank"
                             rel="noreferrer"
                             className="text-[9px] font-semibold text-[#79d9cd] underline decoration-[#79d9cd]/40 underline-offset-2 hover:text-white"
                           >
                             {source.label}
                           </a>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <div className="mt-2 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-2 text-[10px] leading-relaxed text-[#c88950]">
                       User-entered profile. Add your own name and PK values below; no reference links are attached to this custom record.
                     </div>
                   )}
                   {form.drugId === 'custom' ? (
                     <label htmlFor="custom-drug-name" className="mt-3 block">
                       <span className="input-label inline-flex items-center gap-1.5 text-slate-400">
                         Custom drug name
                         <TermHelp term="Drug name" />
                       </span>
                       <input
                         id="custom-drug-name"
                         data-testid="input-custom-drug-name"
                         className="input-field border-slate-600 bg-slate-900/40 text-slate-100"
                         value={form.drugName}
                         onChange={updateDrugName}
                         placeholder="e.g. your ICU drug"
                       />
                     </label>
                   ) : null}
                 </div>
                <div className="grid grid-cols-2 gap-2">
                    <NumberField id="dose" label="Bolus dose" help="Bolus dose" value={form.dose} unit="mg" min={0} onChange={updateNumeric('dose')} />
                    <NumberField id="interval" label="Dosing interval" help="Dosing interval" value={form.interval} unit="h" min={0.25} step={0.25} range={{ min: 4, max: 24, step: 1 }} onChange={updateNumeric('interval')} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <NumberField id="vd-per-kg" label="Vd per kg" help="Vd per kg" value={form.vdLPerKg} unit="L/kg" min={0.01} max={10} step={0.01} range={{ min: 0.1, max: 2.5, step: 0.01 }} onChange={updateNumeric('vdLPerKg')} />
                    <NumberField id="protein-binding" label="Protein binding" help="Protein binding" value={form.proteinBinding} unit="%" min={0} max={100} range={{ min: 0, max: 100, step: 1 }} onChange={updateNumeric('proteinBinding')} />
                </div>
                  <NumberField id="molecular-weight" label="Molecular weight" help="Molecular weight" value={form.molecularWeight} unit="Da" min={1} max={5000} onChange={updateNumeric('molecularWeight')} />
              </div>
            </section>

            <div className="h-px bg-slate-700/60" />

            <section>
               <SectionHeading icon={UserRound} label="Patient parameters" detail="for dose-normalized volume and clearance" />
              <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-2">
                    <NumberField id="weight" label="Patient weight" help="Patient weight" value={form.weight} unit="kg" min={1} step={0.1} range={{ min: 40, max: 140, step: 1 }} onChange={updateNumeric('weight')} />
                    <NumberField id="residual-clearance" label="Residual clearance" help="Residual clearance" value={form.residualClearance} unit="mL/min" min={0} max={200} step={1} range={{ min: 0, max: 60, step: 1 }} onChange={updateNumeric('residualClearance')} />
                 </div>
              </div>
            </section>

            <div className="h-px bg-slate-700/60" />

            <section>
              <SectionHeading icon={Droplets} label="CRRT prescription" detail="delivered settings assumed constant" />
              <div className="space-y-3">
                <div>
                   <div className="input-label inline-flex items-center gap-1.5 text-slate-400">Modality <TermHelp term="Modality" /></div>
                  <div className="segmented">
                     {(['CVVH', 'CVVHD'] as CrrtModality[]).map((modality) => (
                      <button
                        type="button"
                        key={modality}
                        data-testid={`button-modality-${modality.toLowerCase()}`}
                        aria-pressed={form.modality === modality}
                        onClick={() => setForm((current) => ({ ...current, modality }))}
                      >
                        {modality}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <NumberField id="effluent" label="Effluent flow" help="Effluent flow" value={form.effluent} unit="mL/kg/h" min={0} step={1} range={{ min: 0, max: 50, step: 1 }} onChange={updateNumeric('effluent')} />
                   <div className="rounded-md border border-slate-700 bg-slate-900/25 p-2.5">
                     <div className="input-label text-slate-400">Effective effluent</div>
                     <div className="mono text-sm font-medium text-slate-100">{formatNumber(calculated.summary.effluentLh, 2)} <span className="text-[10px] text-slate-400">L/h</span></div>
                     <div className="mt-1 text-[10px] text-slate-500">{form.weight} kg × {form.effluent} mL/kg/h</div>
                   </div>
                </div>
                {form.modality === 'CVVH' ? (
                  <div className="rounded-md border border-slate-700 bg-slate-900/25 p-2.5">
                     <div className="input-label mb-2 inline-flex items-center gap-1.5 text-slate-400">Replacement location <TermHelp term="Pre-filter" /></div>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-900/55 p-1">
                       {(['pre', 'post'] as DilutionMode[]).map((site) => (
                        <button
                          type="button"
                          key={site}
                          data-testid={`button-dilution-${site}`}
                           aria-pressed={form.dilutionMode === site}
                           className={`rounded px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                             form.dilutionMode === site ? 'bg-slate-600 text-[#9de4da]' : 'text-slate-400 hover:text-slate-200'
                          }`}
                           onClick={() => setForm((current) => ({ ...current, dilutionMode: site }))}
                        >
                           {site === 'pre' ? 'Pre-filter' : 'Post-filter'}
                        </button>
                      ))}
                    </div>
                     <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                       {form.dilutionMode === 'pre'
                         ? 'A 0.75 hemodilution factor is applied to convective clearance.'
                         : 'Post-filter replacement does not reduce convective clearance.'}
                     </p>
                  </div>
                ) : (
                  <div className="flex gap-2 rounded-md border border-slate-700/80 bg-slate-900/25 p-2.5 text-[10px] leading-relaxed text-slate-400">
                    <Info size={14} className="mt-0.5 shrink-0 text-[#79d9cd]" />
                    <span>Dilution is not applied to the CVVHD dialysate clearance estimate.</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>

        <main className="dashboard-main min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7">
          <header className="fade-up flex flex-col justify-between gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
            <div>
              <div className="eyebrow">Clinical calculation surface / 01</div>
              <h1 className="mt-1 text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.055em] text-foreground">
                CRRT pharmacokinetic dashboard
              </h1>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                A transparent 72-hour concentration comparison for <span className="font-semibold text-foreground">{form.drugName || 'selected drug'}</span>, under the active prescription.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="eyebrow hidden sm:inline">Model updated live</span>
              <button type="button" className="button-quiet inline-flex items-center gap-2" data-testid="button-reset" onClick={reset}>
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </header>

          <div className="fade-up fade-up-1 mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="section-card rounded-xl p-4" data-testid="metric-endogenous-clearance">
              <div className="eyebrow">Endogenous clearance</div>
               <div className="mt-3 metric-value">{formatNumber(calculated.endogenousClearanceMlMin, 0)} <span className="text-[12px] tracking-normal text-muted-foreground">mL/min</span></div>
               <div className="mt-2 text-[10px] text-muted-foreground">entered residual clearance</div>
            </div>
            <div className="section-card rounded-xl border-primary/25 p-4" data-testid="metric-crrt-clearance">
              <div className="eyebrow text-primary">CRRT clearance</div>
              <div className="mt-3 metric-value metric-accent">{formatNumber(calculated.crrtClearance, 2)} <span className="text-[12px] tracking-normal text-muted-foreground">L/h</span></div>
               <div className="mt-2 text-[10px] text-muted-foreground">{form.modality} · {formatNumber(calculated.unboundFraction * 100, 0)}% unbound</div>
            </div>
            <div className="section-card rounded-xl p-4" data-testid="metric-total-clearance">
              <div className="eyebrow">Total clearance</div>
              <div className="mt-3 metric-value">{formatNumber(calculated.totalClearance, 2)} <span className="text-[12px] tracking-normal text-muted-foreground">L/h</span></div>
              <div className="mt-2 text-[10px] text-muted-foreground">Endogenous + extracorporeal</div>
            </div>
            <div className="section-card rounded-xl border-accent/30 p-4" data-testid="metric-24h-concentration">
              <div className="eyebrow text-[#a45b18]">24 h with CRRT</div>
              <div className="mt-3 metric-value metric-warm">{formatNumber(calculated.at24, 2)} <span className="text-[12px] tracking-normal text-muted-foreground">mg/L</span></div>
              <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}>{calculated.status}</div>
            </div>
          </div>

          <section className="section-card fade-up fade-up-2 mt-5 rounded-xl p-4 sm:p-5" data-testid="card-concentration-chart">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-bold tracking-tight text-foreground">Concentration over time</h2>
                 <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-primary">72 hours</span>
                </div>
               <p className="mt-1 text-[11px] text-muted-foreground">Projected repeated bolus profile · target band 8–16 mg/L · immediate distribution</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-primary" /> With CRRT</span>
                <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#7b8798]" /> Without CRRT</span>
                <span className="flex items-center gap-2"><i className="h-2.5 w-5 rounded-sm bg-accent/30 ring-1 ring-accent/35" /> Target band</span>
              </div>
            </div>
            <div className="chart-wrap mt-5 -ml-3 sm:-ml-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={calculated.curve} margin={{ top: 8, right: 18, bottom: 2, left: 2 }}>
                  <CartesianGrid vertical={false} className="chart-grid-line" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: 'hsl(215 16% 46%)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(value) => `${value}h`} />
                  <YAxis domain={[0, calculated.yMax]} tickLine={false} axisLine={false} width={44} tick={{ fill: 'hsl(215 16% 46%)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(value) => formatNumber(value, value < 10 ? 1 : 0)} />
                  <Tooltip content={<ClinicalTooltip />} cursor={{ stroke: 'hsl(178 62% 37% / .25)', strokeWidth: 1 }} />
                  <ReferenceArea y1={calculated.targetLow} y2={calculated.targetHigh} fill="hsl(24 78% 61% / .13)" strokeOpacity={0} />
                  <ReferenceLine y={calculated.targetLow} stroke="hsl(24 78% 61% / .65)" strokeDasharray="4 4" />
                  <ReferenceLine y={calculated.targetHigh} stroke="hsl(24 78% 61% / .65)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="withoutCrrt" stroke="#7b8798" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4, fill: '#7b8798', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="withCrrt" stroke="hsl(178 62% 37%)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: 'hsl(178 62% 37%)', strokeWidth: 2, stroke: 'hsl(210 35% 99%)' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
              <CircleHelp size={13} className="text-primary" />
               <span>CRRT path includes unbound drug clearance and the selected modality. It is not a dosing recommendation.</span>
            </div>
          </section>

          <div className="fade-up fade-up-3 mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <section className="section-card rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Read the curve</div>
                  <h2 className="mt-1 text-[14px] font-bold tracking-tight">Selected checkpoints</h2>
                </div>
                <SlidersHorizontal size={16} className="text-muted-foreground" />
              </div>
              <div className="mobile-scroll mt-4">
                <div className="min-w-[420px] overflow-hidden rounded-lg border border-border">
                  <div className="grid grid-cols-[.65fr_1fr_1fr] bg-muted/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
                    <span>Time</span><span>With CRRT</span><span>Without CRRT</span>
                  </div>
                  {[{ hour: 0, withCrrt: calculated.initialConcentration, withoutCrrt: calculated.initialConcentration }, { hour: 24, withCrrt: calculated.at24, withoutCrrt: calculated.curve[12].withoutCrrt }, { hour: 48, withCrrt: calculated.at48, withoutCrrt: calculated.curve[24].withoutCrrt }, { hour: 72, withCrrt: calculated.at72, withoutCrrt: calculated.withoutAt72 }].map((row) => (
                    <div className="grid grid-cols-[.65fr_1fr_1fr] border-t border-border px-3 py-2.5 text-[11px]" key={row.hour} data-testid={`row-checkpoint-${row.hour}`}>
                      <span className="mono text-muted-foreground">{row.hour} h</span>
                      <span className="mono font-medium text-primary">{formatNumber(row.withCrrt, 2)} <small className="text-muted-foreground">mg/L</small></span>
                      <span className="mono text-muted-foreground">{formatNumber(row.withoutCrrt, 2)} <small>mg/L</small></span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="section-card rounded-xl p-4 sm:p-5">
              <button
                type="button"
                className="flex w-full items-start justify-between text-left"
                data-testid="button-toggle-assumptions"
                aria-expanded={showAssumptions}
                onClick={() => setShowAssumptions((current) => !current)}
              >
                <div>
                  <div className="eyebrow">Model boundaries</div>
                  <h2 className="mt-1 text-[14px] font-bold tracking-tight">Assumptions & disclaimer</h2>
                </div>
                <ChevronDown size={17} className={`mt-1 text-muted-foreground transition-transform ${showAssumptions ? 'rotate-180' : ''}`} />
              </button>
              {showAssumptions ? (
                <div className="mt-4 space-y-3">
                  <div className="assumption-row"><ShieldCheck size={14} /><span>First-order elimination assumes stable prescription, drug distribution, and serum creatinine across 72 hours.</span></div>
                   <div className="assumption-row"><Info size={14} /><span>Endogenous clearance is entered directly in mL/min; no renal-function equation is inferred from demographics.</span></div>
                   <div className="assumption-row"><Droplets size={14} /><span>{form.modality} clearance uses unbound fraction × effective effluent. CVVH pre-filter dilution applies a 0.75 factor; post-filter does not.</span></div>
                   <div className="assumption-row"><FlaskConical size={14} /><span>Sieving and saturation are approximated as 1 − protein binding; molecular weight is shown to flag the membrane-passage assumption.</span></div>
                   {calculated.summary.assumedMembranePassage ? (
                     <div className="rounded-md border border-accent/35 bg-accent/10 px-3 py-2.5 text-[10px] font-medium leading-relaxed text-[#c88950]">
                       Molecular weight is above 1,000 Da. The free-fraction estimate should be treated as especially uncertain for membrane passage.
                     </div>
                   ) : null}
                  <div className="rounded-md bg-accent/10 px-3 py-2.5 text-[10px] font-medium leading-relaxed text-[#8d551f]">
                    This reference surface supports clinical thinking; it does not replace therapeutic drug monitoring, local protocols, or clinical judgment.
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-border/70 pt-4 text-[10px] text-muted-foreground sm:flex-row">
            <span className="mono">CRRT / PK · calculation state is local to this session</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary" /> Transparent assumptions shown above</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;