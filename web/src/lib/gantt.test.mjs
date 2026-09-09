import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schedule,validateDates} from './gantt.mjs';
test('positions inclusive task ranges on one shared calendar across months',()=>{const s=schedule([{id:'a',start:'2026-08-30',date:'2026-09-02'},{id:'b',start:'2026-09-02',date:'2026-09-02'}]);assert.equal(s.start,'2026-08-30');assert.equal(s.days,4);assert.deepEqual(s.bars,[{id:'a',offset:0,duration:4},{id:'b',offset:3,duration:1}]);});
test('unscheduled tasks have no bars and empty project has a usable calendar',()=>{assert.deepEqual(schedule([{id:'a',date:''}]).bars,[]);assert.ok(schedule([]).days>=7);});
test('rejects reversed dates and nonexistent dates, allows unscheduled work',()=>{assert.throws(()=>validateDates('2026-09-10','2026-09-09'));assert.throws(()=>validateDates('2026-02-30','2026-03-02'));assert.throws(()=>validateDates('2026-09-01',''));assert.equal(validateDates('',''),true);assert.equal(validateDates('2028-02-28','2028-03-01'),true);});
