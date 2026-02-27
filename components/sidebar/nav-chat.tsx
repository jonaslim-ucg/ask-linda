"use client"

import {
  Forward,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import useSWRInfinite from "swr/infinite"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

const PAGE_SIZE = 20

interface Chat {
  id: string
  title: string
}

interface ChatsResponse {
  chats: Chat[]
  nextCursor?: string
  hasMore: boolean
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function ChatSkeleton() {
  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-2 py-1.5 h-8">
        <Skeleton className="h-4 w-full rounded-md" />
      </div>
    </SidebarMenuItem>
  )
}

export function NavChats() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedChat, setSelectedChat] = useState<{ id: string; name: string } | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // SWR Infinite for pagination
  const getKey = (pageIndex: number, previousPageData: ChatsResponse | null) => {
    // First page, no cursor
    if (pageIndex === 0) return `/api/chats?limit=${PAGE_SIZE}`
    
    // Reached the end
    if (previousPageData && !previousPageData.hasMore) return null
    
    // Next page with cursor
    if (previousPageData?.nextCursor) {
      return `/api/chats?limit=${PAGE_SIZE}&cursor=${previousPageData.nextCursor}`
    }
    
    return null
  }

  const {
    data,
    error,
    size,
    setSize,
    isValidating,
    mutate,
  } = useSWRInfinite<ChatsResponse>(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  })

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      mutate();
    };

    window.addEventListener("refresh-sidebar-chats", handleRefresh);
    return () => window.removeEventListener("refresh-sidebar-chats", handleRefresh);
  }, [mutate]);

  // Flatten all pages into single array
  const chats = data ? data.flatMap((page) => page.chats || []) : []
  const isLoadingInitial = !data && !error
  const isLoadingMore = isLoadingInitial || (size > 0 && data && typeof data[size - 1] === "undefined")
  const isEmpty = data?.[0]?.chats?.length === 0
  const isReachingEnd = isEmpty || (data && !data[data.length - 1]?.hasMore)

  // Debug: log sidebar chat list state when ?debug=1
  useEffect(() => {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("debug") !== "1") return;
    if (error) {
      // eslint-disable-next-line no-console
      console.debug("[NavChats] Fetch error", { error });
    } else if (data) {
      // eslint-disable-next-line no-console
      console.debug("[NavChats] Loaded", { chatCount: chats.length, pageCount: data.length, isEmpty, isValidating });
    }
  }, [data, error, chats.length, isEmpty, isValidating]);

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0]
      if (target.isIntersecting && !isReachingEnd && !isValidating) {
        setSize((prev) => prev + 1)
      }
    },
    [isReachingEnd, isValidating, setSize]
  )

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    observerRef.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0,
    })

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [handleObserver])

  const handleRenameClick = (chatId: string, chatName: string) => {
    setSelectedChat({ id: chatId, name: chatName })
    setNewTitle(chatName)
    setRenameDialogOpen(true)
  }

  const handleDeleteClick = (chatId: string, chatName: string) => {
    setSelectedChat({ id: chatId, name: chatName })
    setDeleteDialogOpen(true)
  }

  const handleRename = async () => {
    if (!selectedChat || !newTitle.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats/${selectedChat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      if (!response.ok) {
        throw new Error("Failed to rename chat")
      }

      toast.success("Chat renamed successfully")
      mutate()
      setRenameDialogOpen(false)
    } catch (error) {
      console.error("Failed to rename chat:", error)
      toast.error("Failed to rename chat")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedChat) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chats/${selectedChat.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete chat")
      }

      toast.success("Chat deleted successfully")
      mutate()
      setDeleteDialogOpen(false)
      
      // Redirect to home if deleting current chat
      if (window.location.pathname === `/c/${selectedChat.id}`) {
        router.push("/")
      }
    } catch (error) {
      console.error("Failed to delete chat:", error)
      toast.error("Failed to delete chat")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Your Chats</SidebarGroupLabel>
        <SidebarMenu className="gap-0.5">
          {/* Loading: initial fetch */}
          {isLoadingInitial && (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>Loading chats...</span>
                </div>
              </SidebarMenuItem>
              <ChatSkeleton />
              <ChatSkeleton />
              <ChatSkeleton />
              <ChatSkeleton />
              <ChatSkeleton />
            </>
          )}

          {/* Error: failed to load */}
          {error && !isLoadingInitial && (
            <SidebarMenuItem>
              <div className="flex flex-col gap-2 px-2 py-3 text-sm">
                <p className="text-muted-foreground">Couldn&apos;t load chats</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => mutate()}
                >
                  Try again
                </Button>
              </div>
            </SidebarMenuItem>
          )}

          {/* Empty state */}
          {isEmpty && !isLoadingInitial && !error && (
            <SidebarMenuItem>
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No chats yet. Start a new conversation!
              </div>
            </SidebarMenuItem>
          )}

          {/* Chat list */}
          {chats.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname === `/c/${item.id}`}
                className="h-8 data-[active=true]:bg-zinc-200 dark:data-[active=true]:bg-zinc-600"
              >
                <Link href={`/c/${item.id}`} prefetch={false}>
                  <span className="font-light">{item.title}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction showOnHover>
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem onClick={() => handleRenameClick(item.id, item.title)}>
                    <Forward className="text-muted-foreground" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDeleteClick(item.id, item.title)}>
                    <Trash2 className="text-muted-foreground" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ))}

          {/* Infinite scroll trigger & loading more indicator */}
          <div ref={loadMoreRef} className="h-1" />
          {isLoadingMore && !isLoadingInitial && !error && (
            <>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>Loading more...</span>
                </div>
              </SidebarMenuItem>
              <ChatSkeleton />
              <ChatSkeleton />
              <ChatSkeleton />
            </>
          )}
        </SidebarMenu>
      </SidebarGroup>

      {/* Rename Dialog */}
      <Dialog onOpenChange={setRenameDialogOpen} open={renameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>
              Enter a new name for your chat.
            </DialogDescription>
          </DialogHeader>
          <Input
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleRename()
              }
            }}
            placeholder="Chat name"
            value={newTitle}
          />
          <DialogFooter>
            <Button disabled={isLoading} onClick={() => setRenameDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={isLoading || !newTitle.trim()} onClick={handleRename}>
              {isLoading ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{selectedChat?.name}&rdquo; and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={handleDelete}>
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
