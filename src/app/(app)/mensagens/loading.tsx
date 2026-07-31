import { FormPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <FormPageSkeleton label="Carregando mensagens" fields={6} />;
}
