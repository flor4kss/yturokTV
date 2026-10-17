let constrained=true;
const subscribers=new Set();
export const getNetworkBudget=()=>constrained;
export const subscribeNetworkBudget=listener=>{subscribers.add(listener);return ()=>subscribers.delete(listener);};
export function setNetworkBudget(value){if(constrained!==value){constrained=value;subscribers.forEach(listener=>listener());}}
