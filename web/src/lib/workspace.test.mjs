import {test} from 'node:test';
import assert from 'node:assert/strict';
const {addItem, completeTask, filterItems} = await import('./workspace.mjs').catch(()=>({addItem:()=>[],completeTask:x=>x,filterItems:x=>x}));
test('adds a trimmed project and rejects blank titles',()=>{assert.deepEqual(addItem([], {id:'1',name:'  Migration  '}),[{id:'1',name:'Migration'}]); assert.throws(()=>addItem([],{name:' '}));});
test('completes only the selected task without mutating other tasks',()=>{const rows=[{id:'a',status:'In progress'},{id:'b',status:'To do'}]; assert.deepEqual(completeTask(rows,'a'),[{id:'a',status:'Done'},{id:'b',status:'To do'}]);assert.equal(rows[0].status,'In progress');});
test('search and status filters combine and ignore case',()=>{assert.deepEqual(filterItems([{name:'Cloud',status:'Done'},{name:'Cloud setup',status:'To do'}],' CLOUD ','To do'),[{name:'Cloud setup',status:'To do'}]);});
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

