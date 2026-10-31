export interface ProposalRef {
  id: string;
}

export interface PackageItem {
  proposal: ProposalRef;
}

export interface PackageResult {
  items: PackageItem[];
}
