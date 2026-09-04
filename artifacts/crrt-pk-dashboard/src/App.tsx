import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Download,
  Droplets,
  FlaskConical,
  Info,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Upload,
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
  getTargetStatus,
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
  | 'bloodFlow'
  | 'replacementFluid'
  | 'dialysate'
  | 'ultrafiltration'
  | 'filterDuration'
  | 'customTargetLow'
  | 'customTargetHigh'
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
  bloodFlow: number;
  replacementFluid: number;
  dialysate: number;
  ultrafiltration: number;
  filterDuration: number;
  dilutionMode: DilutionMode;
  customClassName: string;
  customCommonUse: string;
  customRenalHandling: string;
  customTargetLow: number;
  customTargetHigh: number;
  customTargetType: string;
};

type CustomDrugProfile = {
  id: string;
  name: string;
  className: string;
  commonUse: string;
  renalHandling: string;
  dose: number;
  vdLPerKg: number;
  proteinBinding: number;
  molecularWeight: number;
  interval: number;
  targetLow: number;
  targetHigh: number;
  targetType: string;
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
  bloodFlow: 150,
  replacementFluid: 1800,
  dialysate: 1800,
  ultrafiltration: 100,
  filterDuration: 24,
  dilutionMode: 'pre' as DilutionMode,
  customClassName: '',
  customCommonUse: '',
  customRenalHandling: '',
  customTargetLow: 8,
  customTargetHigh: 16,
  customTargetType: 'user-entered reference window',
};

const customDrugDefaults: Pick<
  FormState,
  | 'drugName'
  | 'dose'
  | 'vdLPerKg'
  | 'proteinBinding'
  | 'molecularWeight'
  | 'interval'
  | 'customClassName'
  | 'customCommonUse'
  | 'customRenalHandling'
  | 'customTargetLow'
  | 'customTargetHigh'
  | 'customTargetType'
> = {
  drugName: 'Custom drug',
  customClassName: 'Custom profile',
  customCommonUse: '',
  customRenalHandling: '',
  dose: 1000,
  vdLPerKg: 0.5,
  proteinBinding: 20,
  molecularWeight: 300,
  interval: 12,
  customTargetLow: 8,
  customTargetHigh: 16,
  customTargetType: 'user-entered reference window',
};

const CUSTOM_PROFILE_STORAGE_KEY = 'crrt-pk-custom-profiles-v1';

function isCustomDrugProfile(profile: unknown): profile is CustomDrugProfile {
  if (!profile || typeof profile !== 'object') return false;
  const candidate = profile as CustomDrugProfile;
  return Boolean(
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.className === 'string' &&
    typeof candidate.commonUse === 'string' &&
    typeof candidate.renalHandling === 'string' &&
    typeof candidate.targetType === 'string' &&
    Number.isFinite(candidate.dose) &&
    Number.isFinite(candidate.vdLPerKg) &&
    Number.isFinite(candidate.proteinBinding) &&
    Number.isFinite(candidate.molecularWeight) &&
    Number.isFinite(candidate.interval) &&
    Number.isFinite(candidate.targetLow) &&
    Number.isFinite(candidate.targetHigh),
  );
}

function readCustomProfiles(): CustomDrugProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CUSTOM_PROFILE_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomDrugProfile);
  } catch {
    return [];
  }
}

function isCustomDrugId(id: string) {
  return id === 'custom' || id.startsWith('custom:');
}

function customProfileToForm(profile: CustomDrugProfile): Partial<FormState> {
  return {
    drugId: `custom:${profile.id}`,
    drugName: profile.name,
    dose: profile.dose,
    vdLPerKg: profile.vdLPerKg,
    proteinBinding: profile.proteinBinding,
    molecularWeight: profile.molecularWeight,
    interval: profile.interval,
    customClassName: profile.className,
    customCommonUse: profile.commonUse,
    customRenalHandling: profile.renalHandling,
    customTargetLow: profile.targetLow,
    customTargetHigh: profile.targetHigh,
    customTargetType: profile.targetType,
  };
}

