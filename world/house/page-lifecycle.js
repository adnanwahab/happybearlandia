/** Hiding a document is not permission to erase its visible household. Chrome
 * can retain or reactivate it even when pagehide.persisted was initially false.
 * The browser reclaims resources when a document is actually discarded. */
export function bindHousePageLifecycle(win,{pause=()=>{},resume=()=>{},isPaused=()=>true,refresh=()=>{},save=()=>{},destroy=()=>{},onError=()=>{}}={}){
 let disposed=false,hidden=false,resumeOnReturn=false;
 const safely=fn=>Promise.resolve().then(fn).catch(onError);
 function hide(){if(disposed)return;if(!hidden){resumeOnReturn=!isPaused();hidden=true;pause();}void safely(save);}
 function show(){if(disposed||!hidden)return;hidden=false;void safely(async()=>{await refresh();if(disposed||hidden)return;if(resumeOnReturn)resume();resumeOnReturn=false;});}
 function dispose(){if(disposed)return;disposed=true;win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',show);destroy();}
 win.addEventListener('pagehide',hide);win.addEventListener('pageshow',show);return dispose;
}
