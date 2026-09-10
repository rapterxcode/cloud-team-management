import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CheckIcon, XIcon, ShieldAlertIcon, FileTextIcon, SearchIcon } from 'lucide-react';

interface ComplianceMatrixProps {
  projects: Array<{ id: string; name: string; department: string; status: string }>;
  onSelectProject?: (projectId: string, tab?: string) => void;
  currentUser: { id: string; role: string; name: string };
}

interface MatrixData {
  projectId: string;
  cra: boolean;
  archDiagram: boolean;
  rbac: boolean;
  changeControl: boolean;
  deploymentLinked: number;
  deploymentTotal: number;
  readinessScore: number;
}

export function ComplianceMatrix({ projects, onSelectProject, currentUser }: ComplianceMatrixProps) {
  const [matrix, setMatrix] = useState<Record<string, MatrixData>>({});
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    // Simulate fetching from /api/compliance/matrix
    // In a real implementation, we would fetch and then update the state
    // For now, calculate dynamically with deterministic pseudo-random values based on project id
    const newMatrix: Record<string, MatrixData> = {};
    projects.forEach((p, idx) => {
      // Deterministic values for demo purposes
      const cra = idx % 2 === 0 || p.status === 'active';
      const archDiagram = idx % 3 !== 0;
      const rbac = idx % 4 !== 0;
      const changeControl = idx % 5 !== 0;
      const deploymentTotal = 4;
      const deploymentLinked = idx % 2 === 0 ? 4 : 2;
      
      const booleans = [cra, archDiagram, rbac, changeControl].filter(Boolean).length;
      const readinessScore = Math.round(((booleans + (deploymentLinked / deploymentTotal)) / 5) * 100);

      newMatrix[p.id] = {
        projectId: p.id,
        cra,
        archDiagram,
        rbac,
        changeControl,
        deploymentLinked,
        deploymentTotal,
        readinessScore,
      };
    });
    setMatrix(newMatrix);
  }, [projects]);

  const departments = useMemo(() => Array.from(new Set(projects.map(p => p.department))), [projects]);

  const filteredProjects = projects.filter(p => {
    const data = matrix[p.id];
    if (!data) return false;

    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.department.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'All' || p.department === deptFilter;
    
    let matchStatus = true;
    if (statusFilter === 'Audit Ready') {
      matchStatus = data.readinessScore === 100;
    } else if (statusFilter === 'Action Required') {
      matchStatus = data.readinessScore < 100;
    }

    return matchSearch && matchDept && matchStatus;
  });

  const kpis = useMemo(() => {
    const dataVals = Object.values(matrix);
    if (dataVals.length === 0) return { total: projects.length, ready: 0, pending: 0, avgScore: 0 };
    
    const ready = dataVals.filter(d => d.readinessScore === 100).length;
    const avgScore = dataVals.reduce((acc, d) => acc + d.readinessScore, 0) / dataVals.length;

    return {
      total: projects.length,
      ready,
      pending: projects.length - ready,
      avgScore: Math.round(avgScore)
    };
  }, [projects.length, matrix]);

  const CheckpointBadge = ({ met }: { met: boolean }) => {
    if (met) {
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200"><CheckIcon className="w-3 h-3 mr-1" /> Yes</Badge>;
    }
    return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200"><XIcon className="w-3 h-3 mr-1" /> Missing</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {currentUser.role === 'auditor' && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-lg flex items-center gap-3">
          <ShieldAlertIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium">
            🛡️ Compliance Inspector Mode (Read-Only) — ISO 27001 & Bank of Thailand (BOT) Segregation of Duties active. Editing and deletion controls are restricted.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Central Compliance Matrix</h1>
        <p className="text-muted-foreground text-sm">Overview of cloud project compliance, documentation, and traceability.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cloud Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Audit-Ready Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{kpis.ready}</div>
            <p className="text-xs text-muted-foreground mt-1">100% checkpoints met</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{kpis.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Missing documentation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis.avgScore}%</div>
            <Progress value={kpis.avgScore} className="h-2 mt-3">
              <ProgressTrack />
              <ProgressIndicator />
            </Progress>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <CardTitle className="text-lg">Project Readiness</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative w-64">
                <SearchIcon className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search projects..." 
                  className="pl-8" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={deptFilter} onValueChange={(val) => setDeptFilter(val ?? 'All')}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'All')}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Audit Ready">Audit Ready</SelectItem>
                  <SelectItem value="Action Required">Action Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Project & Dept</TableHead>
                <TableHead className="text-center">CRA</TableHead>
                <TableHead className="text-center">Arch Diagram</TableHead>
                <TableHead className="text-center">RBAC Matrix</TableHead>
                <TableHead className="text-center">Change Control</TableHead>
                <TableHead className="text-center">Traceability</TableHead>
                <TableHead className="text-center w-[150px]">Readiness</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map(p => {
                const data = matrix[p.id];
                if (!data) return null;
                
                const fullyLinked = data.deploymentLinked === data.deploymentTotal;

                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.department}</div>
                    </TableCell>
                    <TableCell className="text-center"><CheckpointBadge met={data.cra} /></TableCell>
                    <TableCell className="text-center"><CheckpointBadge met={data.archDiagram} /></TableCell>
                    <TableCell className="text-center"><CheckpointBadge met={data.rbac} /></TableCell>
                    <TableCell className="text-center"><CheckpointBadge met={data.changeControl} /></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={fullyLinked ? "default" : "destructive"} className={fullyLinked ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}>
                        {fullyLinked ? `${data.deploymentLinked}/${data.deploymentTotal} tasks linked` : `Warning: ${data.deploymentTotal - data.deploymentLinked} unlinked`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-between gap-2">
                        <Progress value={data.readinessScore} className="h-2 flex-1">
                          <ProgressTrack />
                          <ProgressIndicator className={data.readinessScore === 100 ? "bg-green-500" : "bg-primary"} />
                        </Progress>
                        <span className="text-xs font-semibold">{data.readinessScore}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => onSelectProject?.(p.id, 'documents')}>
                        <FileTextIcon className="w-4 h-4 mr-1" /> Files
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No projects found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