const glossary: Record<string, string> = {
  'Bolus dose': 'The amount given at each dose time in this simplified model.',
  'Dosing interval': 'How often the bolus is repeated, measured in hours.',
  'Vd per kg': 'Volume of distribution per kilogram: a rough measure of how widely the drug spreads beyond the bloodstream.',
  'Protein binding': 'The percentage attached to proteins. The unbound portion is the part assumed available to cross the CRRT membrane.',
  'Molecular weight': 'The size of one drug molecule. Higher values make the membrane-passage approximation less certain.',
  'Patient weight': 'Body weight used to convert dose-normalized pharmacokinetic volume into liters.',
  'Residual clearance': 'Clearance that remains from the patient’s own kidneys, entered directly in mL/min.',
  'Blood flow': 'Blood flow through the circuit, entered in mL/min. It is used with pre-filter replacement to estimate dilution.',
  'Replacement fluid': 'CVVH substitution fluid rate. It contributes to effluent and, when pre-filter, dilutes blood entering the membrane.',
  'Dialysate': 'CVVHD dialysate rate. It is the modeled diffusive component of effluent.',
  'Net ultrafiltration': 'Net fluid removal rate. It contributes to effluent in both modeled modalities.',
  'Filter uptime': 'Hours per 24-hour day that the filter is assumed to deliver the prescription; this scales prescribed to delivered effluent.',
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
  const [savedProfiles, setSavedProfiles] = useState<CustomDrugProfile[]>(readCustomProfiles);
  const [profileMessage, setProfileMessage] = useState('');
  const [showAssumptions, setShowAssumptions] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_PROFILE_STORAGE_KEY, JSON.stringify(savedProfiles));
  }, [savedProfiles]);

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
      setProfileMessage('');
      return;
    }

    if (event.target.value.startsWith('custom:')) {
      const profile = savedProfiles.find((candidate) => `custom:${candidate.id}` === event.target.value);
      if (profile) {
        setForm((current) => ({ ...current, ...customProfileToForm(profile) }));
        setProfileMessage(`Loaded ${profile.name}.`);
      }
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
    setProfileMessage('');
  };

  const updateDrugName = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, drugName: event.target.value }));
  };

  const updateCustomText = (
    key: 'customClassName' | 'customCommonUse' | 'customRenalHandling' | 'customTargetType',
  ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const saveCustomProfile = () => {
    const name = form.drugName.trim();
    const targetLow = Math.max(form.customTargetLow, 0);
    const targetHigh = Math.max(form.customTargetHigh, 0);
    if (!name) {
      setProfileMessage('Enter a custom drug name before saving.');
      return;
    }
    if (targetHigh <= targetLow) {
      setProfileMessage('Target high must be greater than target low.');
      return;
    }
    const existingId = form.drugId.startsWith('custom:') ? form.drugId.slice('custom:'.length) : '';
    const profile: CustomDrugProfile = {
      id: existingId || `profile-${Date.now()}`,
      name,
      className: form.customClassName.trim() || 'Custom profile',
      commonUse: form.customCommonUse.trim(),
      renalHandling: form.customRenalHandling.trim(),
      dose: Math.max(form.dose, 0),
      vdLPerKg: Math.max(form.vdLPerKg, 0.01),
      proteinBinding: Math.min(Math.max(form.proteinBinding, 0), 100),
      molecularWeight: Math.max(form.molecularWeight, 1),
      interval: Math.max(form.interval, 0.25),
      targetLow,
      targetHigh,
      targetType: form.customTargetType.trim() || 'user-entered reference window',
    };
    setSavedProfiles((current) => {
      const exists = current.some((candidate) => candidate.id === profile.id);
      return exists
        ? current.map((candidate) => candidate.id === profile.id ? profile : candidate)
        : [profile, ...current];
    });
    setForm((current) => ({ ...current, ...customProfileToForm(profile) }));
    setProfileMessage(`${profile.name} saved on this device.`);
  };

  const deleteCurrentCustomProfile = () => {
    const profileId = form.drugId.startsWith('custom:') ? form.drugId.slice('custom:'.length) : '';
    if (!profileId) {
      setForm((current) => ({ ...current, drugId: 'custom', ...customDrugDefaults }));
      setProfileMessage('Custom draft cleared.');
      return;
    }
    const deleted = savedProfiles.find((profile) => profile.id === profileId);
    setSavedProfiles((current) => current.filter((profile) => profile.id !== profileId));
    setForm((current) => ({ ...current, drugId: 'custom', ...customDrugDefaults }));
    setProfileMessage(`${deleted?.name ?? 'Custom profile'} deleted.`);
  };

  const exportCustomProfiles = () => {
    if (!savedProfiles.length) {
      setProfileMessage('Save a custom profile before exporting.');
      return;
    }
    const blob = new Blob(
      [JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), profiles: savedProfiles }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'crrt-pk-custom-profiles.json';
    link.click();
    URL.revokeObjectURL(url);
    setProfileMessage(`${savedProfiles.length} custom profile${savedProfiles.length === 1 ? '' : 's'} exported.`);
  };

  const importCustomProfiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { profiles?: unknown }).profiles)
          ? (parsed as { profiles: unknown[] }).profiles
          : [];
      const imported = candidates.filter(isCustomDrugProfile);
      if (!imported.length) {
        setProfileMessage('No valid custom profiles found in that file.');
        return;
      }
      setSavedProfiles((current) => {
        const next = [...current];
        imported.forEach((profile) => {
          const index = next.findIndex((candidate) => candidate.id === profile.id);
          if (index >= 0) next[index] = profile;
          else next.unshift(profile);
        });
        return next;
      });
      setProfileMessage(`${imported.length} custom profile${imported.length === 1 ? '' : 's'} imported.`);
    } catch {
      setProfileMessage('That file could not be read as a custom profile export.');
    }
  };

  const reset = () => {
    setForm(initialForm);
    setShowAssumptions(true);
    setProfileMessage('');
  };

  const isCustomDrug = isCustomDrugId(form.drugId);
  const selectedDrug: DrugReference | null = isCustomDrug ? null : findDrug(form.drugId);

  const calculated = useMemo(() => {
    const inputs: PkInputs = {
      vdLPerKg: Math.max(form.vdLPerKg, 0.01),
      proteinBindingPercent: Math.min(Math.max(form.proteinBinding, 0), 100),
      molecularWeightDa: Math.max(form.molecularWeight, 1),
      bolusDoseMg: Math.max(form.dose, 0),
      intervalHours: Math.max(form.interval, 0.25),
      weightKg: Math.max(form.weight, 0.1),
      residualClearanceMlMin: Math.max(form.residualClearance, 0),
      bloodFlowMlMin: Math.max(form.bloodFlow, 0),
      replacementFluidMlH: Math.max(form.replacementFluid, 0),
      dialysateMlH: Math.max(form.dialysate, 0),
      ultrafiltrationMlH: Math.max(form.ultrafiltration, 0),
      filterDurationHours: Math.max(form.filterDuration, 0),
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
    const targetLow = selectedDrug?.targetRange.low ?? Math.max(form.customTargetLow, 0);
    const targetHigh = selectedDrug?.targetRange.high ?? Math.max(form.customTargetHigh, targetLow + 0.01);
    const at24 = profile[24]?.withCrrt ?? 0;
    const status = getTargetStatus(at24, targetLow, targetHigh);

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
  }, [form, selectedDrug]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    if (form.dose <= 0) messages.push('Bolus dose must be greater than 0 mg.');
    if (form.interval <= 0) messages.push('Dosing interval must be greater than 0 hours.');
    if (form.vdLPerKg <= 0) messages.push('Vd per kg must be greater than 0.');
    if (form.weight <= 0) messages.push('Patient weight must be greater than 0 kg.');
    if (form.proteinBinding < 0 || form.proteinBinding > 100) messages.push('Protein binding must be between 0% and 100%.');
     if (form.residualClearance < 0 || form.bloodFlow < 0 || form.replacementFluid < 0 || form.dialysate < 0 || form.ultrafiltration < 0) messages.push('Clearance inputs cannot be negative.');
     if (form.filterDuration < 0 || form.filterDuration > 24) messages.push('Filter uptime must be between 0 and 24 hours per day.');
    if (isCustomDrug && !form.drugName.trim()) messages.push('Custom drug name is required.');
    if (isCustomDrug && form.customTargetHigh <= form.customTargetLow) messages.push('Custom target high must be greater than target low.');
    return messages;
  }, [form, isCustomDrug]);

  const sensitivity = useMemo(() => {
    return [0.5, 1, 1.5].map((multiplier) => {
      const inputs: PkInputs = {
        ...calculated.inputs,
        replacementFluidMlH: calculated.inputs.replacementFluidMlH * multiplier,
        dialysateMlH: calculated.inputs.dialysateMlH * multiplier,
        ultrafiltrationMlH: calculated.inputs.ultrafiltrationMlH * multiplier,
      };
      const summary = calculateSummary(inputs);
      const profile = generateConcentrationProfile(inputs, summary);
      const concentration = profile[24]?.withCrrt ?? 0;
      return {
        multiplier,
        label: `${Math.round(multiplier * 100)}%`,
        concentration,
        status: getTargetStatus(concentration, calculated.targetLow, calculated.targetHigh),
      };
    });
  }, [calculated]);

  const statusClass =
    calculated.status === 'within target'
      ? 'bg-primary/10 text-primary'
      : calculated.status === 'above target'
        ? 'bg-accent/15 text-[#f0aa68]'
        : 'bg-destructive/10 text-destructive';

  return (
    <div className="dashboard-shell dark">
      <div className="flex min-h-[100dvh] flex-col md:flex-row">
        <aside className="dashboard-sidebar sidebar-grid w-full shrink-0 px-4 py-4 md:w-[318px] md:px-5 md:py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="eyebrow text-[#efbd83]/70">Bedside reference</div>
                <span className="friend-dots" aria-label="Warm café color accents">
                  <i /><i /><i />
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d8a0c8] text-[#2c1e31]">
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
              className="icon-button border-slate-600/70 bg-slate-900/20 text-slate-400 hover:bg-slate-800 hover:text-[#d8a0c8]"
              data-testid="button-reset-top"
              aria-label="Reset simulation"
              title="Reset simulation"
              onClick={reset}
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-[#d8a0c8]/25 bg-[#d8a0c8]/[.07] p-3">
            <div className="flex items-center gap-2">
              <span className="live-dot h-2 w-2 rounded-full bg-[#efbd83]" />
              <span className="eyebrow text-[#efbd83]">Live model</span>
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
                     {savedProfiles.length ? (
                       <optgroup label="Saved custom profiles">
                         {savedProfiles.map((profile) => (
                           <option value={`custom:${profile.id}`} key={profile.id}>{profile.name}</option>
                         ))}
                       </optgroup>
                     ) : null}
                     <option value="custom">Custom drug profile</option>
                   </select>
                   {selectedDrug ? (
                     <div className="mt-2 rounded-md border border-slate-700/80 bg-slate-900/25 px-2.5 py-2">
                       <div className="flex items-center justify-between gap-2">
                         <span className="text-[10px] font-semibold text-slate-300">{selectedDrug.className}</span>
                         <span className="eyebrow text-[#d8a0c8]">reference set</span>
                       </div>
                       <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{selectedDrug.renalHandling}</p>
                       <div className="mt-2 rounded border border-accent/25 bg-accent/5 px-2 py-1.5">
                         <div className="flex items-center justify-between gap-2">
                           <span className="eyebrow text-[#c88950]">Target window</span>
                           <span className="mono text-[10px] font-semibold text-[#e0a66d]">
                             {selectedDrug.targetRange.low}–{selectedDrug.targetRange.high} mg/L
                           </span>
                         </div>
                         <div className="mt-1 text-[9px] leading-relaxed text-slate-400">{selectedDrug.targetType}</div>
                         <a
                           href={selectedDrug.targetSource.url}
                           target="_blank"
                           rel="noreferrer"
                           className="mt-1 inline-block text-[9px] font-semibold text-[#e0a66d] underline decoration-[#e0a66d]/40 underline-offset-2 hover:text-white"
                         >
                           Target source: {selectedDrug.targetSource.label}
                         </a>
                       </div>
                       <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                         <span className="eyebrow text-slate-500">PK sources</span>
                         {selectedDrug.sources.map((source) => (
                           <a
                             key={source.url}
                             href={source.url}
                             target="_blank"
                             rel="noreferrer"
                             className="text-[9px] font-semibold text-[#d8a0c8] underline decoration-[#d8a0c8]/40 underline-offset-2 hover:text-white"
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
                    {isCustomDrug ? (
                      <div className="mt-3 space-y-3">
                        <label htmlFor="custom-drug-name" className="block">
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
                        <div className="grid grid-cols-2 gap-2">
                          <label htmlFor="custom-class">
                            <span className="input-label text-slate-400">Drug class</span>
                            <input id="custom-class" className="input-field border-slate-600 bg-slate-900/40 text-slate-100" value={form.customClassName} onChange={updateCustomText('customClassName')} placeholder="e.g. antibiotic" />
                          </label>
                          <label htmlFor="custom-use">
                            <span className="input-label text-slate-400">Common use</span>
                            <input id="custom-use" className="input-field border-slate-600 bg-slate-900/40 text-slate-100" value={form.customCommonUse} onChange={updateCustomText('customCommonUse')} placeholder="e.g. ICU infection" />
                          </label>
                        </div>
                        <label htmlFor="custom-renal-handling">
                          <span className="input-label text-slate-400">Renal / clinical note</span>
                          <textarea id="custom-renal-handling" className="input-field min-h-16 resize-y border-slate-600 bg-slate-900/40 text-slate-100" value={form.customRenalHandling} onChange={updateCustomText('customRenalHandling')} placeholder="Describe renal handling, uncertainty, or local guidance" />
                        </label>
                        <div>
                          <span className="input-label text-slate-400">Custom target window</span>
                          <div className="grid grid-cols-2 gap-2">
                            <NumberField id="custom-target-low" label="Target low" value={form.customTargetLow} unit="mg/L" min={0} step={0.1} onChange={updateNumeric('customTargetLow')} />
                            <NumberField id="custom-target-high" label="Target high" value={form.customTargetHigh} unit="mg/L" min={0} step={0.1} onChange={updateNumeric('customTargetHigh')} />
                          </div>
                        </div>
                        <label htmlFor="custom-target-type">
                          <span className="input-label text-slate-400">Target type / context</span>
                          <input id="custom-target-type" className="input-field border-slate-600 bg-slate-900/40 text-slate-100" value={form.customTargetType} onChange={updateCustomText('customTargetType')} placeholder="e.g. trough reference" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="button-quiet inline-flex items-center gap-1.5" data-testid="button-save-profile" onClick={saveCustomProfile}>
                            <Save size={13} /> Save profile
                          </button>
                          <button type="button" className="button-quiet inline-flex items-center gap-1.5" onClick={deleteCurrentCustomProfile}>
                            <Trash2 size={13} /> {form.drugId.startsWith('custom:') ? 'Delete' : 'Clear'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="text-button inline-flex items-center gap-1.5" onClick={exportCustomProfiles}>
                            <Download size={12} /> Export profiles
                          </button>
                          <button type="button" className="text-button inline-flex items-center gap-1.5" onClick={() => importInputRef.current?.click()}>
                            <Upload size={12} /> Import profiles
                          </button>
                          <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={importCustomProfiles} />
                        </div>
                        {profileMessage ? <p className="text-[10px] leading-relaxed text-primary">{profileMessage}</p> : null}
                      </div>
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
               <SectionHeading icon={Droplets} label="CRRT prescription" detail="modality-specific delivered settings" />
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
                   <NumberField id="blood-flow" label="Blood flow" help="Blood flow" value={form.bloodFlow} unit="mL/min" min={0} step={10} range={{ min: 0, max: 300, step: 10 }} onChange={updateNumeric('bloodFlow')} />
                   <NumberField id="filter-duration" label="Filter uptime" help="Filter uptime" value={form.filterDuration} unit="h/day" min={0} max={24} step={1} range={{ min: 0, max: 24, step: 1 }} onChange={updateNumeric('filterDuration')} />
                 </div>
                 {form.modality === 'CVVH' ? (
                   <>
                     <div className="grid grid-cols-2 gap-2">
                       <NumberField id="replacement-fluid" label="Replacement fluid" help="Replacement fluid" value={form.replacementFluid} unit="mL/h" min={0} step={100} range={{ min: 0, max: 5000, step: 100 }} onChange={updateNumeric('replacementFluid')} />
                       <NumberField id="ultrafiltration" label="Net ultrafiltration" help="Net ultrafiltration" value={form.ultrafiltration} unit="mL/h" min={0} step={50} range={{ min: 0, max: 2000, step: 50 }} onChange={updateNumeric('ultrafiltration')} />
                     </div>
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
                               form.dilutionMode === site ? 'bg-slate-600 text-[#efbd83]' : 'text-slate-400 hover:text-slate-200'
                             }`}
                             onClick={() => setForm((current) => ({ ...current, dilutionMode: site }))}
                           >
                             {site === 'pre' ? 'Pre-filter' : 'Post-filter'}
                           </button>
                         ))}
                       </div>
                       <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                         {form.dilutionMode === 'pre'
                           ? `Qb / (Qb + Qpre) = ${formatNumber(calculated.dilutionFactor * 100, 0)}% blood concentration retained before the membrane.`
                           : 'Post-filter replacement does not dilute blood crossing the membrane.'}
                       </p>
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="grid grid-cols-2 gap-2">
                       <NumberField id="dialysate" label="Dialysate" help="Dialysate" value={form.dialysate} unit="mL/h" min={0} step={100} range={{ min: 0, max: 5000, step: 100 }} onChange={updateNumeric('dialysate')} />
                       <NumberField id="ultrafiltration" label="Net ultrafiltration" help="Net ultrafiltration" value={form.ultrafiltration} unit="mL/h" min={0} step={50} range={{ min: 0, max: 2000, step: 50 }} onChange={updateNumeric('ultrafiltration')} />
                     </div>
                     <div className="flex gap-2 rounded-md border border-slate-700/80 bg-slate-900/25 p-2.5 text-[10px] leading-relaxed text-slate-400">
                       <Info size={14} className="mt-0.5 shrink-0 text-[#d8a0c8]" />
                       <span>Dialysate drives the modeled diffusive clearance; net ultrafiltration contributes to the delivered effluent estimate. Replacement-fluid dilution is not applied in CVVHD.</span>
                     </div>
                   </>
                 )}
                 <div className="rounded-md border border-primary/25 bg-primary/[.06] p-2.5">
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <div className="input-label text-slate-400">Prescribed effluent</div>
                       <div className="mono text-sm font-medium text-slate-100">{formatNumber(calculated.summary.prescribedEffluentLh, 2)} <span className="text-[10px] text-slate-400">L/h</span></div>
                       <div className="mt-1 text-[10px] text-slate-500">{form.modality === 'CVVH' ? 'replacement + net UF' : 'dialysate + net UF'}</div>
                     </div>
                     <div>
                       <div className="input-label text-slate-400">Delivered effluent</div>
                       <div className="mono text-sm font-medium text-primary">{formatNumber(calculated.summary.effluentLh, 2)} <span className="text-[10px] text-slate-400">L/h</span></div>
                       <div className="mt-1 text-[10px] text-slate-500">{formatNumber(calculated.summary.filterUptimeFraction * 100, 0)}% filter uptime</div>
                     </div>
                   </div>
                 </div>
               </div>
             </section>
          </div>
        </aside>

        <main className="dashboard-main min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-7">
          <header className="fade-up flex flex-col justify-between gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end">
            <div>
              <div className="eyebrow">The one with the PK profile / 01</div>
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
              <div className="eyebrow text-[#f0aa68]">24 h with CRRT</div>
              <div className="mt-3 metric-value metric-warm">{formatNumber(calculated.at24, 2)} <span className="text-[12px] tracking-normal text-muted-foreground">mg/L</span></div>
              <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}>{calculated.status}</div>
            </div>
          </div>

          {validationMessages.length ? (
            <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-[10px] leading-relaxed text-destructive" role="alert">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Check the highlighted model inputs</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {validationMessages.map((message) => <li key={message}>{message}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <section className="section-card fade-up fade-up-2 mt-5 rounded-xl p-4 sm:p-5" data-testid="card-concentration-chart">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-bold tracking-tight text-foreground">Concentration over time</h2>
                 <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-primary">72 hours</span>
                </div>
               <p className="mt-1 text-[11px] text-muted-foreground">
                  Projected repeated bolus profile · target band {calculated.targetLow}–{calculated.targetHigh} mg/L · {selectedDrug?.targetType ?? form.customTargetType} · immediate distribution
               </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-primary" /> With CRRT</span>
                <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#7b8798]" /> Without CRRT</span>
                 <span className="flex items-center gap-2"><i className="h-2.5 w-5 rounded-sm bg-accent/30 ring-1 ring-accent/35" /> Target band ({calculated.targetLow}–{calculated.targetHigh} mg/L)</span>
              </div>
            </div>
            <div className="chart-wrap mt-5 -ml-3 sm:-ml-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={calculated.curve} margin={{ top: 8, right: 18, bottom: 2, left: 2 }}>
                  <CartesianGrid vertical={false} className="chart-grid-line" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: 'hsl(215 16% 46%)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(value) => `${value}h`} />
                  <YAxis domain={[0, calculated.yMax]} tickLine={false} axisLine={false} width={44} tick={{ fill: 'hsl(215 16% 46%)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickFormatter={(value) => formatNumber(value, value < 10 ? 1 : 0)} />
                  <Tooltip content={<ClinicalTooltip />} cursor={{ stroke: 'hsl(277 35% 70% / .25)', strokeWidth: 1 }} />
                  <ReferenceArea y1={calculated.targetLow} y2={calculated.targetHigh} fill="hsl(24 78% 61% / .13)" strokeOpacity={0} />
                  <ReferenceLine y={calculated.targetLow} stroke="hsl(24 78% 61% / .65)" strokeDasharray="4 4" />
                  <ReferenceLine y={calculated.targetHigh} stroke="hsl(24 78% 61% / .65)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="withoutCrrt" stroke="#7b8798" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4, fill: '#7b8798', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="withCrrt" stroke="hsl(277 35% 70%)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: 'hsl(277 35% 70%)', strokeWidth: 2, stroke: 'hsl(274 22% 10%)' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
              <CircleHelp size={13} className="text-primary" />
               <span>CRRT path includes unbound drug clearance and the selected modality. It is not a dosing recommendation.</span>
            </div>
          </section>

          <section className="section-card fade-up fade-up-3 mt-5 rounded-xl p-4 sm:p-5" data-testid="card-sensitivity">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Stress test</div>
                <h2 className="mt-1 text-[14px] font-bold tracking-tight text-foreground">Effluent sensitivity</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Modeled 24-hour concentration if the fluid-rate components are 50%, 100%, or 150% of the entered prescription.
                </p>
              </div>
              <SlidersHorizontal size={16} className="text-primary" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {sensitivity.map((scenario) => (
                <div key={scenario.multiplier} className="rounded-lg border border-border bg-muted/35 p-3">
                  <div className="eyebrow">{scenario.label} effluent</div>
                  <div className="mt-2 mono text-[15px] font-semibold text-primary">{formatNumber(scenario.concentration, 2)} <span className="text-[9px] font-normal text-muted-foreground">mg/L</span></div>
                  <div className={`mt-1 text-[9px] font-semibold ${scenario.status === 'within target' ? 'text-primary' : scenario.status === 'above target' ? 'text-accent' : 'text-destructive'}`}>
                    {scenario.status}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
              <Info size={13} className="mt-0.5 shrink-0 text-primary" />
              This is a sensitivity view, not a confidence interval. It does not account for filter downtime, adsorption, or changing patient physiology.
            </p>
          </section>

          <div className="fade-up fade-up-3 mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <section className="section-card rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="eyebrow">Read the curve</div>
                  <h2 className="mt-1 text-[14px] font-bold tracking-tight text-foreground">Selected checkpoints</h2>
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
                  <h2 className="mt-1 text-[14px] font-bold tracking-tight text-foreground">Assumptions & disclaimer</h2>
                </div>
                <ChevronDown size={17} className={`mt-1 text-muted-foreground transition-transform ${showAssumptions ? 'rotate-180' : ''}`} />
              </button>
              {showAssumptions ? (
                <div className="mt-4 space-y-3">
                  <div className="assumption-row"><ShieldCheck size={14} /><span>First-order elimination assumes stable prescription, drug distribution, and serum creatinine across 72 hours.</span></div>
                   <div className="assumption-row"><Info size={14} /><span>Endogenous clearance is entered directly in mL/min; no renal-function equation is inferred from demographics.</span></div>
                   <div className="assumption-row"><Droplets size={14} /><span>{form.modality} clearance uses the unbound fraction × delivered effluent: {form.modality === 'CVVH' ? 'replacement fluid + net ultrafiltration' : 'dialysate + net ultrafiltration'}. Filter uptime scales prescribed flow to delivered flow.</span></div>
                   <div className="assumption-row"><Activity size={14} /><span>For CVVH pre-filter replacement, dilution is calculated as Qb / (Qb + Qpre) from the entered blood flow and replacement-fluid rate; post-filter replacement has no dilution adjustment.</span></div>
                   <div className="assumption-row"><FlaskConical size={14} /><span>Sieving and saturation are approximated as 1 − protein binding; membrane type, hematocrit, access recirculation, adsorption, and changing filter performance remain uncertain.</span></div>
                   <div className="assumption-row"><Info size={14} /><span>Filter uptime is a daily average. The model does not represent the timing of interruptions, changing patient physiology, or concentration changes during filter downtime.</span></div>
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
             <span className="mono">CRRT / PK · custom profiles stay on this device</span>
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