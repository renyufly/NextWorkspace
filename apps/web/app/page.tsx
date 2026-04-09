'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { type ReactNode, useDeferredValue, useEffect, useRef, useState, startTransition } from 'react';

import type {
  AuditLogSummary,
  AuthResponse,
  AuthUser,
  ChannelMemberSummary,
  DigestRunSummary,
  ChannelSummary,
  FileAttachmentSummary,
  MessagePage,
  MessageSummary,
  NotificationPreferenceSummary,
  NotificationSummary,
  OrganizationMemberSummary,
  OrganizationSummary,
  OrganizationWorkspaceSummary,
  RealtimeSyncSummary,
  WorkspaceAnalyticsSummary,
  WorkspaceSearchSummary,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
  WorkspaceRole,
  WorkspaceSearchScope,
  WorkspaceSummary,
} from '@worknext/shared';

import {
  ApiError,
  apiRequest,
  loginRequest,
  refreshRequest,
  registerRequest,
  resolveApiUrl,
} from '../lib/api';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '../lib/app-store';
import { createRealtimeSocket, type RealtimeSocket } from '../lib/realtime';

type AuthMode = 'login' | 'register';
type ThemeMode = 'dark' | 'light';

const statusItems = [
  'Local file-backed API runtime',
  'JWT auth with refresh cookie',
  'Workspace, roles, and invitations',
  'Message timeline and composer',
];
const memberRoleOptions: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER'];

function requestRealtimeSync(
  socket: RealtimeSocket,
  workspaceId: string,
  channelId: string | null,
): Promise<RealtimeSyncSummary | null> {
  return new Promise((resolve) => {
    socket.timeout(5000).emit(
      'state:sync',
      {
        workspaceId,
        channelId,
      },
      (error: unknown, response: RealtimeSyncSummary) => {
        if (error) {
          resolve(null);
          return;
        }

        resolve(response);
      },
    );
  });
}

