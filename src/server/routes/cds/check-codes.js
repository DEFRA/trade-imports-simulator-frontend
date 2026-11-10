// What real CDS clearance requests carried, November 2024 to June 2025: 446,360 requests, 1.16M
// items. CDS raises an item's checks from the tariff and the trader declares its documents, so the
// simulator, standing in for CDS, sends both. Counts are of items across every version sent.

// Each check code belongs to one department. BTMS acts on H218 to H224; the rest it has no mapping for.
export const checkCodes = [
  { label: 'H218 - CHED-PP (HMI-SMS)', code: 'H218', department: 'HMI' },
  { label: 'H219 - CHED-PP (PHSI)', code: 'H219', department: 'PHSI' },
  { label: 'H220 - CHED-PP (HMI-GMS)', code: 'H220', department: 'HMI' },
  { label: 'H221 - CHED-A', code: 'H221', department: 'AHVLA' },
  { label: 'H222 - CHED-P', code: 'H222', department: 'PHA' },
  { label: 'H223 - CHED-D', code: 'H223', department: 'PHA' },
  { label: 'H224 - IUU', code: 'H224', department: 'PHA' }
]

// An item's checks and its documents' codes as they came together, showing
// the most sensible options in label order.
// H220 alone, with no document, is real: an HMI check with nothing to match.
export const combinations = [
  { label: 'CHED-A', checks: ['H221'], documents: ['C640'] },
  { label: 'CHED-D', checks: ['H223'], documents: ['C678'] },
  { label: 'CHED-P', checks: ['H222'], documents: ['N853'] },
  {
    label: 'CHED-P (With IUU)',
    checks: ['H222', 'H224'],
    documents: ['N853', 'C673']
  },
  { label: 'CHED-PP (PHSI Only)', checks: ['H219'], documents: ['C085'] },
  { label: 'CHED-PP (GMS 1% Check)', checks: ['H220'], documents: [] },
  { label: 'CHED-PP (HMI-SMS Only)', checks: ['H218'], documents: ['C085'] },
  {
    label: 'CHED-PP (PHSI & HMI-SMS)',
    checks: ['H219', 'H218'],
    documents: ['C085', 'C085']
  },
  {
    label: 'CHED-PP (PHSI & HMI-GMS)',
    checks: ['H219', 'H220'],
    documents: ['C085', 'C085']
  },
  {
    label: 'CHED-PP (PHSI & HMI-SMS & HMI-GMS)',
    checks: ['H219', 'H218', 'H220'],
    documents: ['C085', 'C085', 'C085']
  }
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
