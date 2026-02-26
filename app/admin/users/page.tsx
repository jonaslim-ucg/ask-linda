"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import {
  MoreHorizontal,
  Shield,
  ShieldOff,
  Trash2,
  Search,
  Ban,
  CheckCircle,
  UserPlus,
  LogIn,
  MessageSquare,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface User {
  id: string;
  name: string;
  email: string;
  role: string | null;
  emailVerified: boolean;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  createdAt: Date;
}

interface ActivityItem {
  type: "login" | "chat_created";
  createdAt: string;
  chatId?: string;
  chatTitle?: string;
}

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({ open: false, user: null });

  const [banDialog, setBanDialog] = useState<{
    open: boolean;
    user: User | null;
    reason: string;
  }>({ open: false, user: null, reason: "" });

  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    name: string;
    email: string;
    password: string;
    role: "user" | "admin";
  }>({ open: false, name: "", email: "", password: "", role: "user" });

  const [activityDialog, setActivityDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({ open: false, user: null });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  const { data: session } = authClient.useSession();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, offset: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUsers = useCallback(async () => {
    const response = await authClient.admin.listUsers({
      query: {
        limit: pagination.limit,
        offset: pagination.offset,
        searchValue: debouncedSearch || undefined,
        searchField: "email",
        searchOperator: "contains",
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data;
  }, [pagination.limit, pagination.offset, debouncedSearch]);

  const { data: usersData, isLoading, mutate } = useSWR(
    ["users", pagination.limit, pagination.offset, debouncedSearch],
    fetchUsers,
    {
      onError: (error) => {
        console.error("Failed to fetch users:", error);
        toast.error("Failed to fetch users");
      },
    }
  );

  const users = (usersData?.users as User[]) || [];
  const totalUsers = usersData?.total || 0;

  async function handleRoleChange(userId: string, newRole: "user" | "admin") {
    try {
      const response = await authClient.admin.setRole({
        userId,
        role: newRole,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      mutate();
      toast.success(`User role updated to ${newRole}`);
    } catch {
      toast.error("Failed to update user role");
    }
  }

  async function handleDeleteUser(userId: string) {
    try {
      const response = await authClient.admin.removeUser({
        userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      mutate();
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleteDialog({ open: false, user: null });
    }
  }

  async function handleBanUser(userId: string, reason: string) {
    try {
      const response = await authClient.admin.banUser({
        userId,
        banReason: reason || undefined,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      mutate();
      toast.success("User banned successfully");
    } catch {
      toast.error("Failed to ban user");
    } finally {
      setBanDialog({ open: false, user: null, reason: "" });
    }
  }

  async function handleUnbanUser(userId: string) {
    try {
      const response = await authClient.admin.unbanUser({
        userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      mutate();
      toast.success("User unbanned successfully");
    } catch {
      toast.error("Failed to unban user");
    }
  }

  async function handleImpersonateUser(userId: string) {
    try {
      const response = await authClient.admin.impersonateUser({
        userId,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Now impersonating user. Redirecting...");
      window.location.href = "/";
    } catch {
      toast.error("Failed to impersonate user");
    }
  }

  async function handleViewActivity(user: User) {
    setActivityDialog({ open: true, user });
    setIsActivityLoading(true);
    setActivities([]);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/activity`);
      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }

      const data = (await response.json()) as {
        activities: ActivityItem[];
      };
      setActivities(data.activities ?? []);
    } catch (error) {
      console.error("Failed to load user activity:", error);
      toast.error("Failed to load user activity");
    } finally {
      setIsActivityLoading(false);
    }
  }

  async function handleCreateUser() {
    try {
      const response = await authClient.admin.createUser({
        name: createDialog.name,
        email: createDialog.email,
        password: createDialog.password,
        role: createDialog.role,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("User created successfully");
      setCreateDialog({
        open: false,
        name: "",
        email: "",
        password: "",
        role: "user",
      });
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create user"
      );
    }
  }

  const totalPages = Math.ceil(totalUsers / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Users</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage user accounts ({totalUsers} total)
          </p>
        </div>
        <Button onClick={() => setCreateDialog({ ...createDialog, open: true })} className="w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            value={searchQuery}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Verified</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-12 w-full animate-pulse bg-muted rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isCurrentUser = session?.user?.id === user.id;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                          {user.name?.charAt(0).toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <span className="font-medium">{user.name}</span>
                          {user.banned && (
                            <Badge className="ml-2" variant="destructive">
                              Banned
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role ?? "user"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.emailVerified ? "default" : "outline"}>
                        {user.emailVerified ? "Verified" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button className="h-8 w-8 p-0" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* View Chats and Documents */}
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/chats?userId=${user.id}`}>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  View Chats
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/documents?userId=${user.id}`}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View Documents
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewActivity(user)}
                              >
                                <LogIn className="mr-2 h-4 w-4" />
                                Recent Activity
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Role Management */}
                              {user.role === "admin" ? (
                                <DropdownMenuItem
                                  disabled={isCurrentUser}
                                  onClick={() => handleRoleChange(user.id, "user")}
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Remove Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(user.id, "admin")}
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}

                              {/* Ban/Unban */}
                              {user.banned ? (
                                <DropdownMenuItem
                                  disabled={isCurrentUser}
                                  onClick={() => handleUnbanUser(user.id)}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Unban User
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  disabled={isCurrentUser}
                                  onClick={() =>
                                    setBanDialog({ open: true, user, reason: "" })
                                  }
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Ban User
                                </DropdownMenuItem>
                              )}

                              {/* Impersonate */}
                              {/* <DropdownMenuItem
                                disabled={isCurrentUser || user.role === "admin"}
                                onClick={() => handleImpersonateUser(user.id)}
                              >
                                <LogIn className="mr-2 h-4 w-4" />
                                Impersonate
                              </DropdownMenuItem> */}

                              <DropdownMenuSeparator />

                              {/* Delete */}
                              <DropdownMenuItem
                                className="text-destructive"
                                disabled={isCurrentUser}
                                onClick={() => setDeleteDialog({ open: true, user })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button
              disabled={currentPage === 1}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: Math.max(0, prev.offset - prev.limit),
                }))
              }
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={currentPage === totalPages}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: prev.offset + prev.limit,
                }))
              }
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Activity Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setActivityDialog({ open: false, user: null });
            setActivities([]);
            setIsActivityLoading(false);
          }
        }}
        open={activityDialog.open}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Recent Activity</DialogTitle>
            <DialogDescription>
              {activityDialog.user?.email ?? "Unknown user"}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
            {isActivityLoading ? (
              [...Array(6)].map((_, index) => (
                <div
                  className="h-10 w-full animate-pulse rounded bg-muted"
                  key={index}
                />
              ))
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent activity found.
              </p>
            ) : (
              activities.map((activity, index) => (
                <div
                  className="flex items-start gap-3 rounded-md border p-3"
                  key={`${activity.type}-${activity.createdAt}-${index}`}
                >
                  <div className="mt-0.5 text-muted-foreground">
                    {activity.type === "login" ? (
                      <LogIn className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {activity.type === "login"
                        ? "User login"
                        : "Chat created"}
                    </p>
                    {activity.type === "chat_created" && activity.chatTitle && (
                      <p className="text-sm text-muted-foreground">
                        {activity.chatTitle}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        onOpenChange={(open) => setDeleteDialog({ open, user: null })}
        open={deleteDialog.open}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user{" "}
              <strong>{deleteDialog.user?.email}</strong> and all their data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteDialog.user && handleDeleteUser(deleteDialog.user.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban Dialog */}
      <Dialog
        onOpenChange={(open) =>
          setBanDialog({ open, user: null, reason: "" })
        }
        open={banDialog.open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Ban {banDialog.user?.email} from accessing the application.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="banReason">Reason (optional)</Label>
              <Input
                id="banReason"
                onChange={(e) =>
                  setBanDialog((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Enter ban reason..."
                value={banDialog.reason}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setBanDialog({ open: false, user: null, reason: "" })}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                banDialog.user &&
                handleBanUser(banDialog.user.id, banDialog.reason)
              }
              variant="destructive"
            >
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog
        onOpenChange={(open) =>
          setCreateDialog({
            open,
            name: "",
            email: "",
            password: "",
            role: "user",
          })
        }
        open={createDialog.open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the application.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                onChange={(e) =>
                  setCreateDialog((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="John Doe"
                value={createDialog.name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                onChange={(e) =>
                  setCreateDialog((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="john@example.com"
                type="email"
                value={createDialog.email}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                onChange={(e) =>
                  setCreateDialog((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="••••••••"
                type="password"
                value={createDialog.password}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                onValueChange={(value: "user" | "admin") =>
                  setCreateDialog((prev) => ({ ...prev, role: value }))
                }
                value={createDialog.role}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                setCreateDialog({
                  open: false,
                  name: "",
                  email: "",
                  password: "",
                  role: "user",
                })
              }
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                !createDialog.name ||
                !createDialog.email ||
                !createDialog.password
              }
              onClick={handleCreateUser}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
