import React, { useState, useEffect, useMemo } from 'react';
import { 
  File, FileText, Image as ImageIcon, Code, Archive, 
  Trash2, Download, Eye, FileSpreadsheet, 
  Upload, ExternalLink, Search, Loader2, AlertCircle,
  Maximize2, Minimize2
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent } from './components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { cn } from './lib/utils';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { parseCSV } from './lib/csv.mjs';
import readXlsxFile from 'read-excel-file/browser';

export interface ProjectDocumentsProps {
  projectId: string;
  currentUser: { id: string; role: string; name: string };
}

interface Document {
  id: string;
  name: string;
  size: number;
  category: string;
  referenceNo?: string;
  uploadDate: string;
  uploadedById: string;
  uploadedByName: string;
}

export const CATEGORY_MAP: Record<string, string> = {
  CR: 'Change Request (CR)',
  CC: 'Change Control (CC)',
  CRA: 'Cloud Risk Assessment',
  Diagram: 'Architecture Diagram',
  RBAC: 'RBAC Matrix',
  TestEvidence: 'Test Evidence',
  General: 'General',
};

const CATEGORIES = [
  { key: 'All', label: 'All' },
  { key: 'CR', label: 'Change Request (CR)' },
  { key: 'CC', label: 'Change Control (CC)' },
  { key: 'CRA', label: 'Cloud Risk Assessment' },
  { key: 'Diagram', label: 'Architecture Diagram' },
  { key: 'RBAC', label: 'RBAC Matrix' },
  { key: 'TestEvidence', label: 'Test Evidence' },
  { key: 'General', label: 'General' },
];

const UPLOAD_CATEGORIES = CATEGORIES.filter(c => c.key !== 'All');

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FileText className="h-8 w-8 text-red-500" />;
    case 'xls':
    case 'xlsx':
    case 'csv': return <FileSpreadsheet className="h-8 w-8 text-emerald-600" />;
    case 'doc':
    case 'docx': return <FileText className="h-8 w-8 text-blue-500" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg': return <ImageIcon className="h-8 w-8 text-purple-500" />;
    case 'json':
    case 'yaml':
    case 'yml': return <Code className="h-8 w-8 text-slate-500" />;
    case 'zip': return <Archive className="h-8 w-8 text-yellow-500" />;
    default: return <File className="h-8 w-8 text-slate-500" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'CR':
    case 'Change Request (CR)': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200';
    case 'CC':
    case 'Change Control (CC)': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 hover:bg-indigo-200';
    case 'CRA':
    case 'Cloud Risk Assessment': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-200';
    case 'Diagram':
    case 'Architecture Diagram': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200';
    case 'RBAC':
    case 'RBAC Matrix': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 hover:bg-pink-200';
    case 'TestEvidence':
    case 'Test Evidence': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-200';
    default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200';
  }
};

const getColLetter = (idx: number) => {
  let letter = '';
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
};

const renderCellBadge = (val: string) => {
  const lower = val.toLowerCase().trim();
  if (['yes', 'pass', 'approved', 'healthy', 'active', 'true', 'optimal - autoscaling active'].includes(lower)) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{val}</span>;
  }
  if (['no', 'fail', 'blocked', 'danger', 'false', 'rejected'].includes(lower)) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">{val}</span>;
  }
  if (['read only', 'read only global', 'audit', 'warning', 'review needed', 'at risk'].includes(lower)) {
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">{val}</span>;
  }
  return <span>{val}</span>;
};

