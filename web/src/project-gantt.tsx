import {useState,useEffect,Fragment} from 'react';
import {Plus,ChevronDown,ChevronRight,ZoomIn,ZoomOut,Maximize2,CalendarDays,Pencil,GripVertical} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {
  schedule,
  validateDates,
  calculateDragDates,
  day,
  addDays,
  shiftPhaseTasks,
  normalizePhase,
  reorderPhases,
  reorderTasks,
  moveTaskToPhaseWithTimeline,
} from '@/lib/gantt.mjs';

type Task={id:string;name:string;status:string;owner:string;ownerId?:string;date:string;start?:string;phase?:string;description?:string;projectId?:string};
const defaultPhases=['Planning','Development','Testing','Launch','Audit'];

interface TaskDragState{
  kind:'task';
  task:Task;
  mode:'move'|'resize-start'|'resize-end';
  startX:number;
  initialStart:string;
  initialDate:string;
  currentDeltaDays:number;
  hasMoved:boolean;
}

interface PhaseDragState{
  kind:'phase';
  phaseName:string;
  tasks:Task[];
  startX:number;
  initialMinStart:string;
  initialMaxDate:string;
  currentDeltaDays:number;
  hasMoved:boolean;
}

type DragState=TaskDragState|PhaseDragState;

export default function ProjectGantt({
  tasks,
  onAdd,
  onUpdate,
  onDelete,
  owners=[],
  onSelect,
  readOnly=false,
}:{
  tasks:Task[];
  onAdd:()=>void;
  onUpdate:(id:string,changes:Record<string,unknown>)=>void;
  onDelete?:(id:string)=>void;
  owners?:{id:string;name:string}[];
  onSelect?:(task:Task)=>void;
  readOnly?:boolean;
}){
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const [zoom,setZoom]=useState(32);
  const [editing,setEditing]=useState<Task|null>(null);
  const [error,setError]=useState('');
  const [drag,setDrag]=useState<DragState|null>(null);
  const [dropTargetPhase,setDropTargetPhase]=useState<string|null>(null);
  const [dropTargetTask,setDropTargetTask]=useState<{id:string;position:'before'|'after'}|null>(null);
  const [draggingTaskId,setDraggingTaskId]=useState<string|null>(null);
  const [phaseOrder,setPhaseOrder]=useState<string[]>([]);
  const [taskOrder,setTaskOrder]=useState<string[]>(()=>{
    const pId=tasks[0]?.projectId;
    if(pId){
      try{
        const saved=localStorage.getItem(`gantt_task_order_${pId}`);
        if(saved)return JSON.parse(saved);
      }catch{}
    }
    return tasks.map(t=>t.id);
  });

  useEffect(()=>{
    const pId=tasks[0]?.projectId;
    if(pId){
      try{
        const saved=localStorage.getItem(`gantt_task_order_${pId}`);
        if(saved){
          setTaskOrder(JSON.parse(saved));
          return;
        }
      }catch{}
    }
    setTaskOrder(prev=>{
      const existing=prev.filter(id=>tasks.some(t=>t.id===id));
      const missing=tasks.filter(t=>!existing.includes(t.id)).map(t=>t.id);
      return [...existing,...missing];
    });
  },[tasks[0]?.projectId,tasks.length]);

  const plan=schedule(tasks);
  const days=Math.max(plan.days,14);
  const cell=Math.min(zoom,12000/days);
  const width=days*cell;
  const unit=width/days;
  const step=Math.max(1,Math.ceil(days/60));
  const ticks=Array.from({length:Math.ceil(days/step)},(_,i)=>({
    offset:i*step,
    date:new Date(Date.parse(plan.start+'T00:00:00Z')+i*step*86400000),
  }));

  const discoveredPhases=Array.from(new Set([...defaultPhases,...tasks.map(t=>normalizePhase(t.phase))]));
  const orderedPhaseNames=[
    ...phaseOrder.filter(p=>discoveredPhases.includes(p)),
    ...discoveredPhases.filter(p=>!phaseOrder.includes(p)),
  ];

  const orderedTasks=[...tasks].sort((a,b)=>{
    const idxA=taskOrder.indexOf(a.id);
    const idxB=taskOrder.indexOf(b.id);
    const posA=idxA===-1?999999:idxA;
    const posB=idxB===-1?999999:idxB;
    return posA-posB;
  });

  const groups=orderedPhaseNames.map(name=>({
    name,
    tasks:orderedTasks.filter(t=>normalizePhase(t.phase)===name),
  })).filter(g=>g.tasks.length>0||defaultPhases.includes(g.name));

  const open=(task:Task)=>{
    if(onSelect){onSelect(task);return;}
    setError('');
    setEditing(task);
  };

  useEffect(()=>{
    if(!drag)return;
    const onPointerMove=(e:PointerEvent)=>{
      setDrag(prev=>{
        if(!prev)return null;
        const deltaX=e.clientX-prev.startX;
        const deltaDays=Math.round(deltaX/unit);
        return {...prev,currentDeltaDays:deltaDays,hasMoved:prev.hasMoved||Math.abs(deltaX)>4};
      });
    };
    const onPointerUp=(e:PointerEvent)=>{
      setDrag(current=>{
        if(!current)return null;
        const deltaX=e.clientX-current.startX;
        const deltaDays=Math.round(deltaX/unit);
        const hasMoved=current.hasMoved||Math.abs(deltaX)>4;

        if(current.kind==='task'){
          if(!hasMoved){
            open(current.task);
          }else if(deltaDays!==0){
            const result=calculateDragDates(current.initialStart,current.initialDate,current.mode,deltaDays);
            if(result.changed){
              onUpdate(current.task.id,{start:result.start,date:result.date});
            }
          }
        }else if(current.kind==='phase'){
          if(hasMoved&&deltaDays!==0){
            const shifted=shiftPhaseTasks(current.tasks,deltaDays);
            for(const item of shifted){
              onUpdate(item.id,{start:item.start,date:item.date});
            }
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove',onPointerMove);
    window.addEventListener('pointerup',onPointerUp);
    return ()=>{
      window.removeEventListener('pointermove',onPointerMove);
      window.removeEventListener('pointerup',onPointerUp);
    };
  },[!!drag,unit,onUpdate]);

  const startDrag=(e:React.PointerEvent,task:Task,mode:'move'|'resize-start'|'resize-end')=>{
    if(readOnly)return;
    e.preventDefault();
    e.stopPropagation();
    const start=task.start||task.date||plan.start;
    const date=task.date||task.start||plan.start;
    setDrag({
      kind:'task',
      task,
      mode,
      startX:e.clientX,
      initialStart:start,
      initialDate:date,
      currentDeltaDays:0,
      hasMoved:false,
    });
  };

  const startPhaseDrag=(e:React.PointerEvent,phaseName:string,phaseTasks:Task[])=>{
    if(readOnly)return;
    const dated=phaseTasks.filter(t=>t.date||t.start);
    if(!dated.length)return;
    e.preventDefault();
    e.stopPropagation();
    const minStart=dated.map(t=>(t.start||t.date||'').slice(0,10)).sort()[0]||plan.start;
    const maxDate=dated.map(t=>(t.date||t.start||'').slice(0,10)).sort().reverse()[0]||plan.start;
    setDrag({
      kind:'phase',
      phaseName,
      tasks:dated,
      startX:e.clientX,
      initialMinStart:minStart,
      initialMaxDate:maxDate,
      currentDeltaDays:0,
      hasMoved:false,
    });
  };

  const handleMoveTaskToPhase=(taskId:string,targetPhase:string)=>{
    const task=tasks.find(t=>t.id===taskId);
    if(!task)return;
    const currentPhase=normalizePhase(task.phase);
    if(currentPhase===targetPhase)return;
    const changes=moveTaskToPhaseWithTimeline(task,targetPhase,tasks);
    onUpdate(taskId,changes);

    setTaskOrder(prevOrder=>{
      const base=prevOrder.length>0
        ?[...prevOrder.filter(id=>tasks.some(t=>t.id===id)),...tasks.filter(t=>!prevOrder.includes(t.id)).map(t=>t.id)]
        :tasks.map(t=>t.id);

      const targetPhaseTasks=orderedTasks.filter(t=>normalizePhase(t.phase)===targetPhase&&t.id!==taskId);
      const lastTargetTask=targetPhaseTasks[targetPhaseTasks.length-1];
      if(lastTargetTask){
        const newOrder=reorderTasks(base,taskId,lastTargetTask.id,'after');
        const pId=task.projectId;
        if(pId){
          try{
            localStorage.setItem(`gantt_task_order_${pId}`,JSON.stringify(newOrder));
          }catch{}
        }
        return newOrder;
      }
      return base;
    });
  };

  const handleReorderTask=(sourceTaskId:string,targetTaskId:string,position:'before'|'after'='after')=>{
    if(sourceTaskId===targetTaskId)return;
    const sourceTask=tasks.find(t=>t.id===sourceTaskId);
    const targetTask=tasks.find(t=>t.id===targetTaskId);
    if(!sourceTask||!targetTask)return;

    const sourcePhase=normalizePhase(sourceTask.phase);
    const targetPhase=normalizePhase(targetTask.phase);

    if(sourcePhase!==targetPhase){
      const changes=moveTaskToPhaseWithTimeline(sourceTask,targetPhase,tasks);
      onUpdate(sourceTaskId,changes);
    }

    setTaskOrder(prevOrder=>{
      const base=prevOrder.length>0
        ?[...prevOrder.filter(id=>tasks.some(t=>t.id===id)),...tasks.filter(t=>!prevOrder.includes(t.id)).map(t=>t.id)]
        :tasks.map(t=>t.id);

      const newOrder=reorderTasks(base,sourceTaskId,targetTaskId,position);
      const pId=sourceTask.projectId||targetTask.projectId;
      if(pId){
        try{
          localStorage.setItem(`gantt_task_order_${pId}`,JSON.stringify(newOrder));
        }catch{}
      }
      return newOrder;
    });
  };

  const handleReorderPhase=(sourcePhase:string,targetPhase:string)=>{
    if(sourcePhase===targetPhase)return;
    setPhaseOrder(prev=>reorderPhases(prev.length?prev:orderedPhaseNames,sourcePhase,targetPhase));
  };

  const save=(event:React.SyntheticEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    const start=data.get('start') as string;
    const date=data.get('date') as string;
    const name=(data.get('name') as string).trim();
    try{
      validateDates(start,date);
      if(!name)throw new Error('Enter a task name.');
      if(editing){
        onUpdate(editing.id,{
          name,
          start,
          date,
          phase:normalizePhase(data.get('phase') as string),
          status:data.get('status') as string,
          ownerId:data.get('ownerId') as string,
          description:(data.get('description') as string||'').trim(),
        });
      }
      setEditing(null);
    }catch(e){
      setError(e instanceof Error?e.message:'Unable to save task.');
    }
  };

  const bar=(rows:Task[],summary=false,phaseName?:string)=>{
    if(summary){
      const bars=plan.bars.filter((b:{id:string})=>rows.some(t=>t.id===b.id));
      if(!bars.length)return <span className="gantt-unplanned">Not scheduled</span>;

      const isPhaseDragging=drag?.kind==='phase'&&drag.phaseName===phaseName;
      const delta=isPhaseDragging?drag.currentDeltaDays:0;

      let left=Math.min(...bars.map((b:{offset:number})=>b.offset));
      let right=Math.max(...bars.map((b:{offset:number;duration:number})=>b.offset+b.duration));

      if(isPhaseDragging&&delta!==0){
        left+=delta;
        right+=delta;
      }

      const done=rows.filter(t=>t.status==='Done').length;
      const percent=Math.round(done/rows.length*100);
      const phaseDuration=right-left;

      const previewMinStart=isPhaseDragging&&drag?addDays(drag.initialMinStart,delta):'';
      const previewMaxDate=isPhaseDragging&&drag?addDays(drag.initialMaxDate,delta):'';

      return (
        <div
          className={`gantt-bar summary ${percent===100?' finished':''} ${isPhaseDragging?' is-dragging':''}`}
          style={{left:left*unit,width:Math.max(phaseDuration*unit,6)}}
          title={readOnly?`Summary: ${phaseDuration} days`:`Phase: ${phaseName||'Summary'} (${phaseDuration} days) · Drag to shift phase timeline`}
          onPointerDown={phaseName&&!readOnly?(e)=>startPhaseDrag(e,phaseName,rows):undefined}
        >
          {isPhaseDragging&&(
            <div className="gantt-drag-tooltip">
              <span>{previewMinStart} → {previewMaxDate}</span>
              <span className="gantt-drag-badge">{phaseDuration}d ({delta>=0?`+${delta}`:delta}d)</span>
            </div>
          )}
          <span className="gantt-fill" style={{width:percent+'%'}}/>
          <span>{`${percent}%`}</span>
        </div>
      );
    }

    const task=rows[0];
    const bars=plan.bars.filter((b:{id:string})=>b.id===task.id);
    if(!bars.length)return <span className="gantt-unplanned">Not scheduled</span>;
    const baseBar=bars[0];

    const isTaskDragging=drag?.kind==='task'&&drag.task.id===task.id;
    const isParentPhaseDragging=drag?.kind==='phase'&&drag.tasks.some(t=>t.id===task.id);

    let leftPos=baseBar.offset*unit;
    let barWidth=Math.max(baseBar.duration*unit,8);
    let previewDuration=baseBar.duration;
    let previewDates={start:task.start||task.date,date:task.date};

    if(isTaskDragging){
      previewDates=calculateDragDates(drag.initialStart,drag.initialDate,drag.mode,drag.currentDeltaDays);
      try{
        const previewStartDay=day(previewDates.start);
        const calendarStartDay=day(plan.start);
        const previewEndDay=day(previewDates.date);
        const previewOffset=previewStartDay-calendarStartDay;
        previewDuration=Math.max(1,previewEndDay-previewStartDay+1);
        leftPos=previewOffset*unit;
        barWidth=Math.max(previewDuration*unit,8);
      }catch{/* fallback */}
    }else if(drag&&drag.kind==='phase'&&isParentPhaseDragging&&drag.currentDeltaDays!==0){
      const d=drag.currentDeltaDays;
      const s=(task.start||task.date||'').slice(0,10);
      const e=(task.date||task.start||'').slice(0,10);
      try{
        previewDates={start:addDays(s,d),date:addDays(e,d)};
        const previewStartDay=day(previewDates.start);
        const calendarStartDay=day(plan.start);
        const previewEndDay=day(previewDates.date);
        leftPos=(previewStartDay-calendarStartDay)*unit;
        previewDuration=Math.max(1,previewEndDay-previewStartDay+1);
        barWidth=Math.max(previewDuration*unit,8);
      }catch{}
    }

    const done=task.status==='Done';
    return (
      <div
        className={`gantt-bar ${done?'finished':''} ${isTaskDragging?'is-dragging':''} ${isParentPhaseDragging&&drag.currentDeltaDays!==0?'is-dragging':''} ${readOnly?'read-only':''}`}
        style={{left:leftPos,width:barWidth}}
        title={readOnly?`${task.name}: ${task.start||task.date} → ${task.date}`:'Drag to move · Drag edges to resize'}
        onPointerDown={e=>startDrag(e,task,'move')}
      >
        {!readOnly&&(
          <>
            <div className="gantt-handle gantt-handle-left" onPointerDown={e=>startDrag(e,task,'resize-start')} title="Drag to change start date"/>
            <div className="gantt-handle gantt-handle-right" onPointerDown={e=>startDrag(e,task,'resize-end')} title="Drag to change finish date"/>
          </>
        )}
        {(isTaskDragging||(isParentPhaseDragging&&drag.currentDeltaDays!==0))&&(
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

  return (
    <section className="gantt-panel">
      <div className="gantt-title">
        <div>
          <span className="eyebrow">PROJECT SCHEDULE</span>
          <h2>Gantt chart</h2>
        </div>
        <span>Changes apply to this demo session</span>
      </div>
      <div className="gantt-toolbar">
        <button type="button" onClick={onAdd}><Plus size={16}/> Add task</button>
        <button type="button" onClick={()=>setCollapsed([])}>Expand all</button>
        <button type="button" onClick={()=>setCollapsed(groups.map(g=>g.name))}>Collapse all</button>
        <span className="toolbar-divider"/>
        <button type="button" aria-label="Zoom in" disabled={zoom>=64} onClick={()=>setZoom(Math.min(64,zoom+16))}><ZoomIn size={16}/>Zoom in</button>
        <button type="button" aria-label="Zoom out" disabled={zoom<=16} onClick={()=>setZoom(Math.max(16,zoom-16))}><ZoomOut size={16}/>Zoom out</button>
        <button type="button" onClick={()=>setZoom(Math.max(4,Math.min(64,720/days)))}><Maximize2 size={16}/>Fit</button>
        <span className="gantt-key"><span/> Task <i/> Phase</span>
      </div>
      <div className="gantt-scroll" tabIndex={0} role="region" aria-label="Project task table and Gantt calendar">
        <div className="gantt-grid" style={{width:660+width,gridTemplateColumns:`660px ${width}px`}}>
          <div className="gantt-columns sticky-cell">
            <span>Task name / owner</span>
            <span>Duration</span>
            <span>Start</span>
            <span>Finish</span>
          </div>
          <div className="gantt-calendar" style={{width}}>
            <div className="gantt-month">
              {new Date(plan.start+'T00:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})}
              <span>Calendar days</span>
            </div>
            <div className="gantt-ticks">
              {ticks.map(({offset,date})=>(
                <span key={offset} style={{left:offset*unit,width:step*unit}}>
                  <small>{date.toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})}</small>
                  {date.getUTCDate()}
                </span>
              ))}
            </div>
          </div>
          <div className="gantt-summary sticky-cell">
            <strong>Project summary</strong>
            <span>{plan.bars.length?`${plan.days} days`:'—'}</span>
            <span>{plan.bars.length?plan.start:'—'}</span>
            <span>{plan.bars.length?new Date(Date.parse(plan.start+'T00:00:00Z')+(plan.days-1)*86400000).toISOString().slice(0,10):'—'}</span>
          </div>
          <div className="gantt-track summary-track" style={{backgroundSize:`${step*unit}px 100%`}}>
            {bar(tasks,true)}
          </div>
          {groups.map(group=>(
            <Fragment key={group.name}>
              <button
                type="button"
                className={`gantt-phase sticky-cell ${dropTargetPhase===group.name?'drop-target':''}`}
                aria-expanded={!collapsed.includes(group.name)}
                onClick={()=>setCollapsed(collapsed.includes(group.name)?collapsed.filter(g=>g!==group.name):[...collapsed,group.name])}
                draggable={!readOnly}
                onDragStart={(e)=>{
                  if(readOnly)return;
                  e.dataTransfer.setData('application/x-gantt-phase',group.name);
                  e.dataTransfer.effectAllowed='move';
                }}
                onDragOver={(e)=>{
                  if(readOnly)return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect='move';
                  if(dropTargetPhase!==group.name)setDropTargetPhase(group.name);
                }}
                onDragLeave={(e)=>{
                  if(e.currentTarget.contains(e.relatedTarget as Node))return;
                  if(dropTargetPhase===group.name)setDropTargetPhase(null);
                }}
                onDrop={(e)=>{
                  if(readOnly)return;
                  e.preventDefault();
                  setDropTargetPhase(null);
                  const pData=e.dataTransfer.getData('application/x-gantt-phase');
                  const tData=e.dataTransfer.getData('application/x-gantt-task')||e.dataTransfer.getData('text/plain')||draggingTaskId;
                  if(pData){
                    handleReorderPhase(pData,group.name);
                  }else if(tData){
                    handleMoveTaskToPhase(tData,group.name);
                  }
                }}
              >
                {collapsed.includes(group.name)?<ChevronRight size={16}/>:<ChevronDown size={16}/>}
                <strong>{group.name}</strong>
                <span>{group.tasks.length} tasks</span>
              </button>
              <div
                className={`gantt-track phase-track ${dropTargetPhase===group.name?'drop-target-track':''}`}
                style={{backgroundSize:`${step*unit}px 100%`}}
                onDragOver={(e)=>{
                  if(readOnly)return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect='move';
                  if(dropTargetPhase!==group.name)setDropTargetPhase(group.name);
                }}
                onDragLeave={(e)=>{
                  if(e.currentTarget.contains(e.relatedTarget as Node))return;
                  if(dropTargetPhase===group.name)setDropTargetPhase(null);
                }}
                onDrop={(e)=>{
                  if(readOnly)return;
                  e.preventDefault();
                  setDropTargetPhase(null);
                  const pData=e.dataTransfer.getData('application/x-gantt-phase');
                  const tData=e.dataTransfer.getData('application/x-gantt-task')||e.dataTransfer.getData('text/plain')||draggingTaskId;
                  if(pData){
                    handleReorderPhase(pData,group.name);
                  }else if(tData){
                    handleMoveTaskToPhase(tData,group.name);
                  }
                }}
              >
                {group.tasks.length?bar(group.tasks,true,group.name):null}
              </div>
              {!collapsed.includes(group.name)&&group.tasks.map(task=>{
                const range=plan.bars.find((b:{id:string})=>b.id===task.id);
                const isTaskDragging=drag?.kind==='task'&&drag.task.id===task.id;
                const isParentPhaseDragging=drag?.kind==='phase'&&drag.tasks.some(t=>t.id===task.id);
                const isPreviewActive=isTaskDragging||(isParentPhaseDragging&&drag.currentDeltaDays!==0);

                let displayStart=task.start||task.date||'—';
                let displayFinish=task.date||'—';
                let displayDuration=range?`${range.duration} days`:'—';

                if(isTaskDragging){
                  const pDates=calculateDragDates(drag.initialStart,drag.initialDate,drag.mode,drag.currentDeltaDays);
                  displayStart=pDates.start;
                  displayFinish=pDates.date;
                  try{
                    const sD=day(pDates.start),eD=day(pDates.date);
                    displayDuration=`${Math.max(1,eD-sD+1)} days`;
                  }catch{}
                }else if(drag&&drag.kind==='phase'&&isParentPhaseDragging&&drag.currentDeltaDays!==0){
                  const s=(task.start||task.date||'').slice(0,10);
                  const e=(task.date||task.start||'').slice(0,10);
                  try{
                    const pS=addDays(s,drag.currentDeltaDays);
                    const pE=addDays(e,drag.currentDeltaDays);
                    displayStart=pS;
                    displayFinish=pE;
                    const sD=day(pS),eD=day(pE);
                    displayDuration=`${Math.max(1,eD-sD+1)} days`;
                  }catch{}
                }

                const isTaskDropTarget=dropTargetTask?.id===task.id;
                const taskDropPos=isTaskDropTarget?dropTargetTask.position:null;

                return (
                  <Fragment key={task.id}>
                    <button
                      type="button"
                      className={`gantt-task sticky-cell ${isPreviewActive?'is-dragging-row':''} ${draggingTaskId===task.id?'is-dragging-source':''} ${taskDropPos==='before'?'drop-target-before':''} ${taskDropPos==='after'?'drop-target-after':''}`}
                      onClick={()=>open(task)}
                      aria-label={`Edit ${task.name}`}
                      draggable={!readOnly}
                      onDragStart={(e)=>{
                        if(readOnly)return;
                        e.dataTransfer.setData('application/x-gantt-task',task.id);
                        e.dataTransfer.setData('text/plain',task.id);
                        e.dataTransfer.effectAllowed='move';
                        setDraggingTaskId(task.id);
                      }}
                      onDragOver={(e)=>{
                        if(readOnly||draggingTaskId===task.id)return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect='move';
                        const rect=e.currentTarget.getBoundingClientRect();
                        const pos:'before'|'after'=(e.clientY-rect.top)<rect.height/2?'before':'after';
                        if(dropTargetTask?.id!==task.id||dropTargetTask?.position!==pos){
                          setDropTargetTask({id:task.id,position:pos});
                        }
                      }}
                      onDragLeave={(e)=>{
                        if(e.currentTarget.contains(e.relatedTarget as Node))return;
                        if(dropTargetTask?.id===task.id){
                          setDropTargetTask(null);
                        }
                      }}
                      onDrop={(e)=>{
                        if(readOnly)return;
                        e.preventDefault();
                        e.stopPropagation();
                        const sourceId=e.dataTransfer.getData('application/x-gantt-task')||e.dataTransfer.getData('text/plain')||draggingTaskId;
                        const pos=dropTargetTask?.position||'after';
                        setDropTargetTask(null);
                        setDraggingTaskId(null);
                        if(sourceId&&sourceId!==task.id){
                          handleReorderTask(sourceId,task.id,pos);
                        }
                      }}
                      onDragEnd={()=>{
                        setDraggingTaskId(null);
                        setDropTargetPhase(null);
                        setDropTargetTask(null);
                      }}
                    >
                      <GripVertical className="drag-grip" size={14}/>
                      <span>
                        <strong>{task.name}</strong>
                        <small>{task.owner}</small>
                      </span>
                      <span className={isPreviewActive?'gantt-live-val':''}>{displayDuration}</span>
                      <span className={isPreviewActive?'gantt-live-val':''}>{displayStart}</span>
                      <span className={isPreviewActive?'gantt-live-val':''}>{displayFinish}</span>
                      <Pencil className="edit-hint" size={12}/>
                    </button>
                    <div
                      className={`gantt-track task-track ${taskDropPos==='before'?'drop-target-before':''} ${taskDropPos==='after'?'drop-target-after':''}`}
                      style={{backgroundSize:`${step*unit}px 100%`}}
                      onDragOver={(e)=>{
                        if(readOnly||draggingTaskId===task.id)return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect='move';
                        const rect=e.currentTarget.getBoundingClientRect();
                        const pos:'before'|'after'=(e.clientY-rect.top)<rect.height/2?'before':'after';
                        if(dropTargetTask?.id!==task.id||dropTargetTask?.position!==pos){
                          setDropTargetTask({id:task.id,position:pos});
                        }
                      }}
                      onDragLeave={(e)=>{
                        if(e.currentTarget.contains(e.relatedTarget as Node))return;
                        if(dropTargetTask?.id===task.id){
                          setDropTargetTask(null);
                        }
                      }}
                      onDrop={(e)=>{
                        if(readOnly)return;
                        e.preventDefault();
                        e.stopPropagation();
                        const sourceId=e.dataTransfer.getData('application/x-gantt-task')||e.dataTransfer.getData('text/plain')||draggingTaskId;
                        const pos=dropTargetTask?.position||'after';
                        setDropTargetTask(null);
                        setDraggingTaskId(null);
                        if(sourceId&&sourceId!==task.id){
                          handleReorderTask(sourceId,task.id,pos);
                        }
                      }}
                      onClick={()=>{if(!drag?.hasMoved)open(task);}}
                      aria-label={`Edit schedule for ${task.name}`}
                    >
                      {bar([task])}
                    </div>
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {!tasks.length&&<p className="empty">Add your first task to start planning this project.</p>}
      <div className="gantt-foot">
        <CalendarDays size={14}/>
        <span>Drag task/phase bars to shift timeline · Drag edges to resize · Drag task rows to reorder within/across phases</span>
        <span>Purple: task · Gray: phase summary</span>
      </div>
      <Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update the task and its calendar bar together.</DialogDescription>
          </DialogHeader>
          <form key={editing?`${editing.id}:${editing.start||''}:${editing.date||''}`:'none'} className="create-form" onSubmit={save}>
            <label>
              Task name
              <input name="name" required maxLength={100} defaultValue={editing?.name}/>
            </label>
            <div className="form-columns">
              <label>
                Start date
                <input name="start" type="date" defaultValue={editing?.start||editing?.date} onClick={e=>e.currentTarget.showPicker?.()}/>
              </label>
              <label>
                Finish date
                <input name="date" type="date" defaultValue={editing?.date} onClick={e=>e.currentTarget.showPicker?.()}/>
              </label>
            </div>
            <div className="form-columns">
              <label>
                Phase
                <input name="phase" list="gantt-edit-phases" defaultValue={editing?.phase||'Planning'} placeholder="e.g. Planning, Testing, UAT..."/>
                <datalist id="gantt-edit-phases">
                  {discoveredPhases.map(p=><option key={p} value={p}/>)}
                </datalist>
              </label>
              <label>
                Status
                <NativeSelect name="status" defaultValue={editing?.status}>
                  {['To do','In progress','Done'].map(p=><NativeSelectOption key={p}>{p}</NativeSelectOption>)}
                </NativeSelect>
              </label>
            </div>
            <label>
              Owner
              <NativeSelect name="ownerId" defaultValue={editing?.ownerId}>
                {owners.map(o=><NativeSelectOption key={o.id} value={o.id}>{o.name}</NativeSelectOption>)}
              </NativeSelect>
            </label>
            <label>
              Description (optional)
              <textarea name="description" maxLength={10000} rows={3} defaultValue={editing?.description||''} placeholder="Add detailed runbooks, checklists, commands or notes for this task..."/>
            </label>
            {error&&<p className="form-error" role="alert">{error}</p>}
            <div className="form-columns">
              <button className="primary" type="submit">Save task</button>
              {onDelete&&editing&&(
                <button type="button" className="text-button" onClick={()=>{if(confirm('Delete this task?')){onDelete(editing.id);setEditing(null);}}}>
                  Delete task
                </button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
