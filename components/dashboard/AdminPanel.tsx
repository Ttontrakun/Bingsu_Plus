import React, { useEffect, useMemo, useState } from 'react';
import { Document, User } from '../../types';

interface AdminPanelProps {
  user: User;
  adminMetrics: {
    usersCount: number;
    documentsCount: number;
    conversationsCount: number;
    messagesCount: number;
    uploadBatchesCount: number;
    pendingUsersCount: number;
    botsCount: number;
    timestamp: string;
  } | null;
  healthStatus: {
    ok: boolean;
    database?: { ok: boolean; error?: string };
    redis?: { ok: boolean; enabled?: boolean; error?: string };
    qdrant?: { ok: boolean; error?: string };
  } | null;
  adminUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    counts: { documents: number; conversations: number; messages: number; bots: number };
  }>;
  adminDocuments: Document[];
  adminBots: Array<{
    id: string;
    name: string;
    prompt: string;
    createdAt: string;
    updatedAt: string;
    owner: { id: string; name: string; email: string };
    documents: { id: string; displayName: string }[];
  }>;
  adminUploadBatches: Array<{
    id: string;
    displayName: string;
    status: string;
    progressCurrent: number;
    progressTotal: number;
    progressMessage?: string;
    progressFileName?: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  adminLoading: boolean;
  adminError: string | null;
  supportPendingUsers: Array<{ id: string; name: string; email: string; createdAt: string }>;
  supportLogs: Array<{ id: string; level: string; message: string; meta?: unknown; createdAt: string }>;
  onLoadAdminData: () => Promise<void>;
  onLoadSupportData: () => Promise<void>;
  onSupportApproval: (userId: string, status: 'approved' | 'rejected') => Promise<void>;
  onDownloadSupportReport: () => Promise<any>;
  onAdminUpdateUser: (userId: string, data: { role?: string; isActive?: boolean }) => Promise<void>;
  onAdminDeleteUser: (userId: string) => Promise<void>;
  onAdminDeleteDocument: (documentId: string) => Promise<void>;
  onAdminDeleteBot: (botId: string) => Promise<void>;
  onAdminBackup: () => Promise<any>;
  onAdminRestore: (payload: any) => Promise<void>;
  openConfirmDialog: (dialog: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  adminMetrics,
  adminUsers,
  adminDocuments,
  adminBots,
  adminUploadBatches,
  healthStatus,
  adminLoading,
  adminError,
  supportPendingUsers,
  supportLogs,
  onLoadAdminData,
  onLoadSupportData,
  onSupportApproval,
  onDownloadSupportReport,
  onAdminUpdateUser,
  onAdminDeleteUser,
  onAdminDeleteDocument,
  onAdminDeleteBot,
  onAdminBackup,
  onAdminRestore,
  openConfirmDialog,
}) => {
  const [adminSection, setAdminSection] = useState<'overview' | 'approvals' | 'users' | 'documents' | 'bots' | 'logs'>('overview');
  const [adminIndicator, setAdminIndicator] = useState({ left: 0, width: 0 });
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminUserStatusFilter, setAdminUserStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [adminUserSort, setAdminUserSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'active_first'>('created_desc');
  const [adminDocumentSearch, setAdminDocumentSearch] = useState('');
  const [adminDocumentSort, setAdminDocumentSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [adminBotSearch, setAdminBotSearch] = useState('');
  const [adminBotSort, setAdminBotSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [approvalBusy, setApprovalBusy] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isDownloadingSupportReport, setIsDownloadingSupportReport] = useState(false);
  const [supportReportError, setSupportReportError] = useState<string | null>(null);

  const canManage = user.role === 'admin';
  const canSupport = user.role === 'support' || user.role === 'admin';
  const canMetrics = ['admin', 'support', 'admin_metrics'].includes(user.role ?? 'user');
  const adminSections = useMemo(() => {
    const sections: Array<{ id: 'overview' | 'approvals' | 'users' | 'documents' | 'bots' | 'logs'; label: string }> = [];
    if (canMetrics) sections.push({ id: 'overview', label: 'Overview' });
    if (canSupport) sections.push({ id: 'approvals', label: 'Pending approvals' });
    if (canManage) sections.push({ id: 'users', label: 'Users' });
    if (canManage) sections.push({ id: 'documents', label: 'Documents' });
    if (canManage) sections.push({ id: 'bots', label: 'Bots' });
    if (canSupport) sections.push({ id: 'logs', label: 'Logs' });
    return sections;
  }, [canManage, canSupport, canMetrics]);

  useEffect(() => {
    if (!adminSections.length) return;
    if (!adminSections.some((section) => section.id === adminSection)) {
      setAdminSection(adminSections[0].id);
    }
  }, [adminSections, adminSection]);

  useEffect(() => {
    const parent = document.querySelector("[data-admin-tabs]");
    if (!parent) return;
    const activeButton = parent.querySelector("[data-admin-tab='active']");
    if (!(activeButton instanceof HTMLElement)) return;
    const parentRect = parent.getBoundingClientRect();
    const targetRect = activeButton.getBoundingClientRect();
    setAdminIndicator({
      left: targetRect.left - parentRect.left + parent.scrollLeft,
      width: targetRect.width,
    });
  }, [adminSection, adminSections.length]);

  const handleRefresh = async () => {
    await onLoadAdminData();
    await onLoadSupportData();
  };

  const handleAdminBackup = async () => {
    try {
      setIsBackingUp(true);
      const data = await onAdminBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleAdminRestore = async (file: File) => {
    try {
      setIsRestoring(true);
      setRestoreError(null);
      const payload = await file.text();
      await onAdminRestore(JSON.parse(payload));
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSupportReportDownload = async () => {
    try {
      setIsDownloadingSupportReport(true);
      setSupportReportError(null);
      const data = await onDownloadSupportReport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `support-report-${new Date().toISOString().split("T")[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSupportReportError(error instanceof Error ? error.message : "Failed to download report");
    } finally {
      setIsDownloadingSupportReport(false);
    }
  };

  const userQuery = adminUserSearch.trim().toLowerCase();
  const filteredAdminUsers = adminUsers
    .filter((adminUser) => {
      if (!userQuery) return true;
      return [adminUser.id, adminUser.name, adminUser.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(userQuery));
    })
    .filter((adminUser) => {
      if (adminUserStatusFilter === 'all') return true;
      return adminUserStatusFilter === 'active' ? adminUser.isActive : !adminUser.isActive;
    })
    .slice()
    .sort((a, b) => {
      const labelA = (a.name || a.email || a.id).toLowerCase();
      const labelB = (b.name || b.email || b.id).toLowerCase();
      const nameCompare = labelA.localeCompare(labelB, 'th', { sensitivity: 'base' });
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      switch (adminUserSort) {
        case 'created_asc':
          return createdA - createdB;
        case 'created_desc':
          return createdB - createdA;
        case 'name_desc':
          return -nameCompare;
        case 'name_asc':
          return nameCompare;
        case 'active_first':
          return Number(b.isActive) - Number(a.isActive) || nameCompare;
        default:
          return 0;
      }
    });

  const documentQuery = adminDocumentSearch.trim().toLowerCase();
  const filteredAdminDocuments = adminDocuments
    .filter((doc) => {
      if (!documentQuery) return true;
      return [doc.displayName, doc.owner?.name, doc.owner?.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(documentQuery));
    })
    .slice()
    .sort((a, b) => {
      const nameCompare = a.displayName.localeCompare(b.displayName, 'th', { sensitivity: 'base' });
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      switch (adminDocumentSort) {
        case 'created_asc':
          return createdA - createdB;
        case 'created_desc':
          return createdB - createdA;
        case 'name_desc':
          return -nameCompare;
        case 'name_asc':
          return nameCompare;
        default:
          return 0;
      }
    });

  const botQuery = adminBotSearch.trim().toLowerCase();
  const filteredAdminBots = adminBots
    .filter((bot) => {
      if (!botQuery) return true;
      return [bot.name, bot.prompt, bot.owner?.name, bot.owner?.email, bot.owner?.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(botQuery));
    })
    .slice()
    .sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name, 'th', { sensitivity: 'base' });
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      switch (adminBotSort) {
        case 'created_asc':
          return createdA - createdB;
        case 'created_desc':
          return createdB - createdA;
        case 'name_desc':
          return -nameCompare;
        case 'name_asc':
          return nameCompare;
        default:
          return 0;
      }
    });

  const title = user.role === 'support' ? 'Support panel' : 'Admin panel';
  const subtitle = user.role === 'support'
    ? 'Review registrations and system logs.'
    : 'Manage users, documents, and uploads.';
  const renderHealthItem = (label: string, ok?: boolean, meta?: string) => {
    const statusColor = ok ? 'bg-green-500' : 'bg-red-500';
    const statusLabel = ok ? 'OK' : 'Down';
    return (
      <div className="flex items-center justify-between rounded-lg border border-gem-mist/40 bg-gem-slate px-3 py-2 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gem-offwhite/60">{label}</p>
          {meta && <p className="text-xs text-gem-offwhite/50">{meta}</p>}
        </div>
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          {statusLabel}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="text-sm text-gem-offwhite/60">{subtitle}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
          disabled={adminLoading}
        >
          {adminLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {adminError && <p className="text-red-400 text-sm">{adminError}</p>}

      {(canSupport || canManage) && (
        <div className="border-b border-gem-mist/40 relative">
          <div className="flex items-center gap-6 overflow-x-auto" data-admin-tabs>
            {adminSections.map((section) => (
              <button
                key={section.id}
                onClick={(event) => {
                  setAdminSection(section.id);
                  const target = event.currentTarget;
                  const parent = target.parentElement;
                  if (parent) {
                    const parentRect = parent.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    setAdminIndicator({
                      left: targetRect.left - parentRect.left + parent.scrollLeft,
                      width: targetRect.width,
                    });
                  }
                }}
                data-admin-tab={adminSection === section.id ? 'active' : 'inactive'}
                className={`pb-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  adminSection === section.id
                    ? 'border-gem-blue text-white'
                    : 'border-transparent text-gem-offwhite/60 hover:text-white'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
          <span
            className="absolute -bottom-px h-0.5 bg-gem-blue transition-all duration-300"
            style={{ left: adminIndicator.left, width: adminIndicator.width }}
          />
        </div>
      )}

      {adminSection === 'overview' && canMetrics && (
        <div className="space-y-4">
          {healthStatus && (
            <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">System health</h3>
                <span className={`text-xs font-semibold ${healthStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {healthStatus.ok ? 'Healthy' : 'Degraded'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {renderHealthItem('Database', healthStatus.database?.ok, healthStatus.database?.error)}
                {renderHealthItem(
                  'Redis',
                  healthStatus.redis?.enabled ? healthStatus.redis?.ok : true,
                  healthStatus.redis?.enabled ? healthStatus.redis?.error : 'Not enabled',
                )}
                {renderHealthItem('Qdrant', healthStatus.qdrant?.ok, healthStatus.qdrant?.error)}
              </div>
            </div>
          )}

          {adminMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
              {[
                { label: 'Users', value: adminMetrics.usersCount },
                { label: 'Documents', value: adminMetrics.documentsCount },
                { label: 'Conversations', value: adminMetrics.conversationsCount },
                { label: 'Messages', value: adminMetrics.messagesCount },
                { label: 'Upload batches', value: adminMetrics.uploadBatchesCount },
                { label: 'Pending approvals', value: adminMetrics.pendingUsersCount },
                { label: 'Bots', value: adminMetrics.botsCount },
              ].map((item) => (
                <div key={item.label} className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4">
                  <p className="text-xs text-gem-offwhite/60 uppercase tracking-wide">{item.label}</p>
                  <p className="text-2xl font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4">
              <p className="text-sm text-gem-offwhite/60">No metrics loaded yet. Click Refresh.</p>
            </div>
          )}
        </div>
      )}

      {!canManage && !canSupport && (
        <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4">
          <p className="text-sm text-gem-offwhite/60">
            This account has metrics-only access. User, document, and upload management are hidden.
          </p>
        </div>
      )}

      {adminSection === 'approvals' && canSupport && (
        <div className="space-y-4">
          <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pending approvals</h3>
              <span className="text-xs text-gem-offwhite/60">
                Pending: {adminMetrics?.pendingUsersCount ?? supportPendingUsers.length}
              </span>
            </div>
            <p className="text-xs text-gem-offwhite/60">New registrations must be approved before they can log in.</p>
            {approvalError && <p className="text-sm text-red-400">{approvalError}</p>}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {supportPendingUsers.length === 0 ? (
                <p className="text-sm text-gem-offwhite/60">No pending users.</p>
              ) : (
                supportPendingUsers.map((pending) => (
                  <div key={pending.id} className="flex flex-wrap items-center justify-between gap-3 bg-gem-mist/20 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gem-offwhite/60 truncate">User ID</p>
                      <p className="text-sm font-semibold truncate">{pending.id}</p>
                      <p className="text-xs text-gem-offwhite/60">{pending.name || 'No name'}</p>
                      <p className="text-xs text-gem-offwhite/60 truncate">{pending.email}</p>
                      <p className="text-xs text-gem-offwhite/60">
                        {new Date(pending.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          openConfirmDialog({
                            title: 'Approve user',
                            message: `Approve user ${pending.id}?`,
                            confirmLabel: 'Approve',
                              onConfirm: async () => {
                                setApprovalError(null);
                                setApprovalBusy({ id: pending.id, status: 'approved' });
                                try {
                                  await onSupportApproval(pending.id, 'approved');
                                } catch (error) {
                                  setApprovalError(error instanceof Error ? error.message : 'Failed to approve user.');
                                } finally {
                                  setApprovalBusy(null);
                                }
                              },
                          })
                        }
                        className="px-3 py-1 rounded-md text-sm font-semibold bg-green-500/80 hover:bg-green-500 text-white"
                          disabled={approvalBusy?.id === pending.id}
                      >
                          {approvalBusy?.id === pending.id && approvalBusy.status === 'approved' ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() =>
                          openConfirmDialog({
                            title: 'Reject user',
                            message: `Reject user ${pending.id}?`,
                            confirmLabel: 'Reject',
                              onConfirm: async () => {
                                setApprovalError(null);
                                setApprovalBusy({ id: pending.id, status: 'rejected' });
                                try {
                                  await onSupportApproval(pending.id, 'rejected');
                                } catch (error) {
                                  setApprovalError(error instanceof Error ? error.message : 'Failed to reject user.');
                                } finally {
                                  setApprovalBusy(null);
                                }
                              },
                          })
                        }
                        className="px-3 py-1 rounded-md text-sm font-semibold bg-red-500/80 hover:bg-red-500 text-white"
                          disabled={approvalBusy?.id === pending.id}
                      >
                          {approvalBusy?.id === pending.id && approvalBusy.status === 'rejected' ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {adminSection === 'users' && canManage && (
        <div className="space-y-4">
          {canManage && (
            <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold">Users</h3>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={adminUserSearch}
                  onChange={(event) => setAdminUserSearch(event.target.value)}
                  placeholder="Search by name, email, or id"
                  className="w-full max-w-md rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite placeholder:text-gem-offwhite/40"
                />
                <select
                  value={adminUserStatusFilter}
                  onChange={(event) => setAdminUserStatusFilter(event.target.value as 'all' | 'active' | 'disabled')}
                  className="rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite"
                >
                  <option value="all">All users</option>
                  <option value="active">Active only</option>
                  <option value="disabled">Disabled only</option>
                </select>
                <select
                  value={adminUserSort}
                  onChange={(event) =>
                    setAdminUserSort(
                      event.target.value as 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'active_first',
                    )
                  }
                  className="rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite"
                >
                  <option value="created_desc">Newest first</option>
                  <option value="created_asc">Oldest first</option>
                  <option value="name_asc">Name A-Z / ก-ฮ</option>
                  <option value="name_desc">Name Z-A / ฮ-ก</option>
                  <option value="active_first">Active first</option>
                </select>
              </div>
              <div className="space-y-2">
                {filteredAdminUsers.length === 0 ? (
                  <p className="text-sm text-gem-offwhite/60">No users found.</p>
                ) : (
                  filteredAdminUsers.map((adminUser) => (
                    <div key={adminUser.id} className="flex flex-wrap items-center justify-between gap-3 bg-gem-mist/20 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gem-offwhite/60 truncate">User ID</p>
                        <p className="text-sm font-semibold truncate">{adminUser.id}</p>
                        <p className="text-xs text-gem-offwhite/60">{adminUser.name}</p>
                        <p className="text-xs text-gem-offwhite/60 truncate">{adminUser.email}</p>
                        <p className="text-xs text-gem-offwhite/60">
                          Docs {adminUser.counts.documents} · Bots {adminUser.counts.bots}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={adminUser.role}
                          onChange={(event) => {
                            const nextRole = event.target.value;
                            openConfirmDialog({
                              title: 'Change role',
                              message: `Change role for ${adminUser.id} to "${nextRole}"?`,
                              confirmLabel: 'Change role',
                              onConfirm: () => onAdminUpdateUser(adminUser.id, { role: nextRole }),
                            });
                          }}
                          className="bg-gem-mist border border-gem-mist/50 rounded-md px-2 py-1 text-sm"
                        >
                          <option value="user">user</option>
                          <option value="support">support</option>
                          <option value="admin_metrics">admin_metrics</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          onClick={() =>
                            openConfirmDialog({
                              title: adminUser.isActive ? 'Disable user' : 'Enable user',
                              message: `${adminUser.isActive ? 'Disable' : 'Enable'} user ${adminUser.id}?`,
                              confirmLabel: adminUser.isActive ? 'Disable' : 'Enable',
                              onConfirm: () => onAdminUpdateUser(adminUser.id, { isActive: !adminUser.isActive }),
                            })
                          }
                          className={`px-3 py-1 rounded-md text-sm font-semibold ${
                            adminUser.isActive
                              ? 'bg-green-500/80 hover:bg-green-500 text-white'
                              : 'bg-red-500/80 hover:bg-red-500 text-white'
                          }`}
                        >
                          {adminUser.isActive ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          onClick={() =>
                            openConfirmDialog({
                              title: 'Delete user',
                              message: `Delete user ${adminUser.email || adminUser.id}? This will remove all their data.`,
                              confirmLabel: 'Delete',
                              onConfirm: () => onAdminDeleteUser(adminUser.id),
                            })
                          }
                          className="px-3 py-1 rounded-md text-sm font-semibold bg-red-600/80 hover:bg-red-600 text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {canManage && (
            <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold">Backup & restore</h3>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAdminBackup}
                  className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
                  disabled={isBackingUp}
                >
                  {isBackingUp ? 'Preparing...' : 'Download backup'}
                </button>
                <label className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 text-gem-offwhite cursor-pointer font-semibold">
                  {isRestoring ? 'Restoring...' : 'Restore backup'}
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleAdminRestore(file);
                      }
                    }}
                    disabled={isRestoring}
                  />
                </label>
              </div>
              {restoreError && <p className="text-red-400 text-sm">{restoreError}</p>}
            </div>
          )}
        </div>
      )}

      {adminSection === 'documents' && canManage && (
        <div className="space-y-4">
          <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold">Documents</h3>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={adminDocumentSearch}
                onChange={(event) => setAdminDocumentSearch(event.target.value)}
                placeholder="Search by name or owner"
                className="w-full max-w-md rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite placeholder:text-gem-offwhite/40"
              />
              <select
                value={adminDocumentSort}
                onChange={(event) =>
                  setAdminDocumentSort(event.target.value as 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc')
                }
                className="rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite"
              >
                <option value="created_desc">Newest first</option>
                <option value="created_asc">Oldest first</option>
                <option value="name_asc">Name A-Z / ก-ฮ</option>
                <option value="name_desc">Name Z-A / ฮ-ก</option>
              </select>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {filteredAdminDocuments.length === 0 ? (
                <p className="text-sm text-gem-offwhite/60">No documents found.</p>
              ) : (
                filteredAdminDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 bg-gem-mist/20 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{doc.displayName}</p>
                      <p className="text-xs text-gem-offwhite/60 truncate">
                        Owner ID: {doc.owner?.id ?? 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        openConfirmDialog({
                          title: 'Delete document',
                          message: `Delete document "${doc.displayName}"? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          onConfirm: () => onAdminDeleteDocument(doc.id),
                        })
                      }
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold">Upload batches</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {adminUploadBatches.length === 0 ? (
                <p className="text-sm text-gem-offwhite/60">No uploads found.</p>
              ) : (
                adminUploadBatches.map((batch) => (
                  <div key={batch.id} className="bg-gem-mist/20 rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold">{batch.displayName}</p>
                    <p className="text-xs text-gem-offwhite/60">
                      User ID: {batch.user?.id} · {batch.status} · {batch.progressCurrent}/{batch.progressTotal}
                    </p>
                    {batch.progressMessage && (
                      <p className="text-xs text-gem-offwhite/50">
                        {batch.progressMessage} {batch.progressFileName ? `· ${batch.progressFileName}` : ''}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {adminSection === 'bots' && canManage && (
        <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
          <h3 className="text-lg font-semibold">Bots</h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={adminBotSearch}
              onChange={(event) => setAdminBotSearch(event.target.value)}
              placeholder="Search by name, prompt, or owner"
              className="w-full max-w-md rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite placeholder:text-gem-offwhite/40"
            />
            <select
              value={adminBotSort}
              onChange={(event) =>
                setAdminBotSort(event.target.value as 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc')
              }
              className="rounded-md border border-gem-mist/50 bg-gem-slate px-3 py-2 text-sm text-gem-offwhite"
            >
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="name_asc">Name A-Z / ก-ฮ</option>
              <option value="name_desc">Name Z-A / ฮ-ก</option>
            </select>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {filteredAdminBots.length === 0 ? (
              <p className="text-sm text-gem-offwhite/60">No bots found.</p>
            ) : (
              filteredAdminBots.map((bot) => (
                <div key={bot.id} className="flex items-center justify-between gap-3 bg-gem-mist/20 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{bot.name}</p>
                    <p className="text-xs text-gem-offwhite/60 truncate">
                      Owner ID: {bot.owner?.id ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gem-offwhite/60 truncate">
                      Linked docs: {bot.documents.length}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      openConfirmDialog({
                        title: 'Delete bot',
                        message: `Delete bot "${bot.name}"? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        onConfirm: () => onAdminDeleteBot(bot.id),
                      })
                    }
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {adminSection === 'logs' && canSupport && (
        <div className="space-y-4">
          <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold">System logs</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {supportLogs.length === 0 ? (
                <p className="text-sm text-gem-offwhite/60">No logs available.</p>
              ) : (
                supportLogs.map((log) => {
                  const meta = log.meta && typeof log.meta === 'object' ? (log.meta as Record<string, any>) : null;
                  const eventLabel = meta?.event || log.message;
                  const summary = [
                    meta?.actorId ? `actor: ${meta.actorId}` : null,
                    meta?.targetType && meta?.targetId ? `${meta.targetType}: ${meta.targetId}` : null,
                    meta?.outcome ? `outcome: ${meta.outcome}` : null,
                  ].filter(Boolean).join(' · ');
                  const detail = [
                    meta?.name ? `name: ${meta.name}` : null,
                    meta?.email ? `email: ${meta.email}` : null,
                  ].filter(Boolean).join(' · ');

                  return (
                    <div key={log.id} className="bg-gem-mist/20 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-gem-offwhite/60">
                        <span className="uppercase">{log.level}</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm mt-1 font-semibold">{eventLabel}</p>
                      {summary && <p className="text-xs text-gem-offwhite/60 mt-1">{summary}</p>}
                      {detail && <p className="text-xs text-gem-offwhite/60 mt-1">{detail}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-gem-slate border border-gem-mist/40 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold">Support report</h3>
            <p className="text-xs text-gem-offwhite/60">Download a JSON snapshot of pending approvals and logs.</p>
            <button
              onClick={handleSupportReportDownload}
              className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-60"
              disabled={isDownloadingSupportReport}
            >
              {isDownloadingSupportReport ? 'Preparing...' : 'Download report'}
            </button>
            {supportReportError && <p className="text-red-400 text-sm">{supportReportError}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
