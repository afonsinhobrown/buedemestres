export type KycDraft = {
  frontUri: string | null
  backUri: string | null
  selfieUri: string | null
  docNumber: string
}

let draft: KycDraft = {
  frontUri: null,
  backUri: null,
  selfieUri: null,
  docNumber: '',
}

export function getKycDraft(): KycDraft {
  return draft
}

export function updateKycDraft(patch: Partial<KycDraft>) {
  draft = { ...draft, ...patch }
}

export function resetKycDraft() {
  draft = { frontUri: null, backUri: null, selfieUri: null, docNumber: '' }
}
