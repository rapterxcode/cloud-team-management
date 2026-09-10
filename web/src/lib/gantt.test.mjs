import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,validateDates,addDays,daysDiff,calculateDragDates} from './gantt.mjs';
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
