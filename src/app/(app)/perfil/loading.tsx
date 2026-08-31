import { FormPageSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <FormPageSkeleton label="Carregando perfil" fields={5} />;
}
