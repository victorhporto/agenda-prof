import { FormPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <FormPageSkeleton label="Carregando nova aula" fields={5} />;
}
