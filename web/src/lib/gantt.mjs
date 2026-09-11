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
 const dated=[];
 for(const t of tasks){
  if(!t.date)continue;
  const start=t.start||t.date;
  try{
   validateDates(start,t.date);
   dated.push({id:t.id,start:day(start),end:day(t.date)});
  }catch{}
 }
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
export function shiftPhaseTasks(phaseTasks,deltaDays){
  return phaseTasks.filter(t=>t.date||t.start).map(t=>{
    const s=(t.start||t.date).slice(0,10);
    const d=(t.date||t.start).slice(0,10);
    return {id:t.id,start:addDays(s,deltaDays),date:addDays(d,deltaDays)};
  });
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

export function normalizePhase(phase){
  return (phase && typeof phase === 'string' && phase.trim()) ? phase.trim() : 'Planning';
}

export function reorderPhases(phaseList, sourcePhase, targetPhase){
  if(!phaseList || sourcePhase === targetPhase) return phaseList ? [...phaseList] : [];
  const list = [...phaseList];
  const fromIdx = list.indexOf(sourcePhase);
  const toIdx = list.indexOf(targetPhase);
  if(fromIdx < 0 || toIdx < 0) return list;
  list.splice(fromIdx, 1);
  list.splice(toIdx, 0, sourcePhase);
  return list;
}

export function reorderTasks(tasks, sourceTaskId, targetTaskId, position = 'after'){
  if(!tasks || !sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId){
    return tasks ? [...tasks] : [];
  }
  const isStringArray = typeof tasks[0] === 'string';
  const ids = isStringArray ? [...tasks] : tasks.map(t => t.id);

  const fromIdx = ids.indexOf(sourceTaskId);
  if(fromIdx < 0) return tasks ? [...tasks] : [];

  ids.splice(fromIdx, 1);
  const toIdx = ids.indexOf(targetTaskId);
  if(toIdx < 0) return tasks ? [...tasks] : [];

  const insertIdx = position === 'before' ? toIdx : toIdx + 1;
  ids.splice(insertIdx, 0, sourceTaskId);

  if(isStringArray){
    return ids;
  }

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  return ids.map(id => taskMap.get(id)).filter(Boolean);
}

export function moveTaskToPhaseWithTimeline(task, targetPhase, allTasks = []){
  const normTarget = normalizePhase(targetPhase);
  const currentPhase = normalizePhase(task.phase);
  const result = { phase: normTarget };

  if(!task.date && !task.start){
    return result;
  }

  const taskStart = (task.start || task.date).slice(0, 10);
  const taskDate = (task.date || task.start).slice(0, 10);
  const taskDuration = Math.max(1, daysDiff(taskStart, taskDate) + 1);

  const currentPhaseTasks = allTasks.filter(t => normalizePhase(t.phase) === currentPhase && (t.date || t.start));
  const targetPhaseTasks = allTasks.filter(t => normalizePhase(t.phase) === normTarget && (t.date || t.start) && t.id !== task.id);

  if(targetPhaseTasks.length > 0){
    if(currentPhaseTasks.length > 0){
      const currentMinStart = currentPhaseTasks.map(t => (t.start || t.date).slice(0, 10)).sort()[0];
      const targetMinStart = targetPhaseTasks.map(t => (t.start || t.date).slice(0, 10)).sort()[0];
      const delta = daysDiff(currentMinStart, targetMinStart);
      result.start = addDays(taskStart, delta);
      result.date = addDays(taskDate, delta);
    } else {
      const targetMaxDate = targetPhaseTasks.map(t => (t.date || t.start).slice(0, 10)).sort().reverse()[0];
      const newStart = addDays(targetMaxDate, 1);
      result.start = newStart;
      result.date = addDays(newStart, taskDuration - 1);
    }
  } else {
    result.start = taskStart;
    result.date = taskDate;
  }

  return result;
}
