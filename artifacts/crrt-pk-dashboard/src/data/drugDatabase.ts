export interface DrugSource {
  label: string;
  url: string;
}

export interface TargetRange {
  low: number;
  high: number;
}

export interface DrugReference {
  id: string;
  name: string;
  className: string;
  commonUse: string;
  vdLPerKg: number;
  proteinBindingPercent: number;
  molecularWeightDa: number;
  defaultDoseMg: number;
  defaultIntervalHours: number;
  renalHandling: string;
  targetRange: TargetRange;
  targetType: string;
  targetSource: DrugSource;
  sources: DrugSource[];
}

const dailymedSearch = (drug: string) =>
  `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(drug)}`;

const crrtReview =
  'https://pubmed.ncbi.nlm.nih.gov/33733979/';
const ucsfCrrtGuidance =
  'https://idmp.ucsf.edu/antimicrobial-dosing-intermittent-continuous-hemodialysis';
const vancomycinConsensusGuideline =
  'https://pubmed.ncbi.nlm.nih.gov/32658968/';

/**
 * Representative adult PK values for exploration, not patient-specific dosing.
 * Values are deliberately stored with sources so a clinician can inspect the
 * underlying prescribing information and CRRT review before using the model.
 */
export const ICU_DRUG_DATABASE: DrugReference[] = [
  {
    id: 'vancomycin',
    name: 'Vancomycin',
    className: 'Glycopeptide antibiotic',
    commonUse: 'Serious Gram-positive infections',
    vdLPerKg: 0.7,
    proteinBindingPercent: 50,
    molecularWeightDa: 1449,
    defaultDoseMg: 1250,
    defaultIntervalHours: 12,
    renalHandling: 'Predominantly renal elimination; clearance changes substantially with kidney function and CRRT intensity.',
    targetRange: { low: 15, high: 20 },
    targetType: 'trough concentration for serious infections',
    targetSource: {
      label: '2020 vancomycin consensus guideline',
      url: vancomycinConsensusGuideline,
    },
    sources: [
      { label: 'DailyMed prescribing information', url: dailymedSearch('vancomycin injection') },
      { label: 'Vancomycin PK by renal function (PubMed)', url: 'https://pubmed.ncbi.nlm.nih.gov/3415206/' },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'cefepime',
    name: 'Cefepime',
    className: 'Fourth-generation cephalosporin',
    commonUse: 'Severe Gram-negative and Pseudomonas infections',
    vdLPerKg: 0.25,
    proteinBindingPercent: 20,
    molecularWeightDa: 480.6,
    defaultDoseMg: 2000,
    defaultIntervalHours: 8,
    renalHandling: 'About 85% is excreted unchanged in urine; dose exposure is strongly affected by creatinine clearance.',
    targetRange: { low: 5, high: 10 },
    targetType: 'trough concentration reference',
    targetSource: { label: 'FDA cefepime label', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/050817s012lbl.pdf' },
    sources: [
      { label: 'FDA cefepime label', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/050817s012lbl.pdf' },
      { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'meropenem',
    name: 'Meropenem',
    className: 'Carbapenem antibiotic',
    commonUse: 'Severe polymicrobial and resistant infections',
    vdLPerKg: 0.3,
    proteinBindingPercent: 2,
    molecularWeightDa: 383.5,
    defaultDoseMg: 1000,
    defaultIntervalHours: 8,
    renalHandling: 'Mostly excreted unchanged by the kidneys; reduced creatinine clearance increases exposure.',
    targetRange: { low: 2, high: 8 },
    targetType: 'trough concentration reference',
    targetSource: { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
    sources: [
      { label: 'DailyMed prescribing information', url: dailymedSearch('meropenem injection') },
      { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'piperacillin-tazobactam',
    name: 'Piperacillin / tazobactam',
    className: 'Extended-spectrum beta-lactam',
    commonUse: 'Broad-spectrum empiric ICU coverage',
    vdLPerKg: 0.24,
    proteinBindingPercent: 30,
    molecularWeightDa: 517.5,
    defaultDoseMg: 3375,
    defaultIntervalHours: 6,
    renalHandling: 'Piperacillin is primarily renally eliminated; creatinine clearance and CRRT can materially alter exposure.',
    targetRange: { low: 50, high: 100 },
    targetType: 'trough concentration reference',
    targetSource: { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
    sources: [
      { label: 'DailyMed prescribing information', url: dailymedSearch('piperacillin tazobactam injection') },
      { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'levetiracetam',
    name: 'Levetiracetam',
    className: 'Antiseizure medication',
    commonUse: 'Seizure treatment and prophylaxis',
    vdLPerKg: 0.65,
    proteinBindingPercent: 10,
    molecularWeightDa: 170.2,
    defaultDoseMg: 1000,
    defaultIntervalHours: 12,
    renalHandling: 'Approximately two-thirds of the dose is excreted unchanged in urine; creatinine clearance is a key exposure driver.',
    targetRange: { low: 12, high: 46 },
    targetType: 'trough concentration reference',
    targetSource: {
      label: 'DailyMed therapeutic range reference',
      url: dailymedSearch('levetiracetam injection'),
    },
    sources: [
      { label: 'FDA levetiracetam label', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/202543s024lbl.pdf' },
      { label: 'DailyMed prescribing information', url: dailymedSearch('levetiracetam injection') },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'fluconazole',
    name: 'Fluconazole',
    className: 'Triazole antifungal',
    commonUse: 'Susceptible invasive Candida infections',
    vdLPerKg: 0.7,
    proteinBindingPercent: 11,
    molecularWeightDa: 306.3,
    defaultDoseMg: 400,
    defaultIntervalHours: 24,
    renalHandling: 'Primarily eliminated unchanged in urine; renal impairment and CRRT can change systemic exposure.',
    targetRange: { low: 8, high: 16 },
    targetType: 'trough concentration reference',
    targetSource: {
      label: 'DailyMed therapeutic range reference',
      url: dailymedSearch('fluconazole injection'),
    },
    sources: [
      { label: 'DailyMed prescribing information', url: dailymedSearch('fluconazole injection') },
      { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
  {
    id: 'acyclovir',
    name: 'Acyclovir',
    className: 'Antiviral',
    commonUse: 'Severe HSV and VZV infections',
    vdLPerKg: 0.6,
    proteinBindingPercent: 15,
    molecularWeightDa: 225.2,
    defaultDoseMg: 500,
    defaultIntervalHours: 8,
    renalHandling: 'Renally cleared with dose adjustment required as creatinine clearance falls; neurotoxicity risk makes exposure important.',
    targetRange: { low: 2, high: 10 },
    targetType: 'exploratory reference concentration',
    targetSource: {
      label: 'DailyMed prescribing information',
      url: dailymedSearch('acyclovir injection'),
    },
    sources: [
      { label: 'DailyMed prescribing information', url: dailymedSearch('acyclovir injection') },
      { label: 'UCSF antimicrobial dosing guidance', url: ucsfCrrtGuidance },
      { label: 'CRRT antimicrobial PK review', url: crrtReview },
    ],
  },
];

export const DEFAULT_DRUG = ICU_DRUG_DATABASE[0];

export function findDrug(id: string): DrugReference {
  return ICU_DRUG_DATABASE.find((drug) => drug.id === id) ?? DEFAULT_DRUG;
}