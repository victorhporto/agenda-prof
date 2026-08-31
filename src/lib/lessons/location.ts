export type LessonLocation = "casa_aluno" | "casa_professor" | "online";

export const LOCATION_LABELS: Record<LessonLocation, string> = {
  casa_aluno: "Na casa do aluno",
  casa_professor: "Na casa do professor",
  online: "Online",
};

export const LOCATION_SHORT: Record<LessonLocation, string> = {
  casa_aluno: "Casa do aluno",
  casa_professor: "Casa do professor",
  online: "Online",
};

export const LOCATIONS: LessonLocation[] = [
  "casa_aluno",
  "casa_professor",
  "online",
];

export function isLessonLocation(value: string): value is LessonLocation {
  return LOCATIONS.includes(value as LessonLocation);
}

export function parseStoredLocation(
  value: string | null | undefined,
): LessonLocation | null {
  if (typeof value !== "string") return null;
  return isLessonLocation(value) ? value : null;
}

export function parseRequiredLocation(value: unknown): LessonLocation | null {
  return typeof value === "string" && isLessonLocation(value) ? value : null;
}

/** Local da aula, ou o padrão do aluno se a aula ainda não tiver local. */
export function effectiveLocation(
  lessonLocation: string | null | undefined,
  studentDefault: string | null | undefined,
): LessonLocation | null {
  return parseStoredLocation(lessonLocation) ?? parseStoredLocation(studentDefault);
}
