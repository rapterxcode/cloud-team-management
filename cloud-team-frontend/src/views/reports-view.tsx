import { Cloud } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface ReportsViewProps {
  totalMonthly: number;
  spendByProvider: Array<[string, number]>;
}

export function ReportsView({ totalMonthly, spendByProvider }: ReportsViewProps) {
  return (
    <>
      <div className="resource-banner">
        <span className="project-icon purple">
          <Cloud size={28} />
        </span>
        <div>
          <h2>Cloud spend overview</h2>
          <p>Live multi-cloud FinOps inventory</p>
        </div>
        <strong>
          ${totalMonthly.toLocaleString()}
          <small>/ month</small>
        </strong>
      </div>
      <section className="panel report">
        <h2>Spend by provider</h2>
        {spendByProvider.map(([name, amount]) => (
          <div key={name}>
            <div className="progress-label">
              <strong>{name}</strong>
              <span>${amount.toLocaleString()}</span>
            </div>
            <Progress
              value={totalMonthly ? Math.round((amount / totalMonthly) * 100) : 0}
              aria-label={`${name} share of spend`}
            />
          </div>
        ))}
        {spendByProvider.length === 0 && <p className="empty">No resources yet.</p>}
      </section>
    </>
  );
}
