"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLibraryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/library/upload");
  }, [router]);

  return null;
}
