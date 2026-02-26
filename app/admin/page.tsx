"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, FileText, Activity, LogIn } from "lucide-react";
import { StatsCard } from "@/components/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

interface DashboardStats {
  totalUsers: number;
  totalChats: number;
  totalDocuments: number;
  totalMessages: number;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
  }>;
  recentChats: Array<{
    id: string;
    title: string;
    userName: string;
    createdAt: string;
  }>;
}

interface RecentChatItem {
  id: string;
  title: string;
  userName: string | null;
  createdAt: string;
}

interface ActivityItem {
  type: "login" | "chat_created";
  createdAt: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  chatId?: string;
  chatTitle?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [activityUserId, setActivityUserId] = useState("all");
  const [activityUsers, setActivityUsers] = useState<UserOption[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChatItem[]>([]);
  const [isRecentChatsLoading, setIsRecentChatsLoading] = useState(true);
  const [recentChatsUserId, setRecentChatsUserId] = useState("all");

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    async function fetchActivityUsers() {
      try {
        const response = await authClient.admin.listUsers({
          query: {
            limit: 100,
            offset: 0,
            sortBy: "createdAt",
            sortDirection: "desc",
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        const users = (response.data?.users ?? []) as UserOption[];
        setActivityUsers(users);
      } catch (error) {
        console.error("Failed to fetch users for activity filter:", error);
      }
    }

    fetchActivityUsers();
  }, []);

  useEffect(() => {
    async function fetchActivity() {
      setIsActivityLoading(true);

      try {
        const query = activityUserId === "all" ? "" : `?userId=${activityUserId}`;
        const response = await fetch(`/api/admin/activity${query}`);
        if (!response.ok) {
          throw new Error("Failed to fetch activity");
        }

        const data = (await response.json()) as {
          activities: ActivityItem[];
        };
        setActivityItems(data.activities ?? []);
      } catch (error) {
        console.error("Failed to fetch recent activity:", error);
      } finally {
        setIsActivityLoading(false);
      }
    }

    fetchActivity();
  }, [activityUserId]);

  useEffect(() => {
    async function fetchRecentChats() {
      setIsRecentChatsLoading(true);

      try {
        const query =
          recentChatsUserId === "all" ? "" : `?userId=${recentChatsUserId}`;
        const response = await fetch(`/api/admin/recent-chats${query}`);
        if (!response.ok) {
          throw new Error("Failed to fetch recent chats");
        }

        const data = (await response.json()) as {
          recentChats: RecentChatItem[];
        };
        setRecentChats(data.recentChats ?? []);
      } catch (error) {
        console.error("Failed to fetch recent chats:", error);
      } finally {
        setIsRecentChatsLoading(false);
      }
    }

    fetchRecentChats();
  }, [recentChatsUserId]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Overview of your application&apos;s activity
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="mt-1 h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatsCard
              description="Registered accounts"
              icon={Users}
              title="Total Users"
              value={stats?.totalUsers ?? 0}
            />
            <StatsCard
              description="Conversations started"
              icon={MessageSquare}
              title="Total Chats"
              value={stats?.totalChats ?? 0}
            />
            <StatsCard
              description="Uploaded files"
              icon={FileText}
              title="Documents"
              value={stats?.totalDocuments ?? 0}
            />
            <StatsCard
              description="Messages exchanged"
              icon={Activity}
              title="Messages"
              value={stats?.totalMessages ?? 0}
            />
          </>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="flex items-center gap-4" key={i}>
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentUsers?.length ? (
              <div className="space-y-4">
                {stats.recentUsers.map((user) => (
                  <div className="flex items-center gap-4" key={user.id}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-medium">
                      {user.name?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent users</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent Chats</CardTitle>
            <Select onValueChange={setRecentChatsUserId} value={recentChatsUserId}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {activityUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading || isRecentChatsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="space-y-1" key={i}>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : recentChats.length ? (
              <div className="space-y-4">
                {recentChats.map((chat) => (
                  <div key={chat.id}>
                    <p className="text-sm font-medium">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      by {chat.userName || "Unknown user"} •{" "}
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent chats</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Select onValueChange={setActivityUserId} value={activityUserId}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {activityUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="space-y-1" key={i}>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : activityItems.length ? (
              <div className="space-y-4">
                {activityItems.map((activity, index) => (
                  <div className="flex gap-3" key={`${activity.userId}-${activity.createdAt}-${index}`}>
                    <div className="mt-0.5 text-muted-foreground">
                      {activity.type === "login" ? (
                        <LogIn className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {activity.type === "login"
                          ? "User login"
                          : "Chat created"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.userName || activity.userEmail || "Unknown user"}
                      </p>
                      {activity.type === "chat_created" && activity.chatTitle && (
                        <p className="text-xs text-muted-foreground">
                          {activity.chatTitle}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent activity found.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
