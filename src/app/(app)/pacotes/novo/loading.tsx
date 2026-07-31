import { FormPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <FormPageSkeleton label="Carregando formulário" fields={6} />;
}
