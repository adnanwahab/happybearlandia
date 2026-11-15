import {mountChallengePanel} from './panel.js';
import {missionCheckpoint} from './checkpoints.js';
const container=document.querySelector('#mission-authoring'),checkpoint=document.querySelector('#mission-checkpoint'),status=document.querySelector('#mission-editor-status');
let panel;
function mount(){
 panel?.destroy();
 panel=mountChallengePanel(container,{editor:true,sharePath:'/world/challenges.html',getInitialState:()=>missionCheckpoint(checkpoint.value)});
 container.querySelector('.city-challenge').classList.add('mission-editor-inline');
 container.querySelector('.city-challenge').removeAttribute('role');
 container.querySelector('.challenge-open').hidden=true;
 container.querySelector('[data-challenge-close]').hidden=true;
 panel.open();
 status.textContent='Synthetic assumptions only. No upload or authenticated leaderboard. Export contains the complete synthetic checkpoint and versioned terms.';
}
checkpoint.addEventListener('change',()=>{
 // Explicitly discard old terms and comparisons before preparing a new checkpoint.
 history.replaceState(null,'',location.pathname+location.search);
 mount();
});
mount();
