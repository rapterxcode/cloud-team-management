const DAY=86400000;
function day(value){
 if(!/^\d{4}-\d{2}-\d{2}/.test(value))throw new Error('Enter a valid date.');
 const datePart=value.slice(0,10);
 const time=Date.parse(datePart+'T00:00:00Z');
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==datePart)throw new Error('Enter a valid date.');
 return time/DAY;
}
export function validateDates(start,end){
 if(!start&&!end)return true;
 if(!start||!end)throw new Error('Enter both a start and finish date, or leave both empty.');
 if(day(end)<day(start))throw new Error('Finish must be on or after start.');
 return true;
}
export function schedule(tasks){
 const dated=tasks.filter(t=>t.date).map(t=>{const start=t.start||t.date;validateDates(start,t.date);return {id:t.id,start:day(start),end:day(t.date)};});
 if(!dated.length)return {start:'2026-09-01',days:14,bars:[]};
 const first=Math.min(...dated.map(t=>t.start)),last=Math.max(...dated.map(t=>t.end));
 return {start:new Date(first*DAY).toISOString().slice(0,10),days:last-first+1,bars:dated.map(t=>({id:t.id,offset:t.start-first,duration:t.end-t.start+1}))};
}
