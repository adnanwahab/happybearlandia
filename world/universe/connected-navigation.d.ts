import type { CanonicalId, NavigationContext } from '../../shared/causality/contracts';
export function mountUniverseNavigation(container: HTMLElement, options?: {
 experienceId?: string; onContext?: (context:NavigationContext)=>void;
}): Readonly<{
 getContext():NavigationContext;
 select(entityId:CanonicalId):void;
 navigate(experienceId:string):void;
 dispose():void;
}>;
