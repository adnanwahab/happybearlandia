import type { NavigationContext, IframeMessage } from '../../shared/causality/contracts';
export const DEFAULT_CONTEXT: Readonly<NavigationContext>;
export function contextFromURL(input: string | URL): NavigationContext;
export function contextURL(route: string | URL, context: NavigationContext): string;
export function shellURL(experienceId: string | null | undefined, context: NavigationContext): string;
export function navigationMessage(type: 'ready' | 'context' | 'select' | 'navigate' | 'error', context: NavigationContext, extra?: Record<string,unknown>): IframeMessage;
export function createFrameBridge(options: {
 frame: HTMLIFrameElement; context: () => NavigationContext;
 onContext: (context: NavigationContext) => void;
 onNavigate: (experienceId: string) => void; host?: Window;
}): () => void;
