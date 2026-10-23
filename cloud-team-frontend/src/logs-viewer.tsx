import { useState, useEffect } from 'react';
import { Search, Download, ShieldCheck, History, User, Check, AlertCircle, Filter, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import type { AuditLogItem, AccessLogItem, Me } from '@/lib/types';

interface LogsViewerProps {
  currentUser: Me;
  activeWorkspaceId?: string | null;
}

export default function LogsViewer({ currentUser, activeWorkspaceId }: LogsViewerProps) {
  const [tab, setTab] = useState<'audit' | 'access'>('audit');

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('All');
  const [auditEntityFilter, setAuditEntityFilter] = useState('All');
  const [auditSearch, setAuditSearch] = useState('');

  // Access logs state
  const [accessLogs, setAccessLogs] = useState<AccessLogItem[]>([]);
  const [accessTotal, setAccessTotal] = useState(0);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessActionFilter, setAccessActionFilter] = useState('All');
  const [accessSearch, setAccessSearch] = useState('');

  // Details expand modal/state
  const [selectedDetails, setSelectedDetails] = useState<Record<string, any> | null>(null);

  // Load audit logs
  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditActionFilter !== 'All') params.set('action', auditActionFilter);
      if (auditEntityFilter !== 'All') params.set('entityType', auditEntityFilter);
      if (auditSearch.trim()) params.set('search', auditSearch.trim());
      if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId);

      const res = await api<{ items: AuditLogItem[]; total: number }>(`/logs/audit?${params.toString()}`);
      setAuditLogs(res.items);
      setAuditTotal(res.total);
    } catch {
      setAuditLogs([]);
      setAuditTotal(0);
    } finally {
      setAuditLoading(false);
    }
  };

  // Load access logs
  const loadAccessLogs = async () => {
    setAccessLoading(true);
    try {
      const params = new URLSearchParams();
      if (accessActionFilter !== 'All') params.set('action', accessActionFilter);
      if (accessSearch.trim()) params.set('search', accessSearch.trim());

      const res = await api<{ items: AccessLogItem[]; total: number }>(`/logs/access?${params.toString()}`);
      setAccessLogs(res.items);
      setAccessTotal(res.total);
    } catch {
      setAccessLogs([]);
      setAccessTotal(0);
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'audit') {
      loadAuditLogs();
    } else {
      loadAccessLogs();
    }
  }, [tab, auditActionFilter, auditEntityFilter, auditSearch, accessActionFilter, accessSearch, activeWorkspaceId]);

  const handleExportCsv = () => {
    const url = `/api/logs/export?type=${tab}`;
    window.open(url, '_blank');
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'APPROVE':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ROLE_CHANGE':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-white/10 rounded-lg text-purple-300">
              <ShieldCheck size={20} />
            </span>
            <span className="text-xs font-semibold tracking-wider text-purple-200 uppercase">
              Regulatory Audit & Evidence Vault
            </span>
          </div>
          <h2 className="text-xl font-bold">Enterprise Access & Data Audit Logs</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Immutable audit trail satisfying ISO 27001 (Control A.12.4) and Bank of Thailand IT Governance. All
            data mutations and authentication transactions are permanently logged.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download size={14} />
            Export {tab === 'audit' ? 'Audit' : 'Access'} CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'audit'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History size={15} />
            Data Audit Trail (Mutations)
            <span className="ml-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
              {auditTotal}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('access')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
              tab === 'access'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <User size={15} />
            Authentication Access Logs
            <span className="ml-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
              {accessTotal}
            </span>
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <label className="search w-full flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-500 text-xs shadow-sm">
                <Search size={15} />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search actor or entity ID…"
                  className="w-full bg-transparent outline-none text-xs text-slate-800"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
                <Filter size={13} />
                Action:
              </div>
              <div className="filter-buttons flex gap-1">
                {['All', 'CREATE', 'UPDATE', 'DELETE', 'ROLE_CHANGE'].map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setAuditActionFilter(act)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${
                      auditActionFilter === act
                        ? 'bg-purple-100 text-purple-800 font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-slate-500 ml-2 mr-1">
                Entity:
              </div>
              <div className="filter-buttons flex gap-1">
                {['All', 'Project', 'Task', 'KnowledgeArticle', 'Workspace'].map((ent) => (
                  <button
                    key={ent}
                    type="button"
                    onClick={() => setAuditEntityFilter(ent)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${
                      auditEntityFilter === ent
                        ? 'bg-purple-100 text-purple-800 font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {ent}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {auditLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">Loading audit records…</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No audit log entries matching your current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Entity</th>
                      <th className="py-3 px-4">Entity ID</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <strong className="block text-slate-800 font-medium">{item.actorName}</strong>
                          <span className="text-[11px] text-slate-400">{item.actorRole}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeClass(
                              item.action
                            )}`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{item.entityType}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 max-w-[150px] truncate" title={item.entityId}>
                          {item.entityId}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetails(item.details || {})}
                            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium text-xs bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition-colors"
                          >
                            <Eye size={12} />
                            Inspect Diff
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Access Logs Table */}
      {tab === 'access' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <label className="search w-full flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-500 text-xs shadow-sm">
                <Search size={15} />
                <input
                  type="text"
                  value={accessSearch}
                  onChange={(e) => setAccessSearch(e.target.value)}
                  placeholder="Search email, IP, or reason…"
                  className="w-full bg-transparent outline-none text-xs text-slate-800"
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-500 mr-1">
                <Filter size={13} />
                Event:
              </div>
              <div className="filter-buttons flex gap-1">
                {['All', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'PASSWORD_CHANGE'].map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setAccessActionFilter(act)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium ${
                      accessActionFilter === act
                        ? 'bg-purple-100 text-purple-800 font-semibold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {act.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {accessLoading ? (
              <div className="py-16 text-center text-xs text-slate-400">Loading access records…</div>
            ) : accessLogs.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No access log entries matching your current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Account Email</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Client User-Agent</th>
                      <th className="py-3 px-4">Result / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accessLogs.map((item) => {
                      const isSuccess = item.action === 'LOGIN_SUCCESS';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{item.email}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isSuccess
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : item.action === 'LOGIN_FAILURE'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              {item.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {item.ipAddress || '127.0.0.1'}
                          </td>
                          <td
                            className="py-3 px-4 text-[11px] text-slate-500 max-w-[200px] truncate"
                            title={item.userAgent}
                          >
                            {item.userAgent || 'unknown'}
                          </td>
                          <td className="py-3 px-4">
                            {item.failureReason ? (
                              <span className="text-rose-700 font-medium text-[11px] bg-rose-50 px-2 py-0.5 rounded">
                                {item.failureReason}
                              </span>
                            ) : isSuccess ? (
                              <span className="text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                                Authorized
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">Transaction Payload Diff & Details</h3>
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96">
              {JSON.stringify(selectedDetails, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
