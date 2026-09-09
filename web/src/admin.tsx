import { useState } from 'react';
import { Plus } from 'lucide-react';
import { post, patch } from '@/lib/api';
import type { User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminPanel({ users, onChange }: { users: User[]; onChange: (users: User[]) => void }) {
  const [error, setError] = useState('');
  const replace = (u: User) => onChange(users.map((x) => (x.id === u.id ? u : x)));

  const createUser = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError('');
    try {
      const u = await post<User>('/users', {
        name: data.get('name'), email: data.get('email'), password: data.get('password'),
        title: data.get('title'), role: data.get('role'),
      });
      onChange([...users, u]);
      form.reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create user'); }
  };

  const resetPassword = async (u: User) => {
    const password = prompt(`New password for ${u.name} (min 8 chars):`);
    if (!password) return;
    try {
      await patch(`/users/${u.id}`, { password });
      alert('Password updated.');
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not reset password'); }
  };

  const toggleActive = async (u: User) => {
    try {
      replace(await patch<User>(`/users/${u.id}`, { isActive: !u.isActive }));
    } catch (e) { alert(e instanceof Error ? e.message : 'Could not update user'); }
  };

  return (
    <section className="panel admin-panel">
      <h2>Team accounts</h2>
      <form className="create-form admin-create" onSubmit={createUser}>
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="title" placeholder="Job title" />
        <input name="password" type="password" placeholder="Temp password" required minLength={8} />
        <select name="role" defaultValue="member"><option value="member">member</option><option value="admin">admin</option></select>
        <button className="primary" type="submit"><Plus size={15} /> Add user</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.title}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell><span className={'badge ' + (u.isActive ? 'green-badge' : 'amber')}>{u.isActive ? 'Active' : 'Deactivated'}</span></TableCell>
              <TableCell>
                <button className="text-button" onClick={() => resetPassword(u)}>Reset password</button>{' '}
                <button className="text-button" onClick={() => toggleActive(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
