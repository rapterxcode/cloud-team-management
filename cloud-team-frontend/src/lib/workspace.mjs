export function addItem(items, item) {
 const name=item.name.trim();
 if(!name) throw new Error('A name is required');
 return [...items,{...item,name}];
}
export const completeTask=(items,id)=>items.map(item=>item.id===id?{...item,status:'Done'}:item);
export const filterItems = (items, query = '', status = 'All', year = 'All') =>
  items.filter(item => {
    const q = query.trim().toLowerCase();
    const matchName = !q || (item.name && item.name.toLowerCase().includes(q));
    const matchStatus =
      status === 'All'
        ? true
        : status === 'Active'
        ? item.status !== 'Completed'
        : item.status === status;
    const matchYear =
      year === 'All'
        ? true
        : item.year !== undefined
        ? String(item.year) === String(year)
        : true;
    return matchName && matchStatus && matchYear;
  });
export const projectTasks = (items, projectId) => items.filter(item => item.projectId === projectId);
export const updateItem = (items, id, changes) => items.map(item => item.id === id ? {...item, ...changes} : item);
export const timelineTasks = items => [...items].sort((a,b)=>(a.date || '9999').localeCompare(b.date || '9999'));
export const computeWorkload = (tasks, userId) => {
  const activeCount = tasks.filter(t => t.ownerId === userId && t.status !== 'Done').length;
  return Math.min(100, activeCount * 20);
};

