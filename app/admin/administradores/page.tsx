import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAdminsForm } from "@/components/admin-admins-form";
import { AdminAdminsTable } from "@/components/admin-admins-table";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import { listAdminUsers, listTenantDomains } from "@/lib/admin-directory.server";
import { appConfig } from "@/lib/app-config";

export const dynamic = "force-dynamic";

// Ainda nao ligada ao menu principal do /admin (etapa futura, quando os
// guards antigos forem trocados). Nesta fase, requireSuperAdmin() sempre
// retorna null porque admin_users ainda nao existe no banco (migration 003
// pendente) — ou seja, esta pagina hoje sempre redireciona para o login,
// mesmo para quem estaria logado como super_admin no futuro. Nao deve ser
// considerada funcionalmente testada contra banco real ainda.
export default async function AdminAdministradoresPage() {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    redirect("/admin/login");
  }

  const [admins, tenantDomains] = await Promise.all([
    listAdminUsers(),
    listTenantDomains(),
  ]);

  return (
    <main
      className="min-h-dvh px-4 py-6 text-slate-950"
      style={{ backgroundColor: appConfig.backgroundColor }}
    >
      <section className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              {appConfig.shortName}
            </p>
            <h1 className="text-2xl font-black tracking-normal">
              Administradores
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link className="text-sm font-bold text-slate-700" href="/admin">
              Voltar ao painel
            </Link>
          </div>
        </header>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black">Novo administrador</h2>
          <AdminAdminsForm tenantDomains={tenantDomains} />
        </section>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black">Administradores cadastrados</h2>
          <AdminAdminsTable admins={admins} tenantDomains={tenantDomains} />
        </section>
      </section>
    </main>
  );
}
