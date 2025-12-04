"use client";

import Image from "next/image";
import Link from "next/link";
import type { User } from "next-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";

export function AppSidebar({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=right]:border-l-0" side="right">
      <SidebarHeader>
        <SidebarMenu>
          <Link
            className="flex flex-row items-center justify-center gap-3"
            href="/"
            onClick={() => {
              setOpenMobile(false);
            }}
          >
            <div className="relative h-32 w-full md:h-48">
              <Image
                alt="MMS Logo"
                className="object-contain object-center"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 256px"
                src="/images/MMS_Logo2024_sRGB.png"
                unoptimized
                style={{
                  imageRendering: "auto",
                }}
              />
            </div>
          </Link>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
