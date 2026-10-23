import { useMemo, useState } from 'react';
import { Cloud, Pencil, Plus, Search, Server, ShieldCheck, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Resource } from '@/lib/types';

export interface CloudResourcesViewProps {
  resources: Resource[];
  readOnly?: boolean;
  onAddResource: () => void;
  onEditResource: (resource: Resource) => void;
  onDeleteResource: (resourceId: string) => void;
}

export function CloudResourcesView({
  resources,
  readOnly = false,
  onAddResource,
  onEditResource,
  onDeleteResource,
}: CloudResourcesViewProps) {
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const providers = useMemo(
    () => ['All', ...Array.from(new Set(resources.map((r) => r.provider)))],
    [resources]
  );

  const filteredResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => {
      const matchQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q);
      const matchProvider =
        providerFilter === 'All' || r.provider === providerFilter;
      const matchStatus = statusFilter === 'All' || r.status === statusFilter;
      return matchQuery && matchProvider && matchStatus;
    });
  }, [resources, search, providerFilter, statusFilter]);

  const totalMonthly = useMemo(
    () => resources.reduce((sum, r) => sum + r.monthlyCost, 0),
    [resources]
  );
  const healthyCount = useMemo(
    () => resources.filter((r) => r.status === 'Healthy').length,
    [resources]
  );
  const reviewCount = resources.length - healthyCount;

  return (
    <>
      <div className="resource-banner">
        <span className="project-icon purple">
          <Cloud size={28} />
        </span>
        <div>
          <h2>Multi-Cloud Resources & FinOps Inventory</h2>
          <p>
            Active cloud infrastructure assets, health posture, and monthly cost
            allocation across providers.
          </p>
        </div>
        <strong>
          ${totalMonthly.toLocaleString()}
          <small>/ month</small>
        </strong>
      </div>

      <div className="stats">
        <section className="stat">
          <div>
            <span>Provisioned assets</span>
            <Server size={18} />
          </div>
          <strong>{resources.length}</strong>
          <small>
            <span className="green">↗</span> Across {Math.max(providers.length - 1, 0)}{' '}
            cloud providers
          </small>
        </section>
        <section className="stat">
          <div>
            <span>Healthy workloads</span>
            <ShieldCheck size={18} />
          </div>
          <strong>{healthyCount}</strong>
          <small>
            <span className="green">✓</span> Passing baseline checks
          </small>
        </section>
        <section className="stat">
          <div>
            <span>Review needed</span>
            <Server size={18} />
          </div>
          <strong>{reviewCount}</strong>
          <small>Flagged for FinOps / security review</small>
        </section>
        <section className="stat">
          <div>
            <span>Filtered monthly spend</span>
            <Cloud size={18} />
          </div>
          <strong>
            $
            {filteredResources
              .reduce((sum, r) => sum + r.monthlyCost, 0)
              .toLocaleString()}
          </strong>
          <small>{filteredResources.length} matching resources</small>
        </section>
      </div>

      <div className="toolbar flex flex-col md:flex-row gap-3">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search cloud resources"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resource name, provider, or service type…"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="filter-buttons">
            {providers.map((p) => (
              <button
                key={p}
                className={providerFilter === p ? 'selected' : ''}
                onClick={() => setProviderFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="filter-buttons">
            {['All', 'Healthy', 'Review needed'].map((s) => (
              <button
                key={s}
                className={statusFilter === s ? 'selected' : ''}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Resource Name</TableHead>
              <TableHead>Cloud Provider</TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Monthly Spend</TableHead>
              {!readOnly && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResources.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold">{r.name}</TableCell>
                <TableCell>
                  <span className="badge blue-badge">{r.provider}</span>
                </TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell>
                  <span
                    className={
                      'badge ' +
                      (r.status === 'Healthy' ? 'green-badge' : 'amber')
                    }
                  >
                    {r.status === 'Healthy' ? '• Healthy' : '⚠ ' + r.status}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${r.monthlyCost.toLocaleString()}/mo
                </TableCell>
                {!readOnly && (
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Edit ${r.name}`}
                        onClick={() => onEditResource(r)}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => onDeleteResource(r.id)}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredResources.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={readOnly ? 5 : 6}
                  className="text-center py-8 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span>No cloud resources match your filter.</span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="primary"
                        onClick={onAddResource}
                      >
                        <Plus size={15} /> Add cloud resource
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
