import { Progress } from '@/components/ui/progress';

export interface TeamViewProps {
  members: ReadonlyArray<readonly [string, string, string, number]>;
}

export function TeamView({ members }: TeamViewProps) {
  return (
    <div className="team-grid">
      {members.map(([name, role, initial, load], i) => (
        <section className="panel member" key={name}>
          <span
            className={'avatar large ' + ['', 'blue', 'pink', 'orange'][i % 4]}
          >
            {initial}
          </span>
          <h2>{name}</h2>
          <p>{role}</p>
          <span className="badge green-badge">• Available</span>
          <div className="progress-label">
            <span>Weekly capacity used</span>
            <strong>{load}%</strong>
          </div>
          <Progress value={load} aria-label={`${name} workload`} />
        </section>
      ))}
      {members.length === 0 && <p className="empty">No team members yet.</p>}
    </div>
  );
}
