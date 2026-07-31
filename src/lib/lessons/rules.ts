export type RuleResult = { ok: true } | { ok: false; error: string };

export function canCompleteLesson(
  status: string,
  completedCount: number,
  totalLessons: number,
): RuleResult {
  if (status !== "scheduled") {
    return { ok: false, error: "Só é possível concluir aulas agendadas" };
  }
  if (completedCount >= totalLessons) {
    return {
      ok: false,
      error: `Este pacote já tem todas as ${totalLessons} aulas concluídas`,
    };
  }
  return { ok: true };
}

export function canMarkMissed(status: string): RuleResult {
  if (status !== "scheduled") {
    return { ok: false, error: "Só é possível marcar falta em aulas agendadas" };
  }
  return { ok: true };
}

export function canCancelLesson(status: string): RuleResult {
  if (status !== "scheduled") {
    return { ok: false, error: "Só é possível cancelar aulas agendadas" };
  }
  return { ok: true };
}

export function canEditLesson(status: string): RuleResult {
  if (status !== "scheduled") {
    return { ok: false, error: "Só é possível editar aulas ainda agendadas" };
  }
  return { ok: true };
}

export function hasPackageSlot(
  completed: number,
  scheduled: number,
  totalLessons: number,
) {
  return completed + scheduled < totalLessons;
}

export function canRescheduleLesson(input: {
  lessonStatus: string;
  packageStatus: string;
  totalLessons: number;
  completed: number;
  scheduled: number;
}): RuleResult {
  if (input.lessonStatus !== "scheduled" && input.lessonStatus !== "missed") {
    return {
      ok: false,
      error: "Só é possível remarcar aulas agendadas ou com falta",
    };
  }

  if (input.packageStatus === "closed" && input.lessonStatus === "missed") {
    return {
      ok: false,
      error: "Pacote encerrado. Reabra o pacote para remarcar uma falta.",
    };
  }

  // Remarcar falta cria nova scheduled e precisa de vaga.
  if (input.lessonStatus === "missed") {
    if (
      !hasPackageSlot(input.completed, input.scheduled, input.totalLessons)
    ) {
      return {
        ok: false,
        error:
          "Não há vaga no pacote para remarcar. Cancele outra aula agendada ou aumente o total do pacote.",
      };
    }
  }

  return { ok: true };
}

export function canRevertLessonStatus(input: {
  lessonStatus: string;
  totalLessons: number;
  completed: number;
  scheduled: number;
}): RuleResult {
  if (
    input.lessonStatus !== "completed" &&
    input.lessonStatus !== "missed" &&
    input.lessonStatus !== "cancelled"
  ) {
    return {
      ok: false,
      error: "Só é possível desfazer aulas dadas, faltas ou canceladas",
    };
  }

  // completed → scheduled troca o tipo da vaga; missed/cancelled precisam de vaga livre.
  if (
    (input.lessonStatus === "missed" || input.lessonStatus === "cancelled") &&
    !hasPackageSlot(input.completed, input.scheduled, input.totalLessons)
  ) {
    return {
      ok: false,
      error:
        "Não há vaga no pacote para voltar esta aula para agendada. Cancele outra ou aumente o total.",
    };
  }

  return { ok: true };
}

export function shouldClosePackageAfterComplete(
  completedCount: number,
  totalLessons: number,
) {
  return completedCount >= totalLessons;
}

export function shouldReopenPackageAfterRevert(
  previousStatus: string,
  packageStatus: string,
) {
  return previousStatus === "completed" && packageStatus === "closed";
}