export default function HomePage() {
  const COMPOSER_MIN_HEIGHT_PX = 32;
  const COMPOSER_MAX_HEIGHT_PX = 240;

  const router = useRouter();
  const pathname = usePathname();
  const isWorksettingsRoute = pathname === '/worksettings';

  const queryClient = useQueryClient();
  const accessToken = useAppStore((state) => state.accessToken);
  const setAccessToken = useAppStore((state) => state.setAccessToken);
  const clearSession = useAppStore((state) => state.clearSession);
  const selectedWorkspaceId = useAppStore((state) => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useAppStore((state) => state.setSelectedWorkspaceId);
  const selectedChannelId = useAppStore((state) => state.selectedChannelId);
  const setSelectedChannelId = useAppStore((state) => state.setSelectedChannelId);

  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(false);
  const [isTopNavOpen, setIsTopNavOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsTab, setWorkspaceSettingsTab] = useState<'manage' | 'analytics'>('manage');
  const [refreshAttempted, setRefreshAttempted] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    displayName: '',
  });
  const [workspaceName, setWorkspaceName] = useState('');
  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    type: 'PUBLIC' as 'PUBLIC' | 'PRIVATE',
  });
  const [messageDraft, setMessageDraft] = useState('');
  const [composerInputHeight, setComposerInputHeight] = useState(COMPOSER_MIN_HEIGHT_PX);
  const [threadDraft, setThreadDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [activeThreadMessageId, setActiveThreadMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<WorkspaceSearchScope>('ALL');
  const [searchOnlyCurrentChannel, setSearchOnlyCurrentChannel] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<'ALL' | AuditLogSummary['action']>('ALL');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'MEMBER' as WorkspaceRole });
  const [acceptInviteToken, setAcceptInviteToken] = useState('');
  const [channelMemberUserId, setChannelMemberUserId] = useState('');
  const [organizationWorkspaceName, setOrganizationWorkspaceName] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachmentSummary[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [mutedMemberIds, setMutedMemberIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const composerResizeRef = useRef<{
    startY: number;
    startHeight: number;
    pointerId: number;
  } | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const socketRef = useRef<RealtimeSocket | null>(null);
  const topNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const topNavDrawerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const storedTheme = window.localStorage.getItem('worknext-theme');

    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
      setIsThemeReady(true);
      return;
    }

    const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
    setTheme(preferredTheme);
    setIsThemeReady(true);
  }, []);

  useEffect(() => {
    if (!isThemeReady) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('worknext-theme', theme);
  }, [isThemeReady, theme]);

  useEffect(() => {
    setIsWorkspaceSettingsOpen(isWorksettingsRoute);

    if (isWorksettingsRoute) {
      setIsTopNavOpen(false);
      setIsLeftRailOpen(false);
      setWorkspaceSettingsTab('manage');
    }
  }, [isWorksettingsRoute]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setMutedMemberIds([]);
      return;
    }

    const key = `worknext-muted-members-${selectedWorkspaceId}`;
    const saved = window.localStorage.getItem(key);

    if (!saved) {
      setMutedMemberIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setMutedMemberIds(parsed.filter((candidate): candidate is string => typeof candidate === 'string'));
      } else {
        setMutedMemberIds([]);
      }
    } catch {
      setMutedMemberIds([]);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      return;
    }

    window.localStorage.setItem(
      `worknext-muted-members-${selectedWorkspaceId}`,
      JSON.stringify(mutedMemberIds),
    );
  }, [mutedMemberIds, selectedWorkspaceId]);

  useEffect(() => {
    setActiveThreadMessageId(null);
    setThreadDraft('');
  }, [selectedChannelId, selectedWorkspaceId]);

  useEffect(() => {
    setSearchOnlyCurrentChannel(false);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!isWorkspaceSettingsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isWorksettingsRoute) {
          router.push('/');
          return;
        }

        setIsWorkspaceSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWorksettingsRoute, isWorkspaceSettingsOpen, router]);

  useEffect(() => {
    if (!isLeftRailOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLeftRailOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLeftRailOpen]);

  useEffect(() => {
    if (!isTopNavOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTopNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTopNavOpen]);

  useEffect(() => {
    if (!isTopNavOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (topNavTriggerRef.current?.contains(target) || topNavDrawerRef.current?.contains(target)) {
        return;
      }

      setIsTopNavOpen(false);
    };

    window.addEventListener('mousedown', handlePointerDown);

    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isTopNavOpen]);

  useEffect(() => {
    if (accessToken || refreshAttempted) {
      return;
    }

    startTransition(() => {
      void refreshRequest()
        .then((result) => {
          setAccessToken(result.accessToken);
          setErrorMessage(null);
        })
        .catch(() => {
          clearSession();
        })
        .finally(() => {
          setRefreshAttempted(true);
        });
    });
  }, [accessToken, clearSession, refreshAttempted, setAccessToken]);

  const meQuery = useQuery<AuthUser>({
    queryKey: ['me', accessToken],
    queryFn: () => apiRequest<AuthUser>('/auth/me', { accessToken }),
    enabled: Boolean(accessToken),
    retry: false,
  });

  useEffect(() => {
    setProfileDisplayName(meQuery.data?.displayName ?? '');
  }, [meQuery.data?.displayName]);

  useEffect(() => {
    if (!meQuery.error) {
      return;
    }

    clearSession();
    setErrorMessage(getErrorMessage(meQuery.error));
  }, [clearSession, meQuery.error]);

  const workspacesQuery = useQuery<WorkspaceSummary[]>({
    queryKey: ['workspaces', accessToken],
    queryFn: () => apiRequest<WorkspaceSummary[]>('/workspaces', { accessToken }),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (!workspacesQuery.data?.length) {
      return;
    }

    const firstWorkspace = workspacesQuery.data[0];

    if (!firstWorkspace) {
      return;
    }

    if (!selectedWorkspaceId || !workspacesQuery.data.some((workspace) => workspace.id === selectedWorkspaceId)) {
      startTransition(() => {
        setSelectedWorkspaceId(firstWorkspace.id);
      });
    }
  }, [selectedWorkspaceId, setSelectedWorkspaceId, workspacesQuery.data]);

  const channelsQuery = useQuery<ChannelSummary[]>({
    queryKey: ['channels', accessToken, selectedWorkspaceId],
    queryFn: () =>
      apiRequest<ChannelSummary[]>(`/workspaces/${selectedWorkspaceId}/channels`, {
        accessToken,
      }),
    enabled: Boolean(accessToken && selectedWorkspaceId),
  });

  const organizationsQuery = useQuery<OrganizationSummary[]>({
    queryKey: ['organizations', accessToken],
    queryFn: () => apiRequest<OrganizationSummary[]>('/organizations', { accessToken }),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (!channelsQuery.data?.length) {
      return;
    }

    const firstChannel = channelsQuery.data[0];

    if (!firstChannel) {
      return;
    }

    if (!selectedChannelId || !channelsQuery.data.some((channel) => channel.id === selectedChannelId)) {
      startTransition(() => {
        setSelectedChannelId(firstChannel.id);
      });
    }
  }, [channelsQuery.data, selectedChannelId, setSelectedChannelId]);

  const messagesQuery = useInfiniteQuery<MessagePage, Error>({
    queryKey: ['messages', accessToken, selectedWorkspaceId, selectedChannelId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });

      if (typeof pageParam === 'string' && pageParam.length > 0) {
        params.set('cursor', pageParam);
      }

      return apiRequest<MessagePage>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages?${params.toString()}`,
        {
          accessToken,
        },
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(accessToken && selectedWorkspaceId && selectedChannelId),
  });

  const currentWorkspaceRole =
    workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId)?.role;
  const currentOrganizationId =
    workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId)?.organizationId ?? null;

  const membersQuery = useQuery<WorkspaceMemberSummary[]>({
    queryKey: ['members', accessToken, selectedWorkspaceId],
    queryFn: () => apiRequest<WorkspaceMemberSummary[]>(`/workspaces/${selectedWorkspaceId}/members`, { accessToken }),
    enabled: Boolean(accessToken && selectedWorkspaceId),
  });

  const invitationsQuery = useQuery<WorkspaceInvitationSummary[]>({
    queryKey: ['invitations', accessToken, selectedWorkspaceId],
    queryFn: () =>
      apiRequest<WorkspaceInvitationSummary[]>(`/workspaces/${selectedWorkspaceId}/invitations`, {
        accessToken,
      }),
    enabled: Boolean(accessToken && selectedWorkspaceId && currentWorkspaceCanManage(currentWorkspaceRole)),
    retry: false,
  });

  const notificationsQuery = useQuery<NotificationSummary[]>({
    queryKey: ['notifications', accessToken, selectedWorkspaceId],
    queryFn: () =>
      apiRequest<NotificationSummary[]>(
        selectedWorkspaceId ? `/notifications?workspaceId=${selectedWorkspaceId}` : '/notifications',
        { accessToken },
      ),
    enabled: Boolean(accessToken),
  });

  const channelMembersQuery = useQuery<ChannelMemberSummary[]>({
    queryKey: ['channel-members', accessToken, selectedWorkspaceId, selectedChannelId],
    queryFn: () =>
      apiRequest<ChannelMemberSummary[]>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/members`,
        { accessToken },
      ),
    enabled: Boolean(accessToken && selectedWorkspaceId && selectedChannelId),
  });

  const notificationPreferencesQuery = useQuery<NotificationPreferenceSummary>({
    queryKey: ['notification-preferences', accessToken, selectedWorkspaceId],
    queryFn: () =>
      apiRequest<NotificationPreferenceSummary>(`/notifications/preferences?workspaceId=${selectedWorkspaceId}`, {
        accessToken,
      }),
    enabled: Boolean(accessToken && selectedWorkspaceId),
  });

  const threadMessagesQuery = useQuery<MessageSummary[]>({
    queryKey: ['thread-messages', accessToken, selectedWorkspaceId, selectedChannelId, activeThreadMessageId],
    queryFn: () =>
      apiRequest<MessageSummary[]>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/${activeThreadMessageId}/thread`,
        { accessToken },
      ),
    enabled: Boolean(accessToken && selectedWorkspaceId && selectedChannelId && activeThreadMessageId),
  });

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const searchChannelId = searchOnlyCurrentChannel ? selectedChannelId : null;
  const searchResultsQuery = useQuery<WorkspaceSearchSummary>({
    queryKey: ['workspace-search', accessToken, selectedWorkspaceId, deferredSearchQuery, searchScope, searchChannelId],
    queryFn: () => {
      const params = new URLSearchParams({
        q: deferredSearchQuery,
        scope: searchScope,
        limit: '8',
      });

      if (searchChannelId) {
        params.set('channelId', searchChannelId);
      }

      return apiRequest<WorkspaceSearchSummary>(
        `/workspaces/${selectedWorkspaceId}/search?${params.toString()}`,
        { accessToken },
      );
    },
    enabled: Boolean(accessToken && selectedWorkspaceId && deferredSearchQuery.length >= 2),
  });

  const deferredMessages = useDeferredValue(
    (messagesQuery.data?.pages ?? [])
      .slice()
      .reverse()
      .flatMap((page) => page.items),
  );

  const workspacesQueryKey = ['workspaces', accessToken] as const;
  const channelsQueryKey = ['channels', accessToken, selectedWorkspaceId] as const;
  const messagesQueryKey = ['messages', accessToken, selectedWorkspaceId, selectedChannelId] as const;
  const membersQueryKey = ['members', accessToken, selectedWorkspaceId] as const;
  const invitationsQueryKey = ['invitations', accessToken, selectedWorkspaceId] as const;
  const notificationsQueryKey = ['notifications', accessToken, selectedWorkspaceId] as const;
  const channelMembersQueryKey = ['channel-members', accessToken, selectedWorkspaceId, selectedChannelId] as const;
  const notificationPreferencesQueryKey = ['notification-preferences', accessToken, selectedWorkspaceId] as const;
  const threadMessagesQueryKey = ['thread-messages', accessToken, selectedWorkspaceId, selectedChannelId, activeThreadMessageId] as const;
  const auditLogsQueryKey = ['audit-logs', accessToken, selectedWorkspaceId, auditActionFilter] as const;
  const analyticsQueryKey = ['workspace-analytics', accessToken, selectedWorkspaceId] as const;

  const auditLogsQuery = useQuery<AuditLogSummary[]>({
    queryKey: auditLogsQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({ limit: '12' });

      if (auditActionFilter !== 'ALL') {
        params.set('action', auditActionFilter);
      }

      return apiRequest<AuditLogSummary[]>(`/workspaces/${selectedWorkspaceId}/audit?${params.toString()}`, {
        accessToken,
      });
    },
    enabled: Boolean(accessToken && selectedWorkspaceId && currentWorkspaceCanManage(currentWorkspaceRole)),
  });

  const analyticsQuery = useQuery<WorkspaceAnalyticsSummary>({
    queryKey: analyticsQueryKey,
    queryFn: () => apiRequest<WorkspaceAnalyticsSummary>(`/workspaces/${selectedWorkspaceId}/analytics`, { accessToken }),
    enabled: Boolean(accessToken && selectedWorkspaceId && currentWorkspaceCanManage(currentWorkspaceRole)),
  });

  const organizationWorkspacesQueryKey = ['organization-workspaces', accessToken, currentOrganizationId] as const;
  const organizationMembersQueryKey = ['organization-members', accessToken, currentOrganizationId] as const;

  const currentOrganization = organizationsQuery.data?.find((organization) => organization.id === currentOrganizationId) ?? null;

  const organizationWorkspacesQuery = useQuery<OrganizationWorkspaceSummary[]>({
    queryKey: organizationWorkspacesQueryKey,
    queryFn: () => apiRequest<OrganizationWorkspaceSummary[]>(`/organizations/${currentOrganizationId}/workspaces`, { accessToken }),
    enabled: Boolean(accessToken && currentOrganizationId),
  });

  const organizationMembersQuery = useQuery<OrganizationMemberSummary[]>({
    queryKey: organizationMembersQueryKey,
    queryFn: () => apiRequest<OrganizationMemberSummary[]>(`/organizations/${currentOrganizationId}/members`, { accessToken }),
    enabled: Boolean(accessToken && currentOrganizationId && currentWorkspaceCanManage(currentOrganization?.role)),
    retry: false,
  });

  function updateMessagePages(
    updater: (pages: InfiniteData<MessagePage, string | null>) => InfiniteData<MessagePage, string | null>,
  ) {
    queryClient.setQueryData<InfiniteData<MessagePage, string | null>>(messagesQueryKey, (current) =>
      updater(
        current ?? {
          pageParams: [null],
          pages: [{ items: [], nextCursor: null }],
        },
      ),
    );
  }

  function updateChannelList(updater: (channels: ChannelSummary[]) => ChannelSummary[]) {
    queryClient.setQueryData<ChannelSummary[]>(channelsQueryKey, (current) => updater(current ?? []));
  }

  function updateWorkspaceList(updater: (workspaces: WorkspaceSummary[]) => WorkspaceSummary[]) {
    queryClient.setQueryData<WorkspaceSummary[]>(workspacesQueryKey, (current) => updater(current ?? []));
  }

  function updateInvitationList(updater: (invitations: WorkspaceInvitationSummary[]) => WorkspaceInvitationSummary[]) {
    queryClient.setQueryData<WorkspaceInvitationSummary[]>(invitationsQueryKey, (current) => updater(current ?? []));
  }

  function updateMemberList(updater: (members: WorkspaceMemberSummary[]) => WorkspaceMemberSummary[]) {
    queryClient.setQueryData<WorkspaceMemberSummary[]>(membersQueryKey, (current) => updater(current ?? []));
  }

  function updateChannelMemberList(updater: (members: ChannelMemberSummary[]) => ChannelMemberSummary[]) {
    queryClient.setQueryData<ChannelMemberSummary[]>(channelMembersQueryKey, (current) => updater(current ?? []));
  }

  function updateNotificationList(updater: (notifications: NotificationSummary[]) => NotificationSummary[]) {
    queryClient.setQueryData<NotificationSummary[]>(notificationsQueryKey, (current) => updater(current ?? []));
  }

  function updateNotificationPreferences(
    updater: (preferences: NotificationPreferenceSummary) => NotificationPreferenceSummary,
  ) {
    queryClient.setQueryData<NotificationPreferenceSummary>(notificationPreferencesQueryKey, (current) =>
      updater(
        current ?? {
          workspaceId: selectedWorkspaceId ?? '',
          userId: meQuery.data?.id ?? '',
          muteAll: false,
          allowMentions: true,
          emailMentions: false,
          emailDigest: false,
          pushMentions: false,
          pushDigest: false,
          mutedChannelIds: [],
          digestMode: 'OFF',
          lastDigestAt: null,
          updatedAt: new Date().toISOString(),
        },
      ),
    );
  }

  const authMutation = useMutation<AuthResponse, Error, AuthMode>({
    mutationFn: async (mode) => {
      const payload = {
        email: authForm.email,
        password: authForm.password,
        displayName: authForm.displayName,
      };

      return mode === 'register'
        ? registerRequest(payload)
        : loginRequest({ email: payload.email, password: payload.password });
    },
    onSuccess: (result) => {
      setAccessToken(result.accessToken);
      setErrorMessage(null);
      setAuthForm({ email: '', password: '', displayName: '' });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST', accessToken }),
    onSettled: () => {
      clearSession();
      void queryClient.clear();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (displayName: string) =>
      apiRequest<AuthUser>('/auth/profile', {
        method: 'PATCH',
        accessToken,
        body: {
          displayName,
        },
      }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<AuthUser>(['me', accessToken], updatedUser);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      setProfileDisplayName(updatedUser.displayName);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest<WorkspaceSummary>('/workspaces', {
        method: 'POST',
        accessToken,
        body: { name },
      }),
    onMutate: async (name: string) => {
      const trimmedName = name.trim();

      if (!trimmedName) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: workspacesQueryKey });

      const previousWorkspaces = queryClient.getQueryData<WorkspaceSummary[]>(workspacesQueryKey);
      const previousSelectedWorkspaceId = selectedWorkspaceId;
      const previousSelectedChannelId = selectedChannelId;
      const optimisticWorkspace: WorkspaceSummary = {
        id: `optimistic-workspace-${crypto.randomUUID()}`,
        organizationId: `optimistic-organization-${crypto.randomUUID()}`,
        organizationName: trimmedName,
        name: trimmedName,
        slug: trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace',
        role: 'OWNER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      updateWorkspaceList((current) => [...current, optimisticWorkspace].sort((left, right) => left.name.localeCompare(right.name)));
      setWorkspaceName('');
      setSelectedWorkspaceId(optimisticWorkspace.id);
      setSelectedChannelId(null);
      setErrorMessage(null);

      return {
        previousWorkspaces,
        previousSelectedWorkspaceId,
        previousSelectedChannelId,
        optimisticWorkspaceId: optimisticWorkspace.id,
      };
    },
    onSuccess: (workspace, _variables, context) => {
      if (context?.optimisticWorkspaceId) {
        updateWorkspaceList((current) =>
          current
            .map((candidate) => (candidate.id === context.optimisticWorkspaceId ? workspace : candidate))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      }

      setWorkspaceName('');
      setSelectedWorkspaceId(workspace.id);
      setSelectedChannelId(null);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(workspacesQueryKey, context.previousWorkspaces);
      }

      setSelectedWorkspaceId(context?.previousSelectedWorkspaceId ?? null);
      setSelectedChannelId(context?.previousSelectedChannelId ?? null);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const createChannelMutation = useMutation({
    mutationFn: (input: { name: string; description: string; type: ChannelSummary['type'] }) =>
      apiRequest<ChannelSummary>(`/workspaces/${selectedWorkspaceId}/channels`, {
        method: 'POST',
        accessToken,
        body: {
          name: input.name,
          description: input.description,
          type: input.type,
        },
      }),
    onMutate: async (input: { name: string; description: string; type: ChannelSummary['type'] }) => {
      if (!selectedWorkspaceId) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: channelsQueryKey });

      const previousChannels = queryClient.getQueryData<ChannelSummary[]>(channelsQueryKey);
      const previousSelectedChannelId = selectedChannelId;
      const optimisticChannel: ChannelSummary = {
        id: `optimistic-channel-${crypto.randomUUID()}`,
        workspaceId: selectedWorkspaceId,
        name: input.name.trim(),
        description: input.description.trim() || null,
        type: input.type,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        unreadCount: 0,
        memberCount: 1,
        isMember: true,
      };

      updateChannelList((current) => [...current, optimisticChannel]);
      setChannelForm({ name: '', description: '', type: 'PUBLIC' });
      setSelectedChannelId(optimisticChannel.id);
      setErrorMessage(null);

      return {
        previousChannels,
        previousSelectedChannelId,
        optimisticChannelId: optimisticChannel.id,
      };
    },
    onSuccess: (channel, _variables, context) => {
      if (context?.optimisticChannelId) {
        updateChannelList((current) =>
          current.map((candidate) => (candidate.id === context.optimisticChannelId ? channel : candidate)),
        );
      }

      setChannelForm({ name: '', description: '', type: 'PUBLIC' });
      setSelectedChannelId(channel.id);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousChannels) {
        queryClient.setQueryData(channelsQueryKey, context.previousChannels);
      }

      setSelectedChannelId(context?.previousSelectedChannelId ?? null);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (input: { content: string; attachments: FileAttachmentSummary[] }) =>
      apiRequest<MessageSummary>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages`,
        {
          method: 'POST',
          accessToken,
          body: {
            content: input.content,
            attachmentIds: input.attachments.map((attachment) => attachment.id),
          },
        },
      ),
    onMutate: async (input: { content: string; attachments: FileAttachmentSummary[] }) => {
      if (!selectedWorkspaceId || !selectedChannelId || !meQuery.data) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(messagesQueryKey);
      const previousChannels = queryClient.getQueryData<ChannelSummary[]>(channelsQueryKey);
      const previousDraft = messageDraft;
      const previousAttachments = pendingAttachments;
      const trimmedContent = input.content.trim();
      const optimisticMessage: MessageSummary = {
        id: `optimistic-message-${crypto.randomUUID()}`,
        workspaceId: selectedWorkspaceId,
        channelId: selectedChannelId,
        parentMessageId: null,
        content: trimmedContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        isDeleted: false,
        isOwnMessage: true,
        threadReplyCount: 0,
        reactions: [],
        readReceipts: [],
        attachments: input.attachments,
        sender: {
          id: meQuery.data.id,
          displayName: meQuery.data.displayName,
        },
      };

      updateMessagePages((current) => {
        if (current.pages.length === 0) {
          return {
            pageParams: current.pageParams,
            pages: [{ items: [optimisticMessage], nextCursor: null }],
          };
        }

        return {
          ...current,
          pages: current.pages.map((page, index) =>
            index === 0 ? { ...page, items: [...page.items, optimisticMessage] } : page,
          ),
        };
      });

      updateChannelList((current) =>
        current.map((channel) =>
          channel.id === selectedChannelId
            ? { ...channel, unreadCount: 0 }
            : channel,
        ),
      );

      setMessageDraft('');
      setPendingAttachments([]);
      setErrorMessage(null);

      return {
        previousMessages,
        previousChannels,
        previousDraft,
        previousAttachments,
        optimisticMessageId: optimisticMessage.id,
      };
    },
    onSuccess: (message, _variables, context) => {
      if (context?.optimisticMessageId) {
        updateMessagePages((current) => ({
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === context.optimisticMessageId ? message : item)),
          })),
        }));
      }

      setMessageDraft('');
      setPendingAttachments([]);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }

      if (context?.previousChannels) {
        queryClient.setQueryData(channelsQueryKey, context.previousChannels);
      }

      setMessageDraft(context?.previousDraft ?? '');
      setPendingAttachments(context?.previousAttachments ?? []);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      apiRequest<MessageSummary>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/${messageId}`,
        {
          method: 'PATCH',
          accessToken,
          body: { content },
        },
      ),
    onMutate: async ({ messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(messagesQueryKey);

      updateMessagePages((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === messageId
              ? { ...item, content, updatedAt: new Date().toISOString() }
              : item,
          ),
        })),
      }));

      setEditingMessageId(null);
      setEditingMessageDraft('');
      setErrorMessage(null);

      return { previousMessages };
    },
    onSuccess: () => {
      setEditingMessageId(null);
      setEditingMessageDraft('');
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest<MessageSummary>(
        `/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/${messageId}`,
        {
          method: 'DELETE',
          accessToken,
        },
      ),
    onMutate: async (messageId: string) => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessages = queryClient.getQueryData<InfiniteData<MessagePage, string | null>>(messagesQueryKey);

      updateMessagePages((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  content: 'Message deleted',
                  deletedAt: new Date().toISOString(),
                  isDeleted: true,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        })),
      }));

      return { previousMessages };
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const markReadMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/read`, {
        method: 'POST',
        accessToken,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['channels', accessToken, selectedWorkspaceId] });
    },
  });

  const sendThreadReplyMutation = useMutation({
    mutationFn: (input: { content: string; parentMessageId: string }) =>
      apiRequest<MessageSummary>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages`, {
        method: 'POST',
        accessToken,
        body: input,
      }),
    onSuccess: () => {
      setThreadDraft('');
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const addReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiRequest<MessageSummary>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/${messageId}/reactions`, {
        method: 'POST',
        accessToken,
        body: { emoji },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey });
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const removeReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      apiRequest<MessageSummary>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/messages/${messageId}/reactions`, {
        method: 'DELETE',
        accessToken,
        body: { emoji },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      void queryClient.invalidateQueries({ queryKey: threadMessagesQueryKey });
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const updateNotificationPreferencesMutation = useMutation({
    mutationFn: (input: Partial<NotificationPreferenceSummary>) =>
      apiRequest<NotificationPreferenceSummary>('/notifications/preferences', {
        method: 'PATCH',
        accessToken,
        body: {
          workspaceId: selectedWorkspaceId,
          ...input,
        },
      }),
    onMutate: async (input: Partial<NotificationPreferenceSummary>) => {
      await queryClient.cancelQueries({ queryKey: notificationPreferencesQueryKey });

      const previousPreferences = queryClient.getQueryData<NotificationPreferenceSummary>(notificationPreferencesQueryKey);
      updateNotificationPreferences((current) => ({
        ...current,
        ...input,
        updatedAt: new Date().toISOString(),
      }));

      return { previousPreferences };
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(notificationPreferencesQueryKey, preferences);
      setErrorMessage(null);
    },
    onError: (error, _variables, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(notificationPreferencesQueryKey, context.previousPreferences);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: (input: { email: string; role: WorkspaceRole }) =>
      apiRequest<WorkspaceInvitationSummary>(`/workspaces/${selectedWorkspaceId}/invitations`, {
        method: 'POST',
        accessToken,
        body: input,
      }),
    onMutate: async (input: { email: string; role: WorkspaceRole }) => {
      if (!selectedWorkspaceId || !meQuery.data) {
        return {};
      }

      await queryClient.cancelQueries({ queryKey: invitationsQueryKey });

      const previousInvitations = queryClient.getQueryData<WorkspaceInvitationSummary[]>(invitationsQueryKey);
      const optimisticInvitation: WorkspaceInvitationSummary = {
        id: `optimistic-invitation-${crypto.randomUUID()}`,
        workspaceId: selectedWorkspaceId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        token: `pending-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        acceptedAt: null,
        invitedBy: {
          id: meQuery.data.id,
          displayName: meQuery.data.displayName,
          email: meQuery.data.email,
        },
      };

      updateInvitationList((current) => [optimisticInvitation, ...current]);
      setInviteForm({ email: '', role: 'MEMBER' });
      setErrorMessage(null);

      return {
        previousInvitations,
        optimisticInvitationId: optimisticInvitation.id,
      };
    },
    onSuccess: (invitation, _variables, context) => {
      if (context?.optimisticInvitationId) {
        updateInvitationList((current) =>
          current.map((candidate) => (candidate.id === context.optimisticInvitationId ? invitation : candidate)),
        );
      }

      setInviteForm({ email: '', role: 'MEMBER' });
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousInvitations) {
        queryClient.setQueryData(invitationsQueryKey, context.previousInvitations);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      apiRequest<{ success: boolean }>(`/workspaces/${selectedWorkspaceId}/invitations/${invitationId}`, {
        method: 'DELETE',
        accessToken,
      }),
    onMutate: async (invitationId: string) => {
      await queryClient.cancelQueries({ queryKey: invitationsQueryKey });

      const previousInvitations = queryClient.getQueryData<WorkspaceInvitationSummary[]>(invitationsQueryKey);
      updateInvitationList((current) => current.filter((candidate) => candidate.id !== invitationId));

      return { previousInvitations };
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousInvitations) {
        queryClient.setQueryData(invitationsQueryKey, context.previousInvitations);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<{ success: boolean }>(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        accessToken,
      }),
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });

      const previousNotifications = queryClient.getQueryData<NotificationSummary[]>(notificationsQueryKey);
      const timestamp = new Date().toISOString();
      updateNotificationList((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, readAt: notification.readAt ?? timestamp } : notification,
        ),
      );

      return { previousNotifications };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(notificationsQueryKey, context.previousNotifications);
      }
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(
        selectedWorkspaceId ? `/notifications/read-all?workspaceId=${selectedWorkspaceId}` : '/notifications/read-all',
        {
          method: 'POST',
          accessToken,
        },
      ),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });

      const previousNotifications = queryClient.getQueryData<NotificationSummary[]>(notificationsQueryKey);
      const timestamp = new Date().toISOString();
      updateNotificationList((current) =>
        current.map((notification) => ({ ...notification, readAt: notification.readAt ?? timestamp })),
      );

      return { previousNotifications };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(notificationsQueryKey, context.previousNotifications);
      }
    },
  });

  const runDigestMutation = useMutation({
    mutationFn: () =>
      apiRequest<DigestRunSummary>('/notifications/digest/run', {
        method: 'POST',
        accessToken,
        body: { workspaceId: selectedWorkspaceId },
      }),
    onSuccess: (result) => {
      const notification = result.notification;

      if (notification) {
        updateNotificationList((current) => [notification, ...current]);
      }

      updateNotificationPreferences((current) => ({
        ...current,
        lastDigestAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: (token: string) =>
      apiRequest<WorkspaceSummary>('/workspaces/invitations/accept', {
        method: 'POST',
        accessToken,
        body: { token },
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: workspacesQueryKey });

      const previousWorkspaces = queryClient.getQueryData<WorkspaceSummary[]>(workspacesQueryKey);
      const previousSelectedWorkspaceId = selectedWorkspaceId;
      const previousSelectedChannelId = selectedChannelId;

      return {
        previousWorkspaces,
        previousSelectedWorkspaceId,
        previousSelectedChannelId,
      };
    },
    onSuccess: (workspace) => {
      updateWorkspaceList((current) => {
        const exists = current.some((candidate) => candidate.id === workspace.id);
        const next = exists ? current.map((candidate) => (candidate.id === workspace.id ? workspace : candidate)) : [...current, workspace];
        return next.sort((left, right) => left.name.localeCompare(right.name));
      });

      setAcceptInviteToken('');
      setSelectedWorkspaceId(workspace.id);
      setSelectedChannelId(null);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['organizations', accessToken] });
      void queryClient.invalidateQueries({ queryKey: membersQueryKey });
      void queryClient.invalidateQueries({ queryKey: invitationsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(workspacesQueryKey, context.previousWorkspaces);
      }

      setSelectedWorkspaceId(context?.previousSelectedWorkspaceId ?? null);
      setSelectedChannelId(context?.previousSelectedChannelId ?? null);
      setErrorMessage(getErrorMessage(error));
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberUserId, role }: { memberUserId: string; role: Exclude<WorkspaceRole, 'OWNER'> }) =>
      apiRequest<WorkspaceMemberSummary>(`/workspaces/${selectedWorkspaceId}/members/${memberUserId}`, {
        method: 'PATCH',
        accessToken,
        body: { role },
      }),
    onMutate: async ({ memberUserId, role }) => {
      await queryClient.cancelQueries({ queryKey: membersQueryKey });

      const previousMembers = queryClient.getQueryData<WorkspaceMemberSummary[]>(membersQueryKey);
      updateMemberList((current) =>
        current.map((member) => (member.userId === memberUserId ? { ...member, role } : member)),
      );

      return { previousMembers };
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: membersQueryKey });
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(membersQueryKey, context.previousMembers);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      apiRequest<{ success: boolean }>(`/workspaces/${selectedWorkspaceId}/members/${memberUserId}`, {
        method: 'DELETE',
        accessToken,
      }),
    onMutate: async (memberUserId: string) => {
      await queryClient.cancelQueries({ queryKey: membersQueryKey });
      await queryClient.cancelQueries({ queryKey: channelMembersQueryKey });

      const previousMembers = queryClient.getQueryData<WorkspaceMemberSummary[]>(membersQueryKey);
      const previousChannelMembers = queryClient.getQueryData<ChannelMemberSummary[]>(channelMembersQueryKey);
      updateMemberList((current) => current.filter((member) => member.userId !== memberUserId));
      updateChannelMemberList((current) => current.filter((member) => member.userId !== memberUserId));

      return {
        previousMembers,
        previousChannelMembers,
      };
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: membersQueryKey });
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousMembers) {
        queryClient.setQueryData(membersQueryKey, context.previousMembers);
      }

      if (context?.previousChannelMembers) {
        queryClient.setQueryData(channelMembersQueryKey, context.previousChannelMembers);
      }

      setErrorMessage(getErrorMessage(error));
    },
  });

  const leaveWorkspaceMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean }>(`/workspaces/${selectedWorkspaceId}/leave`, {
        method: 'POST',
        accessToken,
      }),
    onSuccess: () => {
      setSelectedWorkspaceId(null);
      setSelectedChannelId(null);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      void queryClient.invalidateQueries({ queryKey: ['channels'] });
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error) => setErrorMessage(getErrorMessage(error)),
  });

  const addChannelMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest<ChannelMemberSummary>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/members`, {
        method: 'POST',
        accessToken,
        body: { userId },
      }),
    onMutate: async (userId: string) => {
      await queryClient.cancelQueries({ queryKey: channelMembersQueryKey });

      const previousChannelMembers = queryClient.getQueryData<ChannelMemberSummary[]>(channelMembersQueryKey);
      const memberToAdd = membersQuery.data?.find((member) => member.userId === userId);

      if (memberToAdd) {
        updateChannelMemberList((current) => [
          ...current,
          {
            userId: memberToAdd.userId,
            email: memberToAdd.email,
            displayName: memberToAdd.displayName,
            joinedAt: new Date().toISOString(),
            isCurrentUser: memberToAdd.isCurrentUser,
          },
        ]);
      }

      updateChannelList((current) =>
        current.map((channel) =>
          channel.id === selectedChannelId
            ? { ...channel, memberCount: channel.memberCount + (memberToAdd ? 1 : 0) }
            : channel,
        ),
      );

      setChannelMemberUserId('');
      setErrorMessage(null);

      return { previousChannelMembers };
    },
    onSuccess: () => {
      setChannelMemberUserId('');
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: channelMembersQueryKey });
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousChannelMembers) {
        queryClient.setQueryData(channelMembersQueryKey, context.previousChannelMembers);
      }

      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
      setErrorMessage(getErrorMessage(error));
    },
  });

  const removeChannelMemberMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      apiRequest<{ success: boolean }>(`/workspaces/${selectedWorkspaceId}/channels/${selectedChannelId}/members/${memberUserId}`, {
        method: 'DELETE',
        accessToken,
      }),
    onMutate: async (memberUserId: string) => {
      await queryClient.cancelQueries({ queryKey: channelMembersQueryKey });

      const previousChannelMembers = queryClient.getQueryData<ChannelMemberSummary[]>(channelMembersQueryKey);
      updateChannelMemberList((current) => current.filter((member) => member.userId !== memberUserId));
      updateChannelList((current) =>
        current.map((channel) =>
          channel.id === selectedChannelId
            ? { ...channel, memberCount: Math.max(0, channel.memberCount - 1) }
            : channel,
        ),
      );

      return { previousChannelMembers };
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: channelMembersQueryKey });
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
    },
    onError: (error, _variables, context) => {
      if (context?.previousChannelMembers) {
        queryClient.setQueryData(channelMembersQueryKey, context.previousChannelMembers);
      }

      void queryClient.invalidateQueries({ queryKey: channelsQueryKey });
      setErrorMessage(getErrorMessage(error));
    },
  });

  const createOrganizationWorkspaceMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest<WorkspaceSummary>(`/organizations/${currentOrganizationId}/workspaces`, {
        method: 'POST',
        accessToken,
        body: { name },
      }),
    onSuccess: (workspace) => {
      setOrganizationWorkspaceName('');
      setSelectedWorkspaceId(workspace.id);
      setSelectedChannelId(null);
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['organizations', accessToken] });
      void queryClient.invalidateQueries({ queryKey: organizationWorkspacesQueryKey });
      void queryClient.invalidateQueries({ queryKey: organizationMembersQueryKey });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error));
    },
  });

  const currentWorkspace = workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
  const currentChannel = channelsQuery.data?.find((channel) => channel.id === selectedChannelId) ?? null;
  const activeThreadRootMessage = deferredMessages.find((message) => message.id === activeThreadMessageId) ?? null;
  const notificationPreferences = notificationPreferencesQuery.data;
  const canManageWorkspace = currentWorkspaceCanManage(currentWorkspace?.role);
  const availableChannelMemberCandidates = (membersQuery.data ?? []).filter(
    (workspaceMember) =>
      !channelMembersQuery.data?.some((channelMember) => channelMember.userId === workspaceMember.userId),
  );

  useEffect(() => {
    if (!selectedWorkspaceId || !selectedChannelId || !messagesQuery.data?.pages.length) {
      return;
    }

    markReadMutation.mutate();
  }, [messagesQuery.data?.pages.length, selectedChannelId, selectedWorkspaceId]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const socket = createRealtimeSocket(accessToken);
    socketRef.current = socket;

    const invalidateRealtimeData = () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', accessToken, selectedWorkspaceId, selectedChannelId] });
      void queryClient.invalidateQueries({ queryKey: ['thread-messages', accessToken, selectedWorkspaceId, selectedChannelId, activeThreadMessageId] });
      void queryClient.invalidateQueries({ queryKey: ['channels', accessToken, selectedWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['members', accessToken, selectedWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', accessToken, selectedWorkspaceId] });
    };

    const reconcileRealtimeState = () => {
      if (!selectedWorkspaceId) {
        return;
      }

      void requestRealtimeSync(socket, selectedWorkspaceId, selectedChannelId ?? null).then((summary) => {
        if (!summary || summary.workspaceId !== selectedWorkspaceId) {
          return;
        }

        setOnlineUserIds(summary.onlineUserIds);
      });
    };

    socket.on('connect', () => {
      invalidateRealtimeData();

      if (selectedWorkspaceId) {
        socket.emit('workspace:join', { workspaceId: selectedWorkspaceId });
        socket.emit('presence:heartbeat', { workspaceId: selectedWorkspaceId });
      }

      if (selectedWorkspaceId && selectedChannelId) {
        socket.emit('channel:join', {
          workspaceId: selectedWorkspaceId,
          channelId: selectedChannelId,
        });
      }

      reconcileRealtimeState();
    });

    socket.on('message:created', invalidateRealtimeData);
    socket.on('message:updated', invalidateRealtimeData);
    socket.on('message:deleted', invalidateRealtimeData);
    socket.on('state:reconciled', (summary: RealtimeSyncSummary) => {
      if (!selectedWorkspaceId || summary.workspaceId !== selectedWorkspaceId) {
        return;
      }

      setOnlineUserIds(summary.onlineUserIds);
    });
    socket.on('notification:new', (payload: { userId: string }) => {
      if (payload.userId !== meQuery.data?.id) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: ['notifications', accessToken, selectedWorkspaceId] });
    });
    socket.on(
      'typing:update',
      (payload: { channelId: string; userId: string; displayName: string; isTyping: boolean }) => {
        if (!selectedChannelId || payload.channelId !== selectedChannelId || payload.userId === meQuery.data?.id) {
          return;
        }

        setTypingUsers((current) => (current.includes(payload.displayName) ? current : [...current, payload.displayName]));

        const existingTimeout = typingTimeoutsRef.current[payload.userId];

        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        typingTimeoutsRef.current[payload.userId] = setTimeout(() => {
          setTypingUsers((current) => current.filter((name) => name !== payload.displayName));
          delete typingTimeoutsRef.current[payload.userId];
        }, 2200);
      },
    );
    socket.on(
      'presence:update',
      (payload: { workspaceId: string; userId: string; status: 'online' | 'offline' }) => {
        if (!selectedWorkspaceId || payload.workspaceId !== selectedWorkspaceId) {
          return;
        }

        setOnlineUserIds((current) => {
          if (payload.status === 'online') {
            return current.includes(payload.userId) ? current : [...current, payload.userId];
          }

          return current.filter((userId) => userId !== payload.userId);
        });
      },
    );

    const heartbeat = selectedWorkspaceId
      ? setInterval(() => {
          socket.emit('presence:heartbeat', { workspaceId: selectedWorkspaceId });
        }, 20_000)
      : null;

    return () => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      for (const timeout of Object.values(typingTimeoutsRef.current)) {
        clearTimeout(timeout);
      }

      typingTimeoutsRef.current = {};
      setTypingUsers([]);
      setOnlineUserIds([]);
      socketRef.current = null;
      socket.disconnect();
    };
  }, [accessToken, activeThreadMessageId, meQuery.data?.id, queryClient, selectedChannelId, selectedWorkspaceId]);

  useEffect(() => {
    if (!messageDraft.trim() || !accessToken || !selectedWorkspaceId || !selectedChannelId) {
      return;
    }

    const timeout = setTimeout(() => {
      const socket = socketRef.current;

      if (!socket || !socket.connected) {
        return;
      }

      socket.emit('typing:start', {
        workspaceId: selectedWorkspaceId,
        channelId: selectedChannelId,
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [accessToken, messageDraft, selectedChannelId, selectedWorkspaceId]);

  if (!accessToken && !refreshAttempted) {
    return <main className="shell loading-shell">Restoring your session…</main>;
  }

  if (!accessToken) {
    return (
      <main className="shell landing-shell">
        <section className="hero auth-hero">
          <div className="hero-copy">
            <div className="surface-actions">
              <ThemeToggleButton
                theme={theme}
                onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              />
            </div>
            <p className="eyebrow">Runnable local MVP</p>
            <h1>WorkNext</h1>
            <p className="lede">
              Register a user, create a workspace, open channels, and chat locally in WSL2 without Docker.
            </p>
            <ul className="status-list">
              {statusItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <form
            className="auth-card"
            data-testid="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              authMutation.mutate(authMode);
            }}
          >
            <div className="segment-control">
              <button
                type="button"
                className={authMode === 'register' ? 'segment active' : 'segment'}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
              <button
                type="button"
                className={authMode === 'login' ? 'segment active' : 'segment'}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
            </div>

            <label className="field">
              <span>Email</span>
              <input
                data-testid="auth-email-input"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
              />
            </label>

            {authMode === 'register' ? (
              <label className="field">
                <span>Display name</span>
                <input
                  data-testid="auth-display-name-input"
                  value={authForm.displayName}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                  minLength={2}
                  required
                />
              </label>
            ) : null}

            <label className="field">
              <span>Password</span>
              <input
                data-testid="auth-password-input"
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                minLength={8}
                required
              />
            </label>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

            <button className="primary-button" data-testid="auth-submit-button" type="submit" disabled={authMutation.isPending}>
              {authMutation.isPending ? 'Submitting…' : authMode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const unreadNotificationCount = (notificationsQuery.data ?? []).filter(
    (notification) => notification.readAt === null,
  ).length;

  async function handleAttachmentSelection(files: FileList | null) {
    if (!files || !selectedWorkspaceId || !accessToken) {
      return;
    }

    setIsUploadingAttachments(true);

    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);

          return apiRequest<FileAttachmentSummary>(`/workspaces/${selectedWorkspaceId}/files`, {
            method: 'POST',
            accessToken,
            body: formData,
          });
        }),
      );

      setPendingAttachments((current) => [...current, ...uploaded]);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUploadingAttachments(false);
    }
  }

  function toggleReaction(message: MessageSummary, emoji: string) {
    const existingReaction = message.reactions.find((reaction) => reaction.emoji === emoji);

    if (existingReaction?.reactedByCurrentUser) {
      removeReactionMutation.mutate({ messageId: message.id, emoji });
      return;
    }

    addReactionMutation.mutate({ messageId: message.id, emoji });
  }

  function openWorkspaceSettingsPage() {
    setIsTopNavOpen(false);
    setWorkspaceSettingsTab('manage');
    if (!isWorksettingsRoute) {
      router.push('/worksettings');
    }
  }

  function closeWorkspaceSettingsPage() {
    router.push('/');
  }

  function handleComposerResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    event.preventDefault();

    event.currentTarget.setPointerCapture(event.pointerId);

    composerResizeRef.current = {
      startY: event.clientY,
      startHeight: composerInputRef.current?.getBoundingClientRect().height ?? composerInputHeight,
      pointerId: event.pointerId,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  }

  function handleComposerResizeMove(event: React.PointerEvent<HTMLButtonElement>) {
    const context = composerResizeRef.current;

    if (!context || context.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const delta = context.startY - event.clientY;
    const nextHeight = Math.min(
      COMPOSER_MAX_HEIGHT_PX,
      Math.max(COMPOSER_MIN_HEIGHT_PX, context.startHeight + delta),
    );

    setComposerInputHeight(nextHeight);
  }

  function handleComposerResizeEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const context = composerResizeRef.current;

    if (!context || context.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    composerResizeRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }

  return (
    <main className={isWorksettingsRoute ? 'workspace-shell worksettings-route' : 'workspace-shell'}>
      <button
        ref={topNavTriggerRef}
        className={isTopNavOpen ? 'ghost-button top-nav-trigger open' : 'ghost-button top-nav-trigger'}
        type="button"
        data-testid="top-nav-trigger"
        onClick={() => setIsTopNavOpen((current) => !current)}
        aria-label="Toggle top navigation"
        aria-expanded={isTopNavOpen}
      >
        <TopBarIcon />
      </button>

      <button
        className="ghost-button left-rail-trigger"
        type="button"
        data-testid="left-rail-trigger"
        onClick={() => setIsLeftRailOpen(true)}
        aria-label="Open workspace drawer"
      >
        <DrawerIcon />
      </button>

      <button
        type="button"
        className={isLeftRailOpen ? 'left-rail-overlay open' : 'left-rail-overlay'}
        aria-label="Close workspace drawer"
        onClick={() => setIsLeftRailOpen(false)}
      />

      <aside className={isLeftRailOpen ? 'left-rail-drawer open' : 'left-rail-drawer'}>
        <div className="left-rail-drawer-shell">
          <aside className="workspace-rail brand-rail">
            <div>
              <p className="eyebrow">Local MVP</p>
              <h1>WorkNext</h1>
              <p className="rail-copy">
                {meQuery.data ? `Signed in as ${meQuery.data.displayName}` : 'Loading your session…'}
              </p>

              <form
                className="compact-form stacked"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateProfileMutation.mutate(profileDisplayName.trim());
                }}
              >
                <label className="field compact-field" htmlFor="left-rail-display-name-input">
                  <span>Display name</span>
                  <input
                    id="left-rail-display-name-input"
                    data-testid="left-rail-display-name-input"
                    value={profileDisplayName}
                    onChange={(event) => setProfileDisplayName(event.target.value)}
                    minLength={2}
                    maxLength={60}
                    required
                  />
                </label>

                <button
                  className="primary-button"
                  data-testid="left-rail-save-display-name-button"
                  type="submit"
                  disabled={
                    updateProfileMutation.isPending ||
                    !profileDisplayName.trim() ||
                    profileDisplayName.trim() === (meQuery.data?.displayName ?? '')
                  }
                >
                  {updateProfileMutation.isPending ? 'Saving…' : 'Save display name'}
                </button>
              </form>
            </div>

            <div className="status-panel">
              <span>Mode</span>
              <strong>File-backed runtime</strong>
              <span>Auth</span>
              <strong>JWT + refresh cookie</strong>
            </div>

            <button className="ghost-button" type="button" onClick={() => logoutMutation.mutate()}>
              Sign out
            </button>

            {currentWorkspace ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => leaveWorkspaceMutation.mutate()}
                disabled={currentWorkspace.role === 'OWNER' || leaveWorkspaceMutation.isPending}
              >
                {currentWorkspace.role === 'OWNER' ? 'Owner cannot leave' : 'Leave workspace'}
              </button>
            ) : null}
          </aside>

          <aside className="workspace-rail sidebar-panel">
            <section className="sidebar-section">
              <div className="section-header">
                <h2>Workspaces</h2>
                <span>{workspacesQuery.data?.length ?? 0}</span>
              </div>

              <div className="workspace-list">
                {workspacesQuery.data?.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    data-testid="workspace-item"
                    className={workspace.id === selectedWorkspaceId ? 'list-item group active' : 'list-item group'}
                    onClick={() => {
                      setSelectedWorkspaceId(workspace.id);
                      setSelectedChannelId(null);
                      setIsLeftRailOpen(false);
                    }}
                  >
                    <strong>{workspace.name}</strong>
                    <span>{workspace.role.toLowerCase()}</span>
                  </button>
                ))}
              </div>

              <form
                className="compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  createWorkspaceMutation.mutate(workspaceName);
                }}
              >
                <input
                  data-testid="create-workspace-input"
                  placeholder="New workspace name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  minLength={2}
                  required
                />
                <button className="primary-button" data-testid="create-workspace-button" type="submit" disabled={createWorkspaceMutation.isPending}>
                  Create
                </button>
              </form>

              <form
                className="compact-form stacked"
                onSubmit={(event) => {
                  event.preventDefault();
                  acceptInvitationMutation.mutate(acceptInviteToken);
                }}
              >
                <input
                  data-testid="accept-invitation-input"
                  placeholder="Accept invitation token"
                  value={acceptInviteToken}
                  onChange={(event) => setAcceptInviteToken(event.target.value)}
                  minLength={8}
                  required
                />
                <button className="ghost-button" data-testid="accept-invitation-button" type="submit" disabled={acceptInvitationMutation.isPending}>
                  Join workspace
                </button>
              </form>
            </section>

            <section className="sidebar-section">
              <div className="section-header">
                <h2>Channels</h2>
                <span>{channelsQuery.data?.length ?? 0}</span>
              </div>

              <div className="workspace-list">
                {channelsQuery.data?.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    data-testid="channel-item"
                    className={channel.id === selectedChannelId ? 'list-item group active' : 'list-item group'}
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setIsLeftRailOpen(false);
                    }}
                  >
                    <div className="channel-heading">
                      <strong>#{channel.name}</strong>
                      <div className="channel-badges">
                        {channel.type === 'PRIVATE' ? <span className="type-badge private">private</span> : null}
                        {channel.unreadCount > 0 ? <span className="count-badge">{channel.unreadCount}</span> : null}
                      </div>
                    </div>
                    <span>{channel.description ?? (channel.type === 'PRIVATE' ? 'Private channel' : 'Public channel')}</span>
                  </button>
                ))}
              </div>

              {selectedWorkspaceId ? (
                <form
                  className="compact-form stacked"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createChannelMutation.mutate({
                      name: channelForm.name,
                      description: channelForm.description,
                      type: channelForm.type,
                    });
                  }}
                >
                  <input
                    data-testid="create-channel-name-input"
                    placeholder="Channel name"
                    value={channelForm.name}
                    onChange={(event) =>
                      setChannelForm((current) => ({ ...current, name: event.target.value }))
                    }
                    minLength={2}
                    required
                  />
                  <input
                    data-testid="create-channel-description-input"
                    placeholder="Description"
                    value={channelForm.description}
                    onChange={(event) =>
                      setChannelForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                  <select
                    data-testid="create-channel-type-select"
                    value={channelForm.type}
                    onChange={(event) =>
                      setChannelForm((current) => ({
                        ...current,
                        type: event.target.value as 'PUBLIC' | 'PRIVATE',
                      }))
                    }
                  >
                    <option value="PUBLIC">public</option>
                    {canManageWorkspace ? <option value="PRIVATE">private</option> : null}
                  </select>
                  <button className="primary-button" data-testid="create-channel-button" type="submit" disabled={createChannelMutation.isPending}>
                    Add channel
                  </button>
                </form>
              ) : null}
            </section>
          </aside>
        </div>
      </aside>

      <section className="conversation-panel">
        <header ref={topNavDrawerRef} className={isTopNavOpen ? 'top-nav-drawer open' : 'top-nav-drawer'}>
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{currentWorkspace?.name ?? 'Create your first workspace'}</h2>
            <p className="conversation-meta">
              {currentChannel
                ? `#${currentChannel.name} · ${currentChannel.type.toLowerCase()} · ${currentChannel.memberCount} members`
                : 'Select a channel to begin chatting'}
            </p>
          </div>
          <div className="top-nav-drawer-actions">
            <div className="search-controls">
              <input
                className="search-input"
                data-testid="workspace-search-input"
                placeholder={selectedWorkspaceId ? 'Search messages, channels, files, members' : 'Select a workspace to search'}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                disabled={!selectedWorkspaceId}
              />
              <select
                className="search-scope-select"
                data-testid="workspace-search-scope"
                value={searchScope}
                onChange={(event) => setSearchScope(event.target.value as WorkspaceSearchScope)}
                disabled={!selectedWorkspaceId}
              >
                <option value="ALL">all</option>
                <option value="CHANNELS">channels</option>
                <option value="MESSAGES">messages</option>
                <option value="FILES">files</option>
                <option value="MEMBERS">members</option>
              </select>
              <label className="checkbox-row compact-checkbox">
                <input
                  checked={searchOnlyCurrentChannel}
                  data-testid="workspace-search-current-channel"
                  type="checkbox"
                  onChange={(event) => setSearchOnlyCurrentChannel(event.target.checked)}
                  disabled={!selectedWorkspaceId || !selectedChannelId}
                />
                <span>Current channel</span>
              </label>
            </div>
            <button
              className="ghost-button workspace-settings-trigger"
              data-testid="workspace-settings-trigger"
              type="button"
              onClick={openWorkspaceSettingsPage}
              disabled={!selectedWorkspaceId}
            >
              <span className="workspace-settings-trigger-icon" aria-hidden="true">
                <SettingsIcon />
              </span>
              <span>Workspace settings</span>
            </button>
            <ThemeToggleButton
              theme={theme}
              onToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            />
            {currentWorkspace ? <span className="role-chip">{currentWorkspace.role.toLowerCase()}</span> : null}
          </div>
        </header>

        {errorMessage ? <p className="error-banner inline">{errorMessage}</p> : null}

        {deferredSearchQuery.length >= 2 ? (
          <section className="search-panel info-card">
            <div className="section-header">
              <h3>Search results</h3>
              <span>
                {searchResultsQuery.isFetching
                  ? 'Searching…'
                  : `${searchResultsQuery.data?.totalCount ?? 0} hits · ${searchScope.toLowerCase()}`}
              </span>
            </div>

            {searchChannelId && currentChannel ? (
              <p className="muted-copy">Filtered to #{currentChannel.name}.</p>
            ) : null}

            {searchResultsQuery.data ? (
              <div className="search-grid">
                <div>
                  <h4>Channels</h4>
                  <div className="search-result-list">
                    {searchResultsQuery.data.channels.length ? (
                      searchResultsQuery.data.channels.map((channel) => (
                        <button
                          className="search-result-item"
                          key={channel.id}
                          type="button"
                          onClick={() => {
                            setSelectedChannelId(channel.id);
                            setSearchQuery('');
                          }}
                        >
                          <strong>{renderHighlightedText(`#${channel.name}`, searchResultsQuery.data.query)}</strong>
                          <span>
                            {channel.description
                              ? renderHighlightedText(channel.description, searchResultsQuery.data.query)
                              : channel.type.toLowerCase()}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="muted-copy">No matching channels.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4>Messages</h4>
                  <div className="search-result-list">
                    {searchResultsQuery.data.messages.length ? (
                      searchResultsQuery.data.messages.map((message) => (
                        <button
                          className="search-result-item"
                          key={message.id}
                          type="button"
                          onClick={() => {
                            setSelectedChannelId(message.channelId);
                            setSearchQuery('');
                          }}
                        >
                          <strong>#{message.channelName}</strong>
                          <span>
                            {renderHighlightedText(`${message.senderDisplayName}: ${message.preview}`, searchResultsQuery.data.query)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="muted-copy">No matching messages.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4>Files</h4>
                  <div className="search-result-list">
                    {searchResultsQuery.data.files.length ? (
                      searchResultsQuery.data.files.map((file) => (
                        <a className="search-result-item" href={resolveApiUrl(file.url)} key={file.id} rel="noreferrer" target="_blank">
                          <strong>{renderHighlightedText(file.originalName, searchResultsQuery.data.query)}</strong>
                          <span>{renderHighlightedText(file.preview, searchResultsQuery.data.query)}</span>
                        </a>
                      ))
                    ) : (
                      <p className="muted-copy">No matching files.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4>Members</h4>
                  <div className="search-result-list">
                    {searchResultsQuery.data.members.length ? (
                      searchResultsQuery.data.members.map((member) => (
                        <div className="search-result-item static" key={member.userId}>
                          <strong>{renderHighlightedText(member.displayName, searchResultsQuery.data.query)}</strong>
                          <span>{renderHighlightedText(member.email, searchResultsQuery.data.query)} · {member.role.toLowerCase()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="muted-copy">No matching members.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted-copy">Start typing to search within this workspace.</p>
            )}
          </section>
        ) : null}

        <div className="message-stream">
          {messagesQuery.hasNextPage ? (
            <button
              className="ghost-button load-more-button"
              type="button"
              onClick={() => void messagesQuery.fetchNextPage()}
              disabled={messagesQuery.isFetchingNextPage}
            >
              {messagesQuery.isFetchingNextPage ? 'Loading…' : 'Load older messages'}
            </button>
          ) : null}

          {deferredMessages.length > 0 ? (
            deferredMessages.map((message) => (
              <article data-testid="message-card" className={message.isDeleted ? 'message-card group deleted' : 'message-card group'} key={message.id}>
                <div className="message-meta">
                  <strong>{message.sender.displayName}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>

                {editingMessageId === message.id ? (
                  <form
                    className="message-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateMessageMutation.mutate({
                        messageId: message.id,
                        content: editingMessageDraft,
                      });
                    }}
                  >
                    <textarea
                      value={editingMessageDraft}
                      onChange={(event) => setEditingMessageDraft(event.target.value)}
                      minLength={1}
                      required
                    />
                    <div className="message-toolbar">
                      <button className="primary-button" type="submit" disabled={updateMessageMutation.isPending}>
                        Save
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditingMessageDraft('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p>{message.content}</p>
                    {message.attachments.length > 0 ? (
                      <div className="attachment-list">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            className="attachment-chip"
                            href={resolveApiUrl(attachment.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {attachment.originalName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.reactions.length > 0 ? (
                      <div className="reaction-list">
                        {message.reactions.map((reaction) => (
                          <button
                            className={reaction.reactedByCurrentUser ? 'reaction-chip active' : 'reaction-chip'}
                            key={reaction.emoji}
                            type="button"
                            onClick={() => toggleReaction(message, reaction.emoji)}
                          >
                            <span>{reaction.emoji}</span>
                            <small>{reaction.count}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div className="message-supporting-meta">
                      <span>
                        {message.threadReplyCount > 0
                          ? `${message.threadReplyCount} ${message.threadReplyCount === 1 ? 'reply' : 'replies'}`
                          : 'No replies yet'}
                      </span>
                      {message.readReceipts.length > 0 ? (
                        <span>{formatReadReceiptSummary(message.readReceipts)}</span>
                      ) : null}
                    </div>

                    {!message.isDeleted ? (
                      <div className="message-toolbar extended">
                        <button
                          className={activeThreadMessageId === message.id ? 'ghost-button active-chip' : 'ghost-button'}
                          type="button"
                          onClick={() => setActiveThreadMessageId((current) => (current === message.id ? null : message.id))}
                        >
                          Thread
                        </button>
                        {['👍', '❤️', '👀'].map((emoji) => (
                          <button
                            className="ghost-button emoji-button"
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(message, emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditingMessageDraft(message.content);
                          }}
                          hidden={!message.isOwnMessage}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          onClick={() => deleteMessageMutation.mutate(message.id)}
                          hidden={!message.isOwnMessage}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>No messages yet</h3>
              <p>Post the first message in this channel to seed the conversation.</p>
            </div>
          )}
        </div>

        {activeThreadRootMessage ? (
          <section className="thread-panel info-card">
            <div className="section-header">
              <h3>Thread</h3>
              <span>{activeThreadRootMessage.sender.displayName}</span>
            </div>

            <div className="thread-root-card">
              <strong>{activeThreadRootMessage.sender.displayName}</strong>
              <p>{activeThreadRootMessage.content}</p>
            </div>

            <div className="thread-message-list">
              {threadMessagesQuery.data?.length ? (
                threadMessagesQuery.data.map((message) => (
                  <article className="thread-message" key={message.id}>
                    <div className="message-meta">
                      <strong>{message.sender.displayName}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <p>{message.content}</p>
                    {message.reactions.length > 0 ? (
                      <div className="reaction-list compact">
                        {message.reactions.map((reaction) => (
                          <button
                            className={reaction.reactedByCurrentUser ? 'reaction-chip active' : 'reaction-chip'}
                            key={reaction.emoji}
                            type="button"
                            onClick={() => toggleReaction(message, reaction.emoji)}
                          >
                            <span>{reaction.emoji}</span>
                            <small>{reaction.count}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="muted-copy">No replies yet. Start the thread.</p>
              )}
            </div>

            <form
              className="compact-form stacked"
              onSubmit={(event) => {
                event.preventDefault();

                if (!activeThreadMessageId) {
                  return;
                }

                sendThreadReplyMutation.mutate({
                  content: threadDraft,
                  parentMessageId: activeThreadMessageId,
                });
              }}
            >
              <textarea
                data-testid="thread-reply-input"
                placeholder="Reply in thread"
                value={threadDraft}
                onChange={(event) => setThreadDraft(event.target.value)}
                minLength={1}
                required
              />
              <div className="thread-actions">
                <button className="primary-button" type="submit" disabled={sendThreadReplyMutation.isPending || !threadDraft.trim()}>
                  Reply
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveThreadMessageId(null)}>
                  Close thread
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessageMutation.mutate({
              content: messageDraft,
              attachments: pendingAttachments,
            });
          }}
        >
          <button
            className="composer-resize-handle"
            type="button"
            aria-label="Resize message input"
            title="Drag up or down to resize input"
            onPointerDown={handleComposerResizeStart}
            onPointerMove={handleComposerResizeMove}
            onPointerUp={handleComposerResizeEnd}
            onPointerCancel={handleComposerResizeEnd}
            onDoubleClick={() => setComposerInputHeight(COMPOSER_MIN_HEIGHT_PX)}
          />

          {typingUsers.length > 0 ? (
            <p className="typing-indicator">{typingUsers.join(', ')} typing…</p>
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div className="attachment-list composer-attachments">
              {pendingAttachments.map((attachment) => (
                <div className="attachment-chip removable" key={attachment.id}>
                  <span>{attachment.originalName}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingAttachments((current) =>
                        current.filter((candidate) => candidate.id !== attachment.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="composer-input-row">
            <textarea
              ref={composerInputRef}
              className="composer-input"
              data-testid="composer-input"
              placeholder={currentChannel ? `Message #${currentChannel.name}` : 'Select a channel first'}
              value={messageDraft}
              style={{ height: `${composerInputHeight}px` }}
              onChange={(event) => setMessageDraft(event.target.value)}
              disabled={!currentChannel}
              required
            />

            <div className="composer-end-actions">
              <label
                className={
                  !currentChannel || isUploadingAttachments
                    ? 'composer-icon-button attach pending disabled'
                    : 'composer-icon-button attach'
                }
                aria-label={isUploadingAttachments ? 'Uploading attachments' : 'Attach files'}
              >
                <AttachIcon />
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    void handleAttachmentSelection(event.target.files);
                    event.target.value = '';
                  }}
                  disabled={!currentChannel || isUploadingAttachments}
                />
              </label>

              <button
                className="composer-icon-button send"
                data-testid="send-message-button"
                type="submit"
                aria-label="Send message"
                disabled={!currentChannel || sendMessageMutation.isPending || isUploadingAttachments}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>

        {selectedWorkspaceId && isWorkspaceSettingsOpen ? (
          <>
            <aside className="workspace-settings-drawer open">
              <div className="workspace-settings-header">
                <div>
                  <p className="eyebrow">Workspace settings</p>
                  <h3>{currentWorkspace?.name ?? 'Workspace options'}</h3>
                  <p className="workspace-settings-copy">
                    Manage users and collaboration controls in a dedicated settings page, then switch to analytics when needed.
                  </p>

                  <div className="workspace-settings-tabs" role="tablist" aria-label="Workspace settings sections">
                    <button
                      className={workspaceSettingsTab === 'manage' ? 'workspace-settings-tab active' : 'workspace-settings-tab'}
                      type="button"
                      role="tab"
                      aria-selected={workspaceSettingsTab === 'manage'}
                      onClick={() => setWorkspaceSettingsTab('manage')}
                    >
                      Manage users
                    </button>
                    <button
                      className={workspaceSettingsTab === 'analytics' ? 'workspace-settings-tab active' : 'workspace-settings-tab'}
                      type="button"
                      role="tab"
                      aria-selected={workspaceSettingsTab === 'analytics'}
                      onClick={() => setWorkspaceSettingsTab('analytics')}
                    >
                      Analytics
                    </button>
                  </div>
                </div>
                <button
                  className="ghost-button workspace-settings-close"
                  type="button"
                  onClick={closeWorkspaceSettingsPage}
                  aria-label="Back to chat"
                >
                  <CloseIcon />
                </button>
              </div>

              <section className="collaboration-grid workspace-settings-grid">
                {workspaceSettingsTab === 'manage' ? (
                  <>
                <article className="info-card">
                  <div className="section-header">
                    <h3>Channel members</h3>
                    <span>{channelMembersQuery.data?.length ?? 0}</span>
                  </div>

                  {currentChannel ? (
                    <>
                      {currentChannel.type === 'PRIVATE' && canManageWorkspace ? (
                        <form
                          className="compact-form stacked"
                          onSubmit={(event) => {
                            event.preventDefault();
                            addChannelMemberMutation.mutate(channelMemberUserId);
                          }}
                        >
                          <select
                            data-testid="channel-member-select"
                            value={channelMemberUserId}
                            onChange={(event) => setChannelMemberUserId(event.target.value)}
                            required
                          >
                            <option value="">Add workspace member</option>
                            {availableChannelMemberCandidates.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.displayName} ({member.email})
                              </option>
                            ))}
                          </select>
                          <button
                            className="primary-button"
                            data-testid="add-channel-member-button"
                            type="submit"
                            disabled={!channelMemberUserId || addChannelMemberMutation.isPending}
                          >
                            Add member
                          </button>
                        </form>
                      ) : null}

                      <div className="member-list">
                        {channelMembersQuery.data?.length ? (
                          channelMembersQuery.data.map((member) => (
                            <div className="member-row" key={member.userId}>
                              <div>
                                <strong>{member.displayName}</strong>
                                <span>
                                  {member.email}
                                  {member.isCurrentUser ? ' · you' : ''}
                                </span>
                              </div>

                              {currentChannel.type === 'PRIVATE' && canManageWorkspace && !member.isCurrentUser ? (
                                <div className="member-actions">
                                  <button
                                    className="ghost-button danger-button"
                                    type="button"
                                    onClick={() => removeChannelMemberMutation.mutate(member.userId)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="muted-copy">No members available for this channel.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="muted-copy">Select a channel to inspect its membership.</p>
                  )}
                </article>

                <article className="info-card">
                  <div className="section-header">
                    <h3>Notifications</h3>
                    <span>{unreadNotificationCount}</span>
                  </div>

                  <button
                    className="ghost-button"
                    data-testid="mark-all-notifications-read-button"
                    type="button"
                    onClick={() => markAllNotificationsReadMutation.mutate()}
                    disabled={!notificationsQuery.data?.length || markAllNotificationsReadMutation.isPending}
                  >
                    Mark all read
                  </button>

                  {notificationPreferences ? (
                    <div className="notification-preferences">
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.muteAll}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ muteAll: event.target.checked })
                          }
                        />
                        <span>Mute all notifications in this workspace</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.allowMentions}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ allowMentions: event.target.checked })
                          }
                        />
                        <span>Allow mention notifications</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.emailMentions}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ emailMentions: event.target.checked })
                          }
                        />
                        <span>Email mention notifications</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.emailDigest}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ emailDigest: event.target.checked })
                          }
                        />
                        <span>Email daily digests</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.pushMentions}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ pushMentions: event.target.checked })
                          }
                        />
                        <span>Push mention notifications</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          checked={notificationPreferences.pushDigest}
                          type="checkbox"
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({ pushDigest: event.target.checked })
                          }
                        />
                        <span>Push daily digests</span>
                      </label>
                      <label className="field compact-field">
                        <span>Digest</span>
                        <select
                          value={notificationPreferences.digestMode}
                          onChange={(event) =>
                            updateNotificationPreferencesMutation.mutate({
                              digestMode: event.target.value as NotificationPreferenceSummary['digestMode'],
                            })
                          }
                        >
                          <option value="OFF">off</option>
                          <option value="DAILY">daily</option>
                        </select>
                      </label>

                      <div className="digest-actions">
                        <p className="muted-copy">
                          {notificationPreferences.lastDigestAt
                            ? `Last digest ${formatTime(notificationPreferences.lastDigestAt)}`
                            : 'No digest generated yet.'}
                        </p>
                        <button
                          className="ghost-button"
                          data-testid="run-digest-button"
                          type="button"
                          onClick={() => runDigestMutation.mutate()}
                          disabled={notificationPreferences.digestMode !== 'DAILY' || runDigestMutation.isPending}
                        >
                          Run digest now
                        </button>
                      </div>

                      <p className="muted-copy">Email and push delivery both use local outboxes by default and can switch to external transports through API environment settings.</p>

                      {channelsQuery.data?.length ? (
                        <div className="muted-channel-list">
                          {channelsQuery.data.map((channel) => {
                            const muted = notificationPreferences.mutedChannelIds.includes(channel.id);

                            return (
                              <label className="checkbox-row" key={channel.id}>
                                <input
                                  checked={muted}
                                  type="checkbox"
                                  onChange={(event) => {
                                    const nextMutedChannelIds = event.target.checked
                                      ? [...notificationPreferences.mutedChannelIds, channel.id]
                                      : notificationPreferences.mutedChannelIds.filter((candidate) => candidate !== channel.id);

                                    updateNotificationPreferencesMutation.mutate({ mutedChannelIds: nextMutedChannelIds });
                                  }}
                                />
                                <span>Mute #{channel.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="notification-list">
                    {notificationsQuery.data?.length ? (
                      notificationsQuery.data.slice(0, 6).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          data-testid={notification.readAt ? 'notification-card-read' : 'notification-card-unread'}
                          className={notification.readAt ? 'notification-card group' : 'notification-card group unread'}
                          onClick={() => {
                            if (notification.channelId) {
                              setSelectedChannelId(notification.channelId);
                            }
                            markNotificationReadMutation.mutate(notification.id);
                          }}
                        >
                          <strong>{notification.title}</strong>
                          <span>{notification.body}</span>
                          <small>{formatTime(notification.createdAt)}</small>
                        </button>
                      ))
                    ) : (
                      <p className="muted-copy">No notifications yet.</p>
                    )}
                  </div>
                </article>

                <article className="info-card">
                  <div className="section-header">
                    <h3>Members</h3>
                    <span>{membersQuery.data?.length ?? 0}</span>
                  </div>

                  <div className="member-list">
                    {membersQuery.data?.map((member) => {
                      const canEditMember = canManageMember(currentWorkspace?.role, member);

                      return (
                        <div className="member-row" key={member.userId}>
                          <div>
                            <strong>{member.displayName}</strong>
                            <span>
                              {onlineUserIds.includes(member.userId) ? 'online · ' : ''}
                              {member.email}
                              {member.isCurrentUser ? ' · you' : ''}
                            </span>
                          </div>

                          <div className="member-actions">
                            {canEditMember ? (
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  updateMemberRoleMutation.mutate({
                                    memberUserId: member.userId,
                                    role: event.target.value as Exclude<WorkspaceRole, 'OWNER'>,
                                  })
                                }
                              >
                                {getAssignableRoles(currentWorkspace?.role).map((role) => (
                                  <option key={role} value={role}>
                                    {role.toLowerCase()}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="role-label">{member.role.toLowerCase()}</span>
                            )}

                            {!member.isCurrentUser ? (
                              <button
                                className={mutedMemberIds.includes(member.userId) ? 'ghost-button active-chip' : 'ghost-button'}
                                type="button"
                                onClick={() =>
                                  setMutedMemberIds((current) =>
                                    current.includes(member.userId)
                                      ? current.filter((candidate) => candidate !== member.userId)
                                      : [...current, member.userId],
                                  )
                                }
                              >
                                {mutedMemberIds.includes(member.userId) ? 'Unmute member' : 'Mute member'}
                              </button>
                            ) : null}

                            {canRemoveMember(currentWorkspace?.role, member) ? (
                              <button
                                className="ghost-button danger-button"
                                type="button"
                                onClick={() => removeMemberMutation.mutate(member.userId)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="info-card">
                  <div className="section-header">
                    <h3>Invitations</h3>
                    <span>{invitationsQuery.data?.length ?? 0}</span>
                  </div>

                  {canManageWorkspace ? (
                    <form
                      className="compact-form stacked"
                      onSubmit={(event) => {
                        event.preventDefault();
                        createInvitationMutation.mutate(inviteForm);
                      }}
                    >
                      <input
                        data-testid="invite-email-input"
                        placeholder="Invite email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(event) =>
                          setInviteForm((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                      />
                      <select
                        value={inviteForm.role}
                        onChange={(event) =>
                          setInviteForm((current) => ({
                            ...current,
                            role: event.target.value as WorkspaceRole,
                          }))
                        }
                      >
                        {getInvitableRoles(currentWorkspace?.role).map((role) => (
                          <option key={role} value={role}>
                            {role.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <button className="primary-button" data-testid="create-invite-button" type="submit" disabled={createInvitationMutation.isPending}>
                        Create invite
                      </button>
                    </form>
                  ) : (
                    <p className="muted-copy">Only admins and owners can create invitations.</p>
                  )}

                  <div className="invitation-list">
                    {invitationsQuery.data?.length ? (
                      invitationsQuery.data.map((invitation) => (
                        <div className="invitation-card" key={invitation.id}>
                          <strong>{invitation.email}</strong>
                          <span>{invitation.role.toLowerCase()} access</span>
                          <code data-testid="invitation-token">{invitation.token}</code>
                          {canManageWorkspace ? (
                            <button
                              className="ghost-button danger-button"
                              type="button"
                              onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                            >
                              Revoke
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="muted-copy">No pending invitations for this workspace.</p>
                    )}
                  </div>
                </article>

                <article className="info-card">
                  <div className="section-header">
                    <h3>Muted members</h3>
                    <span>{mutedMemberIds.length}</span>
                  </div>

                  {mutedMemberIds.length > 0 ? (
                    <div className="member-list">
                      {membersQuery.data
                        ?.filter((member) => mutedMemberIds.includes(member.userId))
                        .map((member) => (
                          <div className="member-row" key={member.userId}>
                            <div>
                              <strong>{member.displayName}</strong>
                              <span>{member.email}</span>
                            </div>
                            <div className="member-actions">
                              <button
                                className="ghost-button"
                                type="button"
                                onClick={() =>
                                  setMutedMemberIds((current) =>
                                    current.filter((candidate) => candidate !== member.userId),
                                  )
                                }
                              >
                                Unmute member
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="muted-copy">No muted members in this workspace.</p>
                  )}
                </article>

                  </>
                ) : null}

                {workspaceSettingsTab === 'analytics' && currentWorkspaceCanManage(currentWorkspaceRole) ? (
                  <article className="info-card organization-card" data-testid="organization-admin-card">
                    <div className="section-header">
                      <h3>Organization</h3>
                      <span>{currentOrganization?.workspaceCount ?? 0}</span>
                    </div>

                    {currentOrganization ? (
                      <>
                        <div className="organization-summary">
                          <strong>{currentOrganization.name}</strong>
                          <span>
                            {currentOrganization.memberCount} members · {currentOrganization.workspaceCount} workspaces · {currentOrganization.role.toLowerCase()} access
                          </span>
                        </div>

                        <form
                          className="compact-form stacked"
                          onSubmit={(event) => {
                            event.preventDefault();
                            createOrganizationWorkspaceMutation.mutate(organizationWorkspaceName);
                          }}
                        >
                          <input
                            data-testid="organization-workspace-input"
                            placeholder="Create workspace inside this organization"
                            value={organizationWorkspaceName}
                            onChange={(event) => setOrganizationWorkspaceName(event.target.value)}
                            minLength={2}
                            maxLength={50}
                            required
                          />
                          <button
                            className="primary-button"
                            data-testid="organization-workspace-button"
                            type="submit"
                            disabled={!organizationWorkspaceName.trim() || createOrganizationWorkspaceMutation.isPending}
                          >
                            Add organization workspace
                          </button>
                        </form>

                        <div className="organization-workspace-list">
                          {organizationWorkspacesQuery.data?.length ? (
                            organizationWorkspacesQuery.data.map((workspace) => (
                              <button
                                className={workspace.id === selectedWorkspaceId ? 'organization-workspace-row active' : 'organization-workspace-row'}
                                data-testid="organization-workspace-row"
                                key={workspace.id}
                                type="button"
                                onClick={() => setSelectedWorkspaceId(workspace.id)}
                              >
                                <strong>{workspace.name}</strong>
                                <span>
                                  {workspace.memberCount} members · {workspace.currentUserRole?.toLowerCase() ?? 'no workspace access'}
                                </span>
                              </button>
                            ))
                          ) : (
                            <p className="muted-copy">No workspaces in this organization yet.</p>
                          )}
                        </div>

                        <div className="organization-member-list">
                          {organizationMembersQuery.data?.length ? (
                            organizationMembersQuery.data.map((member) => (
                              <div className="member-row organization-member-row" key={member.userId}>
                                <div>
                                  <strong>{member.displayName}</strong>
                                  <span>
                                    {member.email}
                                    {member.isCurrentUser ? ' · you' : ''}
                                    {' · '}
                                    {member.role.toLowerCase()}
                                  </span>
                                  <small>{member.workspaceAccess.map((workspaceAccess) => `${workspaceAccess.workspaceName} (${workspaceAccess.role.toLowerCase()})`).join(' · ')}</small>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="muted-copy">
                              {organizationMembersQuery.isFetching
                                ? 'Loading organization members…'
                                : 'No organization member overview available yet.'}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="muted-copy">This workspace is still resolving its organization context.</p>
                    )}
                  </article>
                ) : null}

                {workspaceSettingsTab === 'analytics' && currentWorkspaceCanManage(currentWorkspaceRole) ? (
                  <article className="info-card analytics-card" data-testid="workspace-analytics-card">
                    <div className="section-header">
                      <h3>Analytics</h3>
                      <span>{analyticsQuery.data?.activity.messages30d ?? 0}</span>
                    </div>

                    {analyticsQuery.data ? (
                      <>
                        <div className="analytics-kpis">
                          <div className="analytics-kpi">
                            <strong>{analyticsQuery.data.activity.activeMembers7d}</strong>
                            <span>active members · 7d</span>
                          </div>
                          <div className="analytics-kpi">
                            <strong>{analyticsQuery.data.activity.messages30d}</strong>
                            <span>messages · 30d</span>
                          </div>
                          <div className="analytics-kpi">
                            <strong>{analyticsQuery.data.retention.engagedMemberRate30d}%</strong>
                            <span>engaged retention · 30d</span>
                          </div>
                          <div className="analytics-kpi">
                            <strong>{analyticsQuery.data.adminActivity.memberChanges30d}</strong>
                            <span>member admin actions · 30d</span>
                          </div>
                        </div>

                        <div className="analytics-inline-summary">
                          <span>{analyticsQuery.data.retention.newMembers30d} new members in the last 30 days</span>
                          <span>{analyticsQuery.data.activity.files30d} files shared</span>
                          <span>{analyticsQuery.data.activity.auditEvents30d} audit events</span>
                        </div>

                        <div className="analytics-volume">
                          {analyticsQuery.data.messageVolume.map((point) => {
                            const maxCount = Math.max(...analyticsQuery.data.messageVolume.map((entry) => entry.count), 1);
                            const height = `${Math.max((point.count / maxCount) * 100, point.count > 0 ? 18 : 6)}%`;

                            return (
                              <div className="analytics-volume-column" key={point.date} title={`${point.date}: ${point.count} messages`}>
                                <small>{point.count}</small>
                                <div className="analytics-volume-bar-wrap">
                                  <span className="analytics-volume-bar" style={{ height }} />
                                </div>
                                <span>{formatCompactDate(point.date)}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="analytics-channel-list">
                          {analyticsQuery.data.topChannels.length ? (
                            analyticsQuery.data.topChannels.map((channel) => (
                              <div className="analytics-channel-row" key={channel.channelId}>
                                <strong>#{channel.channelName}</strong>
                                <span>{channel.messageCount} messages · 30d</span>
                              </div>
                            ))
                          ) : (
                            <p className="muted-copy">No channel activity yet.</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="muted-copy">
                        {analyticsQuery.isFetching ? 'Loading analytics…' : 'No analytics snapshot available yet.'}
                      </p>
                    )}
                  </article>
                ) : null}

                {workspaceSettingsTab === 'analytics' && currentWorkspaceCanManage(currentWorkspaceRole) ? (
                  <article className="info-card">
                    <div className="section-header">
                      <h3>Audit trail</h3>
                      <span>{auditLogsQuery.data?.length ?? 0}</span>
                    </div>

                    <div className="audit-toolbar">
                      <label className="field compact-field">
                        <span>Filter</span>
                        <select
                          data-testid="audit-action-filter"
                          value={auditActionFilter}
                          onChange={(event) => setAuditActionFilter(event.target.value as typeof auditActionFilter)}
                        >
                          <option value="ALL">all actions</option>
                          <option value="WORKSPACE_CREATED">workspace created</option>
                          <option value="WORKSPACE_UPDATED">workspace updated</option>
                          <option value="INVITATION_CREATED">invitation created</option>
                          <option value="INVITATION_REVOKED">invitation revoked</option>
                          <option value="INVITATION_ACCEPTED">invitation accepted</option>
                          <option value="MEMBER_ROLE_UPDATED">member role updated</option>
                          <option value="MEMBER_REMOVED">member removed</option>
                          <option value="CHANNEL_CREATED">channel created</option>
                          <option value="CHANNEL_UPDATED">channel updated</option>
                          <option value="CHANNEL_DELETED">channel deleted</option>
                          <option value="CHANNEL_MEMBER_ADDED">channel member added</option>
                          <option value="CHANNEL_MEMBER_REMOVED">channel member removed</option>
                        </select>
                      </label>
                    </div>

                    <div className="audit-list" data-testid="audit-log-list">
                      {auditLogsQuery.data?.length ? (
                        auditLogsQuery.data.map((log) => (
                          <article className="audit-log-item" data-testid="audit-log-item" key={log.id}>
                            <strong>{formatAuditLogTitle(log)}</strong>
                            <span>{formatAuditLogDetail(log)}</span>
                            <small>{formatTime(log.createdAt)}</small>
                          </article>
                        ))
                      ) : (
                        <p className="muted-copy">No audit events yet.</p>
                      )}
                    </div>
                  </article>
                ) : null}
              </section>
            </aside>
          </>
        ) : null}
      </section>
    </main>
  );
}

function currentWorkspaceCanManage(role: WorkspaceRole | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

function getInvitableRoles(role: WorkspaceRole | undefined) {
  if (role === 'OWNER') {
    return memberRoleOptions;
  }

  if (role === 'ADMIN') {
    return ['MEMBER'] as WorkspaceRole[];
  }

  return ['MEMBER'] as WorkspaceRole[];
}

function getAssignableRoles(role: WorkspaceRole | undefined) {
  if (role === 'OWNER') {
    return ['ADMIN', 'MEMBER'] as Exclude<WorkspaceRole, 'OWNER'>[];
  }

  return ['MEMBER'] as Exclude<WorkspaceRole, 'OWNER'>[];
}

function canManageMember(role: WorkspaceRole | undefined, member: WorkspaceMemberSummary) {
  if (!role || member.role === 'OWNER' || member.isCurrentUser) {
    return false;
  }

  if (role === 'OWNER') {
    return member.role === 'ADMIN' || member.role === 'MEMBER';
  }

  return role === 'ADMIN' && member.role === 'MEMBER';
}

function canRemoveMember(role: WorkspaceRole | undefined, member: WorkspaceMemberSummary) {
  return canManageMember(role, member);
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatReadReceiptSummary(
  readReceipts: Array<{
    displayName: string;
    readAt: string;
  }>,
) {
  if (readReceipts.length === 0) {
    return 'Unread';
  }

  const visibleNames = readReceipts.slice(0, 3).map((receipt) => receipt.displayName);

  if (readReceipts.length <= 3) {
    return `Read by ${visibleNames.join(', ')}`;
  }

  return `Read by ${visibleNames.join(', ')} +${readReceipts.length - 3}`;
}

function ThemeToggleButton({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const isDark = theme === 'dark';

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="theme-toggle-text">{isDark ? 'Day mode' : 'Night mode'}</span>
    </button>
  );
}


  function renderHighlightedText(value: string, query: string): ReactNode {
    const terms = Array.from(new Set(query.toLowerCase().split(/\s+/).filter(Boolean)));

    if (terms.length === 0) {
      return value;
    }

    const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
    const parts = value.split(pattern);

    return parts.map((part, index) =>
      terms.includes(part.toLowerCase()) ? <mark key={`${part}-${index}`}>{part}</mark> : part,
    );
  }

  function formatAuditLogTitle(log: AuditLogSummary) {
    const actor = log.actorDisplayName;
    const subject = log.entityLabel ? ` ${log.entityLabel}` : '';

    switch (log.action) {
      case 'WORKSPACE_CREATED':
        return `${actor} created workspace${subject}`;
      case 'WORKSPACE_UPDATED':
        return `${actor} updated workspace${subject}`;
      case 'INVITATION_CREATED':
        return `${actor} invited ${log.metadata.email ?? log.entityLabel ?? 'a member'}`;
      case 'INVITATION_REVOKED':
        return `${actor} revoked invite for ${log.metadata.email ?? log.entityLabel ?? 'a member'}`;
      case 'INVITATION_ACCEPTED':
        return `${actor} accepted an invitation`;
      case 'MEMBER_ROLE_UPDATED':
        return `${actor} changed ${log.targetDisplayName ?? 'a member'} to ${(log.metadata.nextRole ?? 'member').toString().toLowerCase()}`;
      case 'MEMBER_REMOVED':
        return `${actor} removed ${log.targetDisplayName ?? 'a member'}`;
      case 'CHANNEL_CREATED':
        return `${actor} created channel #${log.entityLabel ?? 'channel'}`;
      case 'CHANNEL_UPDATED':
        return `${actor} updated channel #${log.entityLabel ?? 'channel'}`;
      case 'CHANNEL_DELETED':
        return `${actor} deleted channel #${log.entityLabel ?? 'channel'}`;
      case 'CHANNEL_MEMBER_ADDED':
        return `${actor} added ${log.targetDisplayName ?? 'a member'} to #${log.entityLabel ?? 'channel'}`;
      case 'CHANNEL_MEMBER_REMOVED':
        return `${actor} removed ${log.targetDisplayName ?? 'a member'} from #${log.entityLabel ?? 'channel'}`;
      default:
        return `${actor} performed ${String(log.action).toLowerCase()}`;
    }
  }

  function formatAuditLogDetail(log: AuditLogSummary) {
    const metadataEntries = Object.entries(log.metadata)
      .filter(([, value]) => value !== null && value !== '')
      .map(([key, value]) => `${key}: ${String(value).toLowerCase()}`);

    if (metadataEntries.length === 0) {
      return log.entityType.toLowerCase();
    }

    return metadataEntries.join(' · ');
  }

  function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2" />
      <path d="M12 19.3v2.2" />
      <path d="M4.9 4.9l1.6 1.6" />
      <path d="M17.5 17.5l1.6 1.6" />
      <path d="M2.5 12h2.2" />
      <path d="M19.3 12h2.2" />
      <path d="M4.9 19.1l1.6-1.6" />
      <path d="M17.5 6.5l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.57 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1.03H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.57-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c0 .68.4 1.3 1.03 1.55H21a2 2 0 0 1 0 4h-.09c-.68 0-1.3.4-1.51 1.03Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function DrawerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function TopBarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="4" rx="1.5" />
      <path d="M8 13h8" />
      <path d="m10 17 2 2 2-2" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.4 11.2 12 20.6a6 6 0 1 1-8.5-8.5l9.4-9.4a4 4 0 1 1 5.7 5.7l-9.5 9.5a2 2 0 1 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5 21 3l-8.5 18-2.3-7.2L3 11.5Z" />
      <path d="M10.2 13.8 21 3" />
    </svg>
  );
}
