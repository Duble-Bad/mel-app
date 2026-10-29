export class UnsafeTargetError extends Error {}
export type Target = { kind: "local"; host: string } | { kind: "cloud"; ref: string } | { kind: "unknown"; host: string } | { kind: "invalid" };
export function describeTarget(url: unknown): Target;
export function assertSafeTarget(url: unknown, purpose: string, env?: Record<string, string | undefined>): Target;
export function assertAdminTarget(url: unknown, purpose: string, argv?: string[], env?: Record<string, string | undefined>): Target;
export function assertLinkedRefSafe(purpose: string, root?: string, env?: Record<string, string | undefined>): Target;
