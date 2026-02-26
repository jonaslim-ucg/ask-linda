"use client"

import * as React from "react"
import {
  Edit,
  Search,
  FileText,
  Shield,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

import { NavUser } from "./nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import { NavChats } from "./nav-chat"
import { SearchDialog } from "@/components/search-dialog"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession();
  const [searchOpen, setSearchOpen] = React.useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === "admin";

  // Keyboard shortcut for search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Image src="/stethoscope.svg" alt="Stethoscope" width={16} height={16} className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Ask Linda</span>
                  {/* <span className="truncate text-xs">Your AI Helper</span> */}
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="gap-0.5 px-2">
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="New Chat">
                <Link href="/">
                  <Edit className="size-4" />
                  <span>New Chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setSearchOpen(true)} tooltip="Search">
                <Search className="size-4" />
                <span>Search</span>
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="My Documents">
                <Link href="/documents">
                  <FileText className="size-4" />
                  <span>My Documents</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Admin Dashboard">
                  <Link href="/admin">
                    <Shield className="size-4" />
                    <span>Admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
          <NavChats />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={session?.user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SearchDialog onOpenChange={setSearchOpen} open={searchOpen} />
    </>
  )
}
