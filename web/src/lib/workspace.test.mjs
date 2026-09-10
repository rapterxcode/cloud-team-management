import {test} from 'node:test';
import assert from 'node:assert/strict';
const {addItem, completeTask, filterItems} = await import('./workspace.mjs').catch(()=>({addItem:()=>[],completeTask:x=>x,filterItems:x=>x}));
test('adds a trimmed project and rejects blank titles',()=>{assert.deepEqual(addItem([], {id:'1',name:'  Migration  '}),[{id:'1',name:'Migration'}]); assert.throws(()=>addItem([],{name:' '}));});
test('completes only the selected task without mutating other tasks',()=>{const rows=[{id:'a',status:'In progress'},{id:'b',status:'To do'}]; assert.deepEqual(completeTask(rows,'a'),[{id:'a',status:'Done'},{id:'b',status:'To do'}]);assert.equal(rows[0].status,'In progress');});
test('search and status filters combine and ignore case',()=>{assert.deepEqual(filterItems([{name:'Cloud',status:'Done'},{name:'Cloud setup',status:'To do'}],' CLOUD ','To do'),[{name:'Cloud setup',status:'To do'}]);});
test('filterItems supports New, Completed, and Active statuses with year partitioning', () => {
  const sample = [
    { name: 'Legacy Modernization', status: 'Completed', year: 2025 },
    { name: 'Cloud Core Banking', status: 'On track', year: 2026 },
    { name: 'Observability Stack', status: 'At risk', year: 2026 },
    { name: 'AI Fraud Prevention', status: 'New', year: 2027 },
  ];
  // Filter by specific status
  assert.deepEqual(filterItems(sample, '', 'Completed'), [sample[0]]);
  assert.deepEqual(filterItems(sample, '', 'New'), [sample[3]]);
  // Filter by Active status (excludes Completed)
  assert.deepEqual(filterItems(sample, '', 'Active'), [sample[1], sample[2], sample[3]]);
  // Filter by year
  assert.deepEqual(filterItems(sample, '', 'All', '2025'), [sample[0]]);
  assert.deepEqual(filterItems(sample, '', 'All', 2026), [sample[1], sample[2]]);
  assert.deepEqual(filterItems(sample, '', 'All', '2027'), [sample[3]]);
  // Combined filter: query + Active + year 2026
  assert.deepEqual(filterItems(sample, 'banking', 'Active', '2026'), [sample[1]]);
  // Combined filter: empty match
  assert.deepEqual(filterItems(sample, 'banking', 'Completed', '2026'), []);
});
test('project workspace only shows tasks belonging to the selected project',async()=>{const {projectTasks}=await import('./workspace.mjs');assert.deepEqual(projectTasks([{id:'1',projectId:'a'},{id:'2',projectId:'b'}],'a'),[{id:'1',projectId:'a'}]);});
test('updates the chosen record while preserving its other fields',async()=>{const {updateItem}=await import('./workspace.mjs');assert.deepEqual(updateItem([{id:'a',name:'Guide',body:'Old',category:'Runbook'}],'a',{body:'New'}),[{id:'a',name:'Guide',body:'New',category:'Runbook'}]);});
test('timeline orders dated tasks first and keeps unplanned tasks last',async()=>{const {timelineTasks}=await import('./workspace.mjs');assert.deepEqual(timelineTasks([{id:'a',date:''},{id:'b',date:'2026-09-12'},{id:'c',date:'2026-09-08'}]).map(t=>t.id),['c','b','a']);});
test('computeWorkload derives capacity from active tasks and caps at 100', async () => {
  const { computeWorkload } = await import('./workspace.mjs');
  assert.equal(computeWorkload([], 'u1'), 0);
  assert.equal(computeWorkload([{ ownerId: 'u1', status: 'To do' }, { ownerId: 'u1', status: 'In progress' }], 'u1'), 40);
  assert.equal(computeWorkload([{ ownerId: 'u1', status: 'To do' }, { ownerId: 'u1', status: 'Done' }], 'u1'), 20);
  assert.equal(computeWorkload([{ ownerId: 'u2', status: 'To do' }], 'u1'), 0);
  const sixTasks = Array.from({ length: 6 }, () => ({ ownerId: 'u1', status: 'To do' }));
  assert.equal(computeWorkload(sixTasks, 'u1'), 100);
});

