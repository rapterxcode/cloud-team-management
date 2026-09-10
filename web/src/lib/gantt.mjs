const DAY=86400000;
export function day(value){
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
export function toDateString(dayNumber){
  return new Date(dayNumber*DAY).toISOString().slice(0,10);
}
export function addDays(dateStr,numDays){
  const currentDay=day(dateStr);
  return toDateString(currentDay+numDays);
}
export function daysDiff(startStr,endStr){
  return Math.round(day(endStr)-day(startStr));
}
export function calculateDragDates(initialStartStr,initialEndStr,mode,deltaDays){
  const cleanStart=(initialStartStr||initialEndStr||'').slice(0,10);
  const cleanEnd=(initialEndStr||initialStartStr||'').slice(0,10);
  const startDay=day(cleanStart);
  const endDay=day(cleanEnd);
  if(mode==='move'){
    const newStartDay=startDay+deltaDays;
    const newEndDay=endDay+deltaDays;
    const newStart=toDateString(newStartDay);
    const newEnd=toDateString(newEndDay);
    return {start:newStart,date:newEnd,changed:newStart!==cleanStart||newEnd!==cleanEnd};
  }
  if(mode==='resize-start'){
    const newStartDay=Math.min(startDay+deltaDays,endDay);
    const newStart=toDateString(newStartDay);
    return {start:newStart,date:cleanEnd,changed:newStart!==cleanStart};
  }
  if(mode==='resize-end'){
    const newEndDay=Math.max(endDay+deltaDays,startDay);
    const newEnd=toDateString(newEndDay);
    return {start:cleanStart,date:newEnd,changed:newEnd!==cleanEnd};
  }
  return {start:cleanStart,date:cleanEnd,changed:false};
}
