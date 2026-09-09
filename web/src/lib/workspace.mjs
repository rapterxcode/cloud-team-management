export function addItem(items, item) {
 const name=item.name.trim();
 if(!name) throw new Error('A name is required');
 return [...items,{...item,name}];
}
export const completeTask=(items,id)=>items.map(item=>item.id===id?{...item,status:'Done'}:item);
export const filterItems=(items,query='',status='All')=>items.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase())&&(status==='All'||item.status===status));
export const projectTasks = (items, projectId) => items.filter(item => item.projectId === projectId);
export const updateItem = (items, id, changes) => items.map(item => item.id === id ? {...item, ...changes} : item);
export const timelineTasks = items => [...items].sort((a,b)=>(a.date || '9999').localeCompare(b.date || '9999'));
