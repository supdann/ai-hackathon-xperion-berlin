"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting all chats...",
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        router.push("/");
        setShowDeleteAllDialog(false);
        return "All chats deleted successfully";
      },
      error: "Failed to delete all chats",
    });
  };

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
        <div className="relative h-12 w-48 md:h-16 md:w-64">
          <Image
            alt="MMS Logo"
            className="object-contain"
            fill
            priority
            sizes="(max-width: 768px) 192px, 256px"
            src="/images/MMS_Logo2024_Outline_sRGB.png"
            unoptimized
          />
        </div>

        <div className="ml-auto flex flex-row items-center gap-1">
          {!isReadonly && (
            <VisibilitySelector
              chatId={chatId}
              selectedVisibilityType={selectedVisibilityType}
            />
          )}
          {session?.user && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 px-2 md:h-fit md:px-2"
                  onClick={() => setShowDeleteAllDialog(true)}
                  type="button"
                  variant="ghost"
                >
                  <TrashIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end" className="hidden md:block">
                Delete All Chats
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="h-8 px-2 md:h-fit md:px-2"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
                type="button"
                variant="ghost"
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" className="hidden md:block">
              New Chat
            </TooltipContent>
          </Tooltip>
          <SidebarToggle />
        </div>
      </header>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all
              your chats and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