export default function ProjectDocuments({ projectId, currentUser }: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState(UPLOAD_CATEGORIES[0].key);
  const [uploadRef, setUploadRef] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Preview state
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [sheetData, setSheetData] = useState<string[][] | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSearch, setSheetSearch] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`);
      if (res.ok) {
        const data = await res.json();
        const mapped = data.map((d: any) => ({
          id: d.id,
          name: d.originalName || d.name,
          size: d.sizeBytes ?? d.size ?? 0,
          category: d.category,
          referenceNo: d.referenceNo,
          uploadDate: d.createdAt || d.uploadDate || new Date().toISOString(),
          uploadedById: d.uploadedById,
          uploadedByName: d.uploadedBy?.name || d.uploadedByName || 'Team member',
        }));
        setDocuments(mapped);
      }
    } catch (e) {
      console.error('Failed to fetch documents', e);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Handle spreadsheet loading
  useEffect(() => {
    if (!previewDoc) {
      setSheetData(null);
      setSheetError(null);
      setSheetSearch('');
      return;
    }

    const ext = previewDoc.name.split('.').pop()?.toLowerCase() || '';
    const isSpreadsheet = ['csv', 'xlsx', 'xls'].includes(ext);

    if (isSpreadsheet) {
      let cancelled = false;
      setSheetLoading(true);
      setSheetError(null);
      setSheetData(null);

      const loadSpreadsheet = async () => {
        try {
          const res = await fetch(`/api/project-documents/${previewDoc.id}/preview`);
          if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch document content`);

          if (ext === 'csv') {
            const text = await res.text();
            if (cancelled) return;
            const parsed = parseCSV(text);
            if (parsed.length === 0) throw new Error('CSV file contains no data');
            setSheetData(parsed);
          } else {
            // Excel (.xlsx, .xls)
            const blob = await res.blob();
            if (cancelled) return;
            const parsed = await readXlsxFile(blob);
            
            const rawRows = (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object' && 'data' in parsed[0])
              ? (parsed[0] as any).data
              : (Array.isArray(parsed) ? parsed : []);

            if (!rawRows || rawRows.length === 0) {
              throw new Error('Spreadsheet contains no rows');
            }

            const stringRows: string[][] = rawRows.map((row: any[]) => 
              (row || []).map(cell => cell === null || cell === undefined ? '' : String(cell))
            );
            setSheetData(stringRows);
          }
        } catch (err: any) {
          if (cancelled) return;
          console.error('Spreadsheet preview error:', err);
          setSheetError(err.message || 'Unable to parse spreadsheet');
        } finally {
          if (!cancelled) setSheetLoading(false);
        }
      };

      loadSpreadsheet();
      return () => { cancelled = true; };
    }
  }, [previewDoc]);

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`/api/project-documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments(docs => docs.filter(d => d.id !== docId));
      }
    } catch (e) {
      console.error('Failed to delete document', e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('category', uploadCategory);
    if (uploadRef) formData.append('referenceNo', uploadRef);

    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadRef('');
        fetchDocuments();
      }
    } catch (e) {
      console.error('Upload failed', e);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = activeCategory === 'All' 
    ? documents 
    : documents.filter(d => d.category === activeCategory);

  const canUpload = currentUser.role !== 'auditor';

  const isPreviewable = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['pdf', 'svg', 'png', 'jpg', 'jpeg', 'csv', 'xlsx', 'xls'].includes(ext || '');
  };

  // Spreadsheet headers and filtered rows
  const sheetHeaders = useMemo(() => {
    return sheetData && sheetData.length > 0 ? sheetData[0] : [];
  }, [sheetData]);

  const sheetBodyRows = useMemo(() => {
    return sheetData && sheetData.length > 1 ? sheetData.slice(1) : [];
  }, [sheetData]);

  const filteredSheetRows = useMemo(() => {
    const q = sheetSearch.toLowerCase().trim();
    if (!q) return sheetBodyRows;
    return sheetBodyRows.filter(row => 
      row.some(cell => cell.toLowerCase().includes(q))
    );
  }, [sheetBodyRows, sheetSearch]);

  const previewExt = previewDoc?.name.split('.').pop()?.toLowerCase() || '';

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                ${activeCategory === cat.key 
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        
        {canUpload && (
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger render={<Button className="shrink-0" />}>
              <>
                <Upload className="mr-2 h-4 w-4" /> Upload Document
              </>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="file">File (Max 25MB)</Label>
                  <Input 
                    id="file"
                    type="file" 
                    accept=".pdf,.xls,.xlsx,.doc,.docx,.png,.jpg,.jpeg,.svg,.csv,.zip,.yaml,.json"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select 
                    id="category"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-slate-300"
                    value={uploadCategory} 
                    onChange={e => setUploadCategory(e.target.value)}
                  >
                    {UPLOAD_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference No (Optional)</Label>
                  <Input 
                    id="reference"
                    placeholder="e.g. CR-2026-004" 
                    value={uploadRef}
                    onChange={e => setUploadRef(e.target.value)}
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={!uploadFile || isUploading}>
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredDocs.map(doc => {
          const canDelete = currentUser.role === 'admin' || doc.uploadedById === currentUser.id;
          
          return (
            <Card key={doc.id} className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition-shadow">
              <CardContent className="p-4 flex gap-4">
                <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  {getFileIcon(doc.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate" title={doc.name}>
                    {doc.name}
                  </p>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                    <span>{formatBytes(doc.size)}</span>
                    <span>&bull;</span>
                    <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary" className={`text-[10px] font-medium border-transparent ${getCategoryColor(doc.category)}`}>
                      {CATEGORY_MAP[doc.category] || doc.category}
                    </Badge>
                    {doc.referenceNo && (
                      <Badge variant="outline" className="text-[10px] font-mono font-medium border-slate-200 dark:border-slate-700">
                        {doc.referenceNo}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Uploaded by <span className="font-medium text-slate-700 dark:text-slate-300">{doc.uploadedByName}</span>
                  </div>
                </div>
              </CardContent>
              <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                {isPreviewable(doc.name) && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setPreviewDoc(doc)}>
                    <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                    <span className="hidden sm:inline-block">Preview</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5" render={<a href={`/api/project-documents/${doc.id}/download`} download />}>
                  <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  <span className="hidden sm:inline-block">Download</span>
                </Button>
                {canDelete && currentUser.role !== 'auditor' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950" 
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        
        {filteredDocs.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/20">
            <Archive className="h-10 w-10 text-slate-400 mb-3" />
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">No documents found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              {activeCategory === 'All' 
                ? 'There are no documents uploaded for this project yet.'
                : `There are no documents in the "${activeCategory}" category.`}
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) { setPreviewDoc(null); setIsMaximized(false); } }}>
        <DialogContent className={cn("document-preview-dialog flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-slate-200 dark:border-slate-800 transition-all duration-150", isMaximized && "is-maximized")}>
          <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                {previewDoc && getFileIcon(previewDoc.name)}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-semibold truncate flex items-center gap-2">
                  <span className="truncate">{previewDoc?.name}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  {previewDoc && (
                    <>
                      <Badge variant="secondary" className={`text-[10px] py-0 px-1.5 font-medium ${getCategoryColor(previewDoc.category)}`}>
                        {CATEGORY_MAP[previewDoc.category] || previewDoc.category}
                      </Badge>
                      <span>&bull;</span>
                      <span>{formatBytes(previewDoc.size)}</span>
                      {previewDoc.referenceNo && (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400">{previewDoc.referenceNo}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pr-8">
              {previewDoc && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 text-xs font-normal" 
                    onClick={() => setIsMaximized(!isMaximized)}
                    title={isMaximized ? "Restore size" : "Maximize view"}
                  >
                    {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{isMaximized ? "Restore" : "Maximize"}</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 text-xs font-normal" 
                    render={<a href={`/api/project-documents/${previewDoc.id}/preview`} target="_blank" rel="noopener noreferrer" />}
                    title="Open in new window"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New tab</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 text-xs font-normal" 
                    render={<a href={`/api/project-documents/${previewDoc.id}/download`} download />}
                    title="Download file"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900 relative overflow-hidden flex flex-col">
            {previewExt === 'pdf' ? (
              <iframe 
                src={`/api/project-documents/${previewDoc?.id}/preview#view=FitH`}
                className="w-full h-full border-0 bg-white dark:bg-slate-900"
                title={previewDoc?.name}
              />
            ) : ['csv', 'xlsx', 'xls'].includes(previewExt) ? (
              // Spreadsheet Viewer
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-950">
                {sheetLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <p className="text-sm font-medium">Parsing spreadsheet data...</p>
                  </div>
                ) : sheetError ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Unable to preview spreadsheet</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-md">{sheetError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4 gap-1.5"
                      render={<a href={`/api/project-documents/${previewDoc?.id}/download`} download />}
                    >
                      <Download className="h-3.5 w-3.5" /> Download file instead
                    </Button>
                  </div>
                ) : sheetData && sheetData.length > 0 ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Toolbar */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search in spreadsheet rows..."
                          value={sheetSearch}
                          onChange={e => setSheetSearch(e.target.value)}
                          className="pl-8 h-8 text-xs bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        Showing {filteredSheetRows.length} rows &bull; {sheetHeaders.length} columns
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-sm">
                          <tr>
                            <th className="w-12 px-2.5 py-2 text-center text-slate-400 font-mono text-[10px] border-b border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 select-none">
                              #
                            </th>
                            {sheetHeaders.map((header, idx) => (
                              <th 
                                key={idx} 
                                className="px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-200 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap"
                              >
                                <span className="text-[10px] font-mono text-slate-400 block -mb-0.5">{getColLetter(idx)}</span>
                                {header || `Col ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredSheetRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                              <td className="w-12 px-2.5 py-2 text-center font-mono text-[10px] text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 border-r border-slate-200 dark:border-slate-800 select-none">
                                {rIdx + 1}
                              </td>
                              {sheetHeaders.map((_, cIdx) => {
                                const val = row[cIdx] || '';
                                return (
                                  <td 
                                    key={cIdx} 
                                    className="px-3.5 py-2 border-r border-slate-100 dark:border-slate-800/50 text-slate-800 dark:text-slate-200 max-w-sm truncate font-sans"
                                    title={val}
                                  >
                                    {renderCellBadge(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    The spreadsheet contains no data.
                  </div>
                )}
              </div>
            ) : previewDoc ? (
              // Image Viewer
              <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-slate-900/5">
                <img 
                  src={`/api/project-documents/${previewDoc.id}/preview`}
                  alt={previewDoc.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-md border border-slate-200 dark:border-slate-800"
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
