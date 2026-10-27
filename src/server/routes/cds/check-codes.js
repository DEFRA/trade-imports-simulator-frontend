// What real CDS clearance requests carried, November 2024 to June 2025: 446,360 requests, 1.16M
// items. CDS raises an item's checks from the tariff and the trader declares its documents, so the
// simulator, standing in for CDS, sends both. Counts are of items across every version sent.

// Each check code belongs to one department. BTMS acts on H218 to H224; the rest it has no mapping for.
export const checkCodes = [
  { code: 'H218', department: 'HMI' },
  { code: 'H219', department: 'PHSI' },
  { code: 'H220', department: 'HMI' },
  { code: 'H221', department: 'AHVLA' },
  { code: 'H222', department: 'PHA' },
  { code: 'H223', department: 'PHA' },
  { code: 'H224', department: 'PHA' },
  { code: 'H230', department: 'HMI' },
  { code: 'H231', department: 'HMI' },
  { code: 'H232', department: 'PHSI' },
  { code: 'H233', department: 'AHVLA' },
  { code: 'H234', department: 'PHA' },
  { code: 'H235', department: 'PHA' },
  { code: 'H236', department: 'PHA' }
]

// An item's checks and its documents' codes as they came together, commonest first, down to those
// seen 30 times. H220 alone, with no document, is real: an HMI check with nothing to match.
export const combinations = [
  { checks: ['H222'], documents: ['N853'] },
  { checks: ['H219'], documents: ['N851'] },
  { checks: ['H218', 'H219'], documents: ['N002', 'N851'] },
  { checks: ['H223'], documents: ['C678'] },
  { checks: ['H222', 'H224'], documents: ['C673', 'N853'] },
  { checks: ['H218'], documents: ['N002'] },
  { checks: ['H221'], documents: ['C640'] },
  { checks: ['H234'], documents: ['N853'] },
  { checks: ['H219', 'H223'], documents: ['C678', 'N851'] },
  { checks: ['H218', 'H223'], documents: ['C678', 'N002'] },
  {
    checks: ['H218', 'H219', 'H223'],
    documents: ['C678', 'N002', 'N851']
  },
  { checks: ['H220'], documents: [] },
  { checks: ['H219', 'H220'], documents: ['N851'] },
  { checks: ['H219'], documents: ['9115', 'C085', 'N851'] },
  { checks: ['H233'], documents: ['C640'] },
  { checks: ['H232'], documents: ['9115'] },
  { checks: ['H222', 'H234'], documents: ['N853'] },
  { checks: ['H224'], documents: ['C673'] },
  { checks: ['H222', 'H223'], documents: ['C678', 'N853'] },
  { checks: ['H219', 'H222'], documents: ['N851', 'N853'] },
  { checks: ['H219'], documents: ['C085', 'N851'] },
  { checks: ['H232'], documents: ['N851'] }
]

// Document statuses, commonest first. AE, JE and AG cover 98% of documents.
export const documentStatuses = [
  'AE',
  'JE',
  'AG',
  'AC',
  'JA',
  'IE',
  'St',
  'LE',
  'LP',
  'JP',
  'AP',
  'GE',
  'IP',
  'AF',
  'ES',
  'AS',
  'EP',
  'UE',
  'GP',
  'EE'
]

// Control is P, except S, which only came with status St.
export const documentControls = ['P', 'S']
