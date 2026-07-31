"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudent } from "@/lib/students/actions";

export function DeleteStudentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-[var(--danger)] hover:underline disabled:opacity-50"
      onClick={() => {
        if (
          !confirm(
            "Excluir este aluno? Pacotes e aulas ligados serão removidos.",
          )
        ) {
          return;
        }
        startTransition(async () => {
          await deleteStudent(id);
          router.refresh();
        });
      }}
    >
      Excluir
    </button>
  );
}
