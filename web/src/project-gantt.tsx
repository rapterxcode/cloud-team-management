import {useState,useEffect,Fragment} from 'react';
import {Plus,ChevronDown,ChevronRight,ZoomIn,ZoomOut,Maximize2,CalendarDays,Pencil} from 'lucide-react';
import {ScrollArea,ScrollBar} from '@/components/ui/scroll-area';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {schedule,validateDates,calculateDragDates,day} from '@/lib/gantt.mjs';
type Task={id:string;name:string;status:string;owner:string;ownerId?:string;date:string;start?:string;phase?:string;description?:string};
const defaultPhases=['Planning','Development','Launch'];
interface DragState{task:Task;mode:'move'|'resize-start'|'resize-end';startX:number;initialStart:string;initialDate:string;currentDeltaDays:number;hasMoved:boolean;}
export default function ProjectGantt({tasks,onAdd,onUpdate,onDelete,owners=[],onSelect,readOnly=false}:{tasks:Task[];onAdd:()=>void;onUpdate:(id:string,changes:Record<string,unknown>)=>void;onDelete?:(id:string)=>void;owners?:{id:string;name:string}[];onSelect?:(task:Task)=>void;readOnly?:boolean;}){
 const [collapsed,setCollapsed]=useState<string[]>([]),[zoom,setZoom]=useState(32),[editing,setEditing]=useState<Task|null>(null),[error,setError]=useState('');
 const [drag,setDrag]=useState<DragState|null>(null);
 const plan=schedule(tasks),days=Math.max(plan.days,14),cell=Math.min(zoom,12000/days),width=days*cell,unit=width/days,step=Math.max(1,Math.ceil(days/60));
 const ticks=Array.from({length:Math.ceil(days/step)},(_,i)=>({offset:i*step,date:new Date(Date.parse(plan.start+'T00:00:00Z')+i*step*86400000)}));
 const dynamicPhases=Array.from(new Set([...defaultPhases,...tasks.map(t=>t.phase).filter(Boolean)])) as string[];
 const groups=dynamicPhases.map(name=>({name,tasks:tasks.filter(t=>(t.phase||'Planning')===name)})).filter(g=>g.tasks.length>0||defaultPhases.includes(g.name));
 const open=(task:Task)=>{if(onSelect){onSelect(task);return;}setError('');setEditing(task);};
 useEffect(()=>{
  if(!drag)return;
  const onPointerMove=(e:PointerEvent)=>{
   const deltaX=e.clientX-drag.startX;
   const deltaDays=Math.round(deltaX/unit);
   setDrag(prev=>prev?{...prev,currentDeltaDays:deltaDays,hasMoved:prev.hasMoved||Math.abs(deltaX)>4}:null);
  };
  const onPointerUp=(e:PointerEvent)=>{
   const deltaX=e.clientX-drag.startX;
   const deltaDays=Math.round(deltaX/unit);
   const hasMoved=drag.hasMoved||Math.abs(deltaX)>4;
   if(!hasMoved){open(drag.task);}
   else if(deltaDays!==0){
    const result=calculateDragDates(drag.initialStart,drag.initialDate,drag.mode,deltaDays);
    if(result.changed){onUpdate(drag.task.id,{start:result.start,date:result.date});}
   }
   setDrag(null);
  };
  window.addEventListener('pointermove',onPointerMove);
  window.addEventListener('pointerup',onPointerUp);
  return ()=>{window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('pointerup',onPointerUp);};
 },[drag,unit,onUpdate]);
 const startDrag=(e:React.PointerEvent,task:Task,mode:'move'|'resize-start'|'resize-end')=>{
  if(readOnly)return;
  e.preventDefault();
  e.stopPropagation();
  const start=task.start||task.date||plan.start;
  const date=task.date||task.start||plan.start;
  setDrag({task,mode,startX:e.clientX,initialStart:start,initialDate:date,currentDeltaDays:0,hasMoved:false});
 };
 const save=(event:React.SyntheticEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);const start=data.get('start') as string,date=data.get('date') as string,name=(data.get('name') as string).trim();try{validateDates(start,date);if(!name)throw new Error('Enter a task name.');if(editing)onUpdate(editing.id,{name,start,date,phase:(data.get('phase') as string || 'Planning').trim(),status:data.get('status') as string,ownerId:data.get('ownerId') as string,description:(data.get('description') as string || '').trim()});setEditing(null);}catch(e){setError(e instanceof Error?e.message:'Unable to save task.');}};
 const bar=(rows:Task[],summary=false)=>{
  if(summary){
   const bars=plan.bars.filter((b:{id:string})=>rows.some(t=>t.id===b.id));
   if(!bars.length)return <span className="gantt-unplanned">Not scheduled</span>;
   const left=Math.min(...bars.map((b:{offset:number})=>b.offset)),right=Math.max(...bars.map((b:{offset:number;duration:number})=>b.offset+b.duration));
   const done=rows.filter(t=>t.status==='Done').length,percent=Math.round(done/rows.length*100);
   return <div className={'gantt-bar summary '+(percent===100?' finished':'')} style={{left:left*unit,width:Math.max((right-left)*unit,6)}} title={`Summary: ${right-left} days`}><span className="gantt-fill" style={{width:percent+'%'}}/><span>{`${percent}%`}</span></div>;
  }
  const task=rows[0];
  const bars=plan.bars.filter((b:{id:string})=>b.id===task.id);
  if(!bars.length)return <span className="gantt-unplanned">Not scheduled</span>;
  const baseBar=bars[0];
  const isDragging=drag?.task.id===task.id;
  let leftPos=baseBar.offset*unit,barWidth=Math.max(baseBar.duration*unit,8),previewDuration=baseBar.duration,previewDates={start:task.start||task.date,date:task.date};
  if(isDragging){
   previewDates=calculateDragDates(drag.initialStart,drag.initialDate,drag.mode,drag.currentDeltaDays);
   try{
    const previewStartDay=day(previewDates.start),calendarStartDay=day(plan.start),previewEndDay=day(previewDates.date);
    const previewOffset=previewStartDay-calendarStartDay;
    previewDuration=Math.max(1,previewEndDay-previewStartDay+1);
    leftPos=previewOffset*unit;
    barWidth=Math.max(previewDuration*unit,8);
   }catch{/* fallback to base */}
  }
  const done=task.status==='Done';
  return (
   <div className={`gantt-bar ${done?'finished':''} ${isDragging?'is-dragging':''} ${readOnly?'read-only':''}`} style={{left:leftPos,width:barWidth}} title={readOnly?`${task.name}: ${task.start||task.date} → ${task.date}`:'Drag to move · Drag edges to resize'} onPointerDown={e=>startDrag(e,task,'move')}>
    {!readOnly&&(
     <>
      <div className="gantt-handle gantt-handle-left" onPointerDown={e=>startDrag(e,task,'resize-start')} title="Drag to change start date"/>
      <div className="gantt-handle gantt-handle-right" onPointerDown={e=>startDrag(e,task,'resize-end')} title="Drag to change finish date"/>
     </>
    )}
    {isDragging&&(
     <div className="gantt-drag-tooltip">
      <span>{previewDates.start} → {previewDates.date}</span>
      <span className="gantt-drag-badge">{previewDuration}d</span>
     </div>
    )}
    <span className="gantt-fill" style={{width:done?'100%':'0%'}}/>
    <span>{done?'100%':task.status==='In progress'?'In progress':'To do'}</span>
   </div>
  );
 };
 return <section className="gantt-panel"><div className="gantt-title"><div><span className="eyebrow">PROJECT SCHEDULE</span><h2>Gantt chart</h2></div><span>Changes apply to this demo session</span></div><div className="gantt-toolbar"><button onClick={onAdd}><Plus size={16}/> Add task</button><button onClick={()=>setCollapsed([])}>Expand all</button><button onClick={()=>setCollapsed(dynamicPhases)}>Collapse all</button><span className="toolbar-divider"/><button aria-label="Zoom in" disabled={zoom>=64} onClick={()=>setZoom(Math.min(64,zoom+16))}><ZoomIn size={16}/>Zoom in</button><button aria-label="Zoom out" disabled={zoom<=16} onClick={()=>setZoom(Math.max(16,zoom-16))}><ZoomOut size={16}/>Zoom out</button><button onClick={()=>setZoom(Math.max(4,Math.min(64,720/days)))}><Maximize2 size={16}/>Fit</button><span className="gantt-key"><span/> Task <i/> Phase</span></div><ScrollArea className="gantt-scroll" aria-label="Project task table and Gantt calendar"><div className="gantt-grid" style={{width:660+width,gridTemplateColumns:`660px ${width}px`}}><div className="gantt-columns sticky-cell"><span>Task name / owner</span><span>Duration</span><span>Start</span><span>Finish</span></div><div className="gantt-calendar" style={{width}}><div className="gantt-month">{new Date(plan.start+'T00:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}<span>Calendar days</span></div><div className="gantt-ticks">{ticks.map(({offset,date})=><span key={offset} style={{left:offset*unit,width:step*unit}}><small>{date.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</small>{date.getUTCDate()}</span>)}</div></div><div className="gantt-summary sticky-cell"><strong>Project summary</strong><span>{plan.bars.length?`${plan.days} days`:'—'}</span><span>{plan.bars.length?plan.start:'—'}</span><span>{plan.bars.length?new Date(Date.parse(plan.start+'T00:00:00Z')+(plan.days-1)*86400000).toISOString().slice(0,10):'—'}</span></div><div className="gantt-track summary-track" style={{backgroundSize:`${step*unit}px 100%`}}>{bar(tasks,true)}</div>{groups.map(group=><Fragment key={group.name}><button className="gantt-phase sticky-cell" aria-expanded={!collapsed.includes(group.name)} onClick={()=>setCollapsed(collapsed.includes(group.name)?collapsed.filter(g=>g!==group.name):[...collapsed,group.name])}>{collapsed.includes(group.name)?<ChevronRight size={16}/>:<ChevronDown size={16}/>}<strong>{group.name}</strong><span>{group.tasks.length} tasks</span></button><div className="gantt-track phase-track" style={{backgroundSize:`${step*unit}px 100%`}}>{group.tasks.length?bar(group.tasks,true):null}</div>{!collapsed.includes(group.name)&&group.tasks.map(task=>{const range=plan.bars.find((b:{id:string})=>b.id===task.id);return <Fragment key={task.id}><button className="gantt-task sticky-cell" onClick={()=>open(task)} aria-label={`Edit ${task.name}`}><span><strong>{task.name}</strong><small>{task.owner}</small></span><span>{range?`${range.duration} days`:'—'}</span><span>{task.start||task.date||'—'}</span><span>{task.date||'—'}</span><Pencil className="edit-hint" size={12}/></button><div className="gantt-track task-track" style={{backgroundSize:`${step*unit}px 100%`}} onClick={()=>{if(!drag?.hasMoved)open(task);}} aria-label={`Edit schedule for ${task.name}`}>{bar([task])}</div></Fragment>})}</Fragment>)}</div><ScrollBar orientation="horizontal"/></ScrollArea>{!tasks.length&&<p className="empty">Add your first task to start planning this project.</p>}<div className="gantt-foot"><CalendarDays size={14}/> Click a task to edit. Drag bar to move. Drag bar edges to resize dates. <span>Purple: task · Gray: phase summary</span></div><Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null)}}><DialogContent><DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>Update the task and its calendar bar together.</DialogDescription></DialogHeader><form className="create-form" onSubmit={save}><label>Task name<input name="name" required maxLength={100} defaultValue={editing?.name}/></label><div className="form-columns"><label>Start date<input name="start" type="date" defaultValue={editing?.start||editing?.date} onClick={e=>e.currentTarget.showPicker?.()}/></label><label>Finish date<input name="date" type="date" defaultValue={editing?.date} onClick={e=>e.currentTarget.showPicker?.()}/></label></div><div className="form-columns"><label>Phase<input name="phase" list="gantt-edit-phases" defaultValue={editing?.phase||'Planning'} placeholder="e.g. Planning, Testing, UAT..."/><datalist id="gantt-edit-phases">{dynamicPhases.map(p=><option key={p} value={p}/>)}</datalist></label><label>Status<NativeSelect name="status" defaultValue={editing?.status}>{['To do','In progress','Done'].map(p=><NativeSelectOption key={p}>{p}</NativeSelectOption>)}</NativeSelect></label></div><label>Owner<NativeSelect name="ownerId" defaultValue={editing?.ownerId}>{owners.map(o=><NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}</NativeSelect></label><label>Description (optional)<textarea name="description" maxLength={10000} rows={3} defaultValue={editing?.description||''} placeholder="Add detailed runbooks, checklists, commands or notes for this task..."/></label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-columns"><button className="primary" type="submit">Save task</button>{onDelete&&editing&&<button type="button" className="text-button" onClick={()=>{if(confirm('Delete this task?')){onDelete(editing.id);setEditing(null);}}}>Delete task</button>}</div></form></DialogContent></Dialog></section>;
}

