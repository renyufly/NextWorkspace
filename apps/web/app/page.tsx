'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useDeferredValue, useEffect, useRef, useState, startTransition } from 'react';

import type {
  AuthResponse,
  AuthUser,
  ChannelMemberSummary,
  ChannelSummary,
  FileAttachmentSummary,
  MessagePage,
  MessageSummary,
  NotificationSummary,
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
  WorkspaceRole,
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

export default function HomePage() {
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
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState('');
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'MEMBER' as WorkspaceRole });
  const [acceptInviteToken, setAcceptInviteToken] = useState('');
  const [channelMemberUserId, setChannelMemberUserId] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachmentSummary[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const socketRef = useRef<RealtimeSocket | null>(null);
  useEffect(() => {
    const storedTheme = window.localStorage.getItem('worknext-theme');

    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
      return;
    }

    const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
    setTheme(preferredTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('worknext-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setIsWorkspaceSettingsOpen(false);
    }
  }, [selectedWorkspaceId]);

  useEffect(() => {
    if (!isWorkspaceSettingsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWorkspaceSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWorkspaceSettingsOpen]);

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
        content: trimmedContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        isDeleted: false,
        isOwnMessage: true,
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

  const currentWorkspace = workspacesQuery.data?.find((workspace) => workspace.id === selectedWorkspaceId) ?? null;
  const currentChannel = channelsQuery.data?.find((channel) => channel.id === selectedChannelId) ?? null;
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
      void queryClient.invalidateQueries({ queryKey: ['channels', accessToken, selectedWorkspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', accessToken, selectedWorkspaceId] });
    };

    socket.on('connect', () => {
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
    });

    socket.on('message:created', invalidateRealtimeData);
    socket.on('message:updated', invalidateRealtimeData);
    socket.on('message:deleted', invalidateRealtimeData);
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
  }, [accessToken, meQuery.data?.id, queryClient, selectedChannelId, selectedWorkspaceId]);

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

  return (
    <main className="workspace-shell">
      <aside className="workspace-rail brand-rail">
        <div>
          <p className="eyebrow">Local MVP</p>
          <h1>WorkNext</h1>
          <p className="rail-copy">
            {meQuery.data ? `Signed in as ${meQuery.data.displayName}` : 'Loading your session…'}
          </p>
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
                onClick={() => setSelectedChannelId(channel.id)}
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

      <section className="conversation-panel">
        <header className="conversation-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{currentWorkspace?.name ?? 'Create your first workspace'}</h2>
            <p className="conversation-meta">
              {currentChannel
                ? `#${currentChannel.name} · ${currentChannel.type.toLowerCase()} · ${currentChannel.memberCount} members`
                : 'Select a channel to begin chatting'}
            </p>
          </div>
          <div className="conversation-header-actions">
            <button
              className="ghost-button workspace-settings-trigger"
              data-testid="workspace-settings-trigger"
              type="button"
              onClick={() => setIsWorkspaceSettingsOpen(true)}
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
                    {message.isOwnMessage && !message.isDeleted ? (
                      <div className="message-toolbar">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditingMessageDraft(message.content);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="ghost-button danger-button"
                          type="button"
                          onClick={() => deleteMessageMutation.mutate(message.id)}
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

          <textarea
            data-testid="composer-input"
            placeholder={currentChannel ? `Message #${currentChannel.name}` : 'Select a channel first'}
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            disabled={!currentChannel}
            required
          />
          <label className="upload-field">
            <span>{isUploadingAttachments ? 'Uploading attachments…' : 'Attach files'}</span>
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
            className="primary-button"
            data-testid="send-message-button"
            type="submit"
            disabled={!currentChannel || sendMessageMutation.isPending || isUploadingAttachments}
          >
            Send message
          </button>
        </form>

        {selectedWorkspaceId ? (
          <>
            <button
              type="button"
              className={isWorkspaceSettingsOpen ? 'workspace-settings-overlay open' : 'workspace-settings-overlay'}
              aria-label="Close workspace settings"
              onClick={() => setIsWorkspaceSettingsOpen(false)}
            />

            <aside className={isWorkspaceSettingsOpen ? 'workspace-settings-drawer open' : 'workspace-settings-drawer'}>
              <div className="workspace-settings-header">
                <div>
                  <p className="eyebrow">Workspace settings</p>
                  <h3>{currentWorkspace?.name ?? 'Workspace options'}</h3>
                  <p className="workspace-settings-copy">
                    Manage members, notifications, invitations, and private channel access without squeezing the chat timeline.
                  </p>
                </div>
                <button
                  className="ghost-button workspace-settings-close"
                  type="button"
                  onClick={() => setIsWorkspaceSettingsOpen(false)}
                  aria-label="Close workspace settings"
                >
                  <CloseIcon />
                </button>
              </div>

              <section className="collaboration-grid workspace-settings-grid">
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

                  <div className="notification-list">
                    {notificationsQuery.data?.length ? (
                      notificationsQuery.data.slice(0, 6).map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          data-testid={notification.readAt ? 'notification-card-read' : 'notification-card-unread'}
                          className={notification.readAt ? 'notification-card group' : 'notification-card group unread'}
                          onClick={() => {
                            setSelectedChannelId(notification.channelId);
                            markNotificationReadMutation.mutate(notification.id);
                            setIsWorkspaceSettingsOpen(false);
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
