import React, { useState, useEffect } from 'react';
import { 
  File, FileText, Image as ImageIcon, Code, Archive, 
  Trash2, Download, Eye, FileSpreadsheet, 
  Upload
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent } from './components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

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
    case 'csv': return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
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
    return ['pdf', 'svg', 'png', 'jpg', 'jpeg'].includes(ext || '');
  };

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
            <Card key={doc.id} className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
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
                      <Badge variant="outline" className="text-[10px] font-medium border-slate-200 dark:border-slate-700">
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
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline-block">Preview</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-8 gap-1.5" render={<a href={`/api/project-documents/${doc.id}/download`} download />}>
                  <Download className="h-3.5 w-3.5" />
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

      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl w-full h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <DialogTitle className="flex justify-between items-center text-base">
              <span className="truncate pr-8">{previewDoc?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900 relative">
            {previewDoc?.name.toLowerCase().endsWith('.pdf') ? (
              <iframe 
                src={`/api/project-documents/${previewDoc.id}/download#view=FitH`}
                className="w-full h-full border-0"
                title={previewDoc.name}
              />
            ) : previewDoc ? (
              <div className="w-full h-full flex items-center justify-center p-6">
                <img 
                  src={`/api/project-documents/${previewDoc.id}/download`}
                  alt={previewDoc.name}
                  className="max-w-full max-h-full object-contain rounded shadow-sm"
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
