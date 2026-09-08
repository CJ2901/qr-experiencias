import ExperienciaForm from '@/components/ExperienciaForm';
import { requerirAdminPagina } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export default async function NuevoPage() {
  await requerirAdminPagina('/admin/nuevo');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Nueva Experiencia</h1>
      <ExperienciaForm />
    </div>
  );
}