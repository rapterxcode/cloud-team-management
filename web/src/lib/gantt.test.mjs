import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,validateDates,addDays,daysDiff,calculateDragDates,shiftPhaseTasks,normalizePhase,reorderPhases,reorderTasks,moveTaskToPhaseWithTimeline} from './gantt.mjs';
test('positions inclusive task ranges on one shared calendar across months',()=>{const s=schedule([{id:'a',start:'2026-08-30',date:'2026-09-02'},{id:'b',start:'2026-09-02',date:'2026-09-02'}]);assert.equal(s.start,'2026-08-30');assert.equal(s.days,4);assert.deepEqual(s.bars,[{id:'a',offset:0,duration:4},{id:'b',offset:3,duration:1}]);});
test('unscheduled tasks have no bars and empty project has a usable calendar',()=>{assert.deepEqual(schedule([{id:'a',date:''}]).bars,[]);assert.ok(schedule([]).days>=7);});
test('rejects reversed dates and nonexistent dates, allows unscheduled work',()=>{assert.throws(()=>validateDates('2026-09-10','2026-09-09'));assert.throws(()=>validateDates('2026-02-30','2026-03-02'));assert.throws(()=>validateDates('2026-09-01',''));assert.equal(validateDates('',''),true);assert.equal(validateDates('2028-02-28','2028-03-01'),true);});
test('addDays and daysDiff handle calendar arithmetic correctly',()=>{
  assert.equal(addDays('2026-08-30',3),'2026-09-02');
  assert.equal(addDays('2026-09-02',-3),'2026-08-30');
  assert.equal(daysDiff('2026-08-30','2026-09-02'),3);
  assert.equal(daysDiff('2026-09-02','2026-08-30'),-3);
});
test('calculateDragDates moves entire task preserving duration',()=>{
  const res=calculateDragDates('2026-09-01','2026-09-05','move',3);
  assert.deepEqual(res,{start:'2026-09-04',date:'2026-09-08',changed:true});
  const noChange=calculateDragDates('2026-09-01','2026-09-05','move',0);
  assert.equal(noChange.changed,false);
});
test('calculateDragDates resizes start and finish dates with boundary protection',()=>{
  // Resize start forward (shrinking duration)
  const r1=calculateDragDates('2026-09-01','2026-09-05','resize-start',2);
  assert.deepEqual(r1,{start:'2026-09-03',date:'2026-09-05',changed:true});
  // Resize start past end (capped at end date)
  const r2=calculateDragDates('2026-09-01','2026-09-05','resize-start',10);
  assert.deepEqual(r2,{start:'2026-09-05',date:'2026-09-05',changed:true});
  // Resize end forward (expanding duration)
  const r3=calculateDragDates('2026-09-01','2026-09-05','resize-end',3);
  assert.deepEqual(r3,{start:'2026-09-01',date:'2026-09-08',changed:true});
  // Resize end backward past start (capped at start date)
  const r4=calculateDragDates('2026-09-01','2026-09-05','resize-end',-10);
  assert.deepEqual(r4,{start:'2026-09-01',date:'2026-09-01',changed:true});
});
test('shiftPhaseTasks shifts all task dates within a phase by deltaDays',()=>{
  const tasks=[
    {id:'t1',start:'2026-09-01',date:'2026-09-05'},
    {id:'t2',start:'2026-09-06',date:'2026-09-10'},
    {id:'t3',date:''}
  ];
  const shifted=shiftPhaseTasks(tasks,3);
  assert.deepEqual(shifted,[
    {id:'t1',start:'2026-09-04',date:'2026-09-08'},
    {id:'t2',start:'2026-09-09',date:'2026-09-13'}
  ]);
});
test('normalizePhase trims strings and defaults to Planning',()=>{
  assert.equal(normalizePhase(''),'Planning');
  assert.equal(normalizePhase('   '),'Planning');
  assert.equal(normalizePhase(undefined),'Planning');
  assert.equal(normalizePhase(' Development '),'Development');
  assert.equal(normalizePhase('Testing'),'Testing');
});
test('reorderPhases reorders array items cleanly',()=>{
  const phases=['Planning','Development','Testing','Launch'];
  assert.deepEqual(reorderPhases(phases,'Testing','Development'),['Planning','Testing','Development','Launch']);
  assert.deepEqual(reorderPhases(phases,'Launch','Planning'),['Launch','Planning','Development','Testing']);
  assert.deepEqual(reorderPhases(phases,'Same','Same'),phases);
});
test('moveTaskToPhaseWithTimeline aligns timeline when moving task to another phase',()=>{
  const allTasks=[
    {id:'t1',phase:'Planning',start:'2026-09-01',date:'2026-09-05'},
    {id:'t2',phase:'Development',start:'2026-09-15',date:'2026-09-25'}
  ];
  // Moving t1 (Planning, Sept 1-5, 5 days) to Development (starts Sept 15, delta +14 days)
  const moved=moveTaskToPhaseWithTimeline(allTasks[0],'Development',allTasks);
  assert.equal(moved.phase,'Development');
  assert.equal(moved.start,'2026-09-15');
  assert.equal(moved.date,'2026-09-19');

  // Moving task without dates keeps it unscheduled
  const unscheduled={id:'t3',phase:'Planning',date:''};
  const movedUnscheduled=moveTaskToPhaseWithTimeline(unscheduled,'Testing',allTasks);
  assert.deepEqual(movedUnscheduled,{phase:'Testing'});

  // Moving task to an empty phase keeps its existing dates
  const movedToEmpty=moveTaskToPhaseWithTimeline(allTasks[0],'Launch',allTasks);
  assert.equal(movedToEmpty.phase,'Launch');
  assert.equal(movedToEmpty.start,'2026-09-01');
  assert.equal(movedToEmpty.date,'2026-09-05');
});
test('reorderTasks reorders string array or object array with before/after positioning',()=>{
  // String array
  const ids=['t1','t2','t3','t4'];
  assert.deepEqual(reorderTasks(ids,'t3','t1','before'),['t3','t1','t2','t4']);
  assert.deepEqual(reorderTasks(ids,'t1','t3','after'),['t2','t3','t1','t4']);
  assert.deepEqual(reorderTasks(ids,'t2','t2','before'),ids);

  // Object array
  const objs=[{id:'t1',name:'One'},{id:'t2',name:'Two'},{id:'t3',name:'Three'}];
  const reordered=reorderTasks(objs,'t3','t2','before');
  assert.deepEqual(reordered.map(x=>x.id),['t1','t3','t2']);

  const reorderedAfter=reorderTasks(objs,'t1','t2','after');
  assert.deepEqual(reorderedAfter.map(x=>x.id),['t2','t1','t3']);
});
