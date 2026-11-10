/** Stable v1 public contracts. Runtime schemas are exported from index.js. */
export type CanonicalId = string;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface UniverseContext { universeId: CanonicalId; worldId: CanonicalId; scenarioId: CanonicalId }
export interface RunContext extends UniverseContext { runId: CanonicalId; seed: number; modelVersion: string; tick: number; parentRunId?: CanonicalId }
export interface LocalIdMapping { namespace: string; kind: string; localId: string; canonicalId: CanonicalId }
export type Aggregation = 'sum' | 'mean' | 'min' | 'max' | 'last' | 'count';
export interface MetricDefinition { id: CanonicalId; label: string; unit: string; aggregation: Aggregation; description?: string }
export interface Provenance { id: CanonicalId; kind: 'observed' | 'simulated' | 'assumed' | 'derived'; source: string; modelVersion: string; sourceIds: CanonicalId[] }
export interface CausalEvent { id: CanonicalId; context: RunContext; sequence: number; type: string; entityIds: CanonicalId[]; payload: Json; provenance: Provenance }
export interface Observation { id: CanonicalId; context: RunContext; sequence: number; entityId: CanonicalId; metricId: CanonicalId; value: number; unit: string; provenance: Provenance }
export interface Assumption { id: CanonicalId; context: RunContext; sequence: number; label: string; value: Json; rationale: string; provenance: Provenance }
export interface CausalEdge { id: CanonicalId; context: RunContext; fromId: CanonicalId; toId: CanonicalId; relation: 'causes' | 'contributes' | 'constrains' | 'correlates'; confidence: number; evidenceIds: CanonicalId[]; provenance: Provenance }
export interface Intervention { id: CanonicalId; context: RunContext; action: string; targetId: CanonicalId; parameters: Record<string, Json> }
export type ParameterRule = { type: 'number'; min: number; max: number } | { type: 'boolean' } | { type: 'string'; values: string[] };
export interface InterventionRule { action: string; targetKinds: string[]; parameters: Record<string, ParameterRule> }
export interface CausalSnapshot { context: RunContext; events: CausalEvent[]; observations: Observation[]; assumptions: Assumption[]; edges: CausalEdge[] }
export interface CausalAdapter { readonly experienceId: string; getContext(): RunContext; snapshot(): CausalSnapshot | Promise<CausalSnapshot>; interventions(): readonly InterventionRule[]; intervene(request: Intervention): Promise<RunContext> }
export interface ReplayAdapter { readonly experienceId: string; load(context: RunContext): Promise<void>; seek(tick: number): Promise<CausalSnapshot>; play(): void; pause(): void; dispose(): void }
export type IframeMessage = { version: 1; channel: 'hbl:causality'; requestId: string; context: RunContext | NavigationContext } & (
 { type: 'ready' } | { type: 'context' } | { type: 'select'; entityId: CanonicalId } | { type: 'navigate'; experienceId: string; entityId?: CanonicalId } | { type: 'snapshot'; snapshot: CausalSnapshot } | { type: 'intervene'; intervention: Intervention } | { type: 'error'; code: string; message: string });
export interface Schema<T> { parse(input: unknown): T; safeParse(input: unknown): { success: true; data: T } | { success: false; error: Error } }

export interface Checkpoint { id: CanonicalId; context: RunContext; sequence: number; state: Json; hash: string; replayMode: 'recorded' | 'verified' }

export interface NavigationContext extends UniverseContext { experimentId?: CanonicalId; runId?: CanonicalId; branchId?: CanonicalId; tick?: number; entityId?: CanonicalId }
export interface DomainReplayEvent { id: CanonicalId; context: RunContext; tick: number; sequence: number; domain: string; modelVersion: string; adapterVersion: string; replayKind: 'input' | 'transition' | 'narrative' | 'render' | 'wall-clock'; type: string; payload: Json }
export interface DomainReplayAdapter<State = Json> {
 readonly domain: string; readonly modelVersion: string; readonly adapterVersion: string;
 serialize(state: State): Json | Promise<Json>;
 restore(state: Json): State | Promise<State>;
 applyEvent(state: State, event: DomainReplayEvent): State | Promise<State>;
 recompute?(state: State, inputs: readonly DomainReplayEvent[], options: {fromTick: number; targetTick: number; context: RunContext}): State | Promise<State>;
 advance?(state: State, options: {fromTick: number; targetTick: number}): State | Promise<State>;
 getTick?(state: State): number;
}
