export interface RotationCounts {
  total: number;
  current: number;
  toReencrypt: number;
  reencrypted: number;
  conflicts: number;
  unreadable: number;
  key_unavailable: number;
  restored: number;
  marked: number;
  aborted: boolean;
}

export function rotatePartnerDocuments(opts: {
  service: unknown;
  ring: unknown;
  apply?: boolean;
  forceMark?: boolean;
  businessIds?: string[] | null;
  pageSize?: number;
}): Promise<RotationCounts>;
