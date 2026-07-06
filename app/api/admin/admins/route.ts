import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin-identity.server";
import {
  findAuthUserByEmail,
  getAdminUserByAuthId,
  listAdminUsers,
  listTenantDomains,
} from "@/lib/admin-directory.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { checkPasswordPolicy } from "@/lib/password-policy";
import { logServerError, logServerInfo } from "@/lib/logger/server";

type CreateAdminPayload = {
  email?: string;
  name?: string;
  role?: string;
  password?: string;
  tenantDomains?: string[];
};

const forbiddenResponse = NextResponse.json(
  { ok: false, error: "Acesso restrito a super administradores." },
  { status: 403 },
);

function isValidRole(role: unknown): role is "super_admin" | "admin" {
  return role === "super_admin" || role === "admin";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Codigos de erro documentados do Supabase Auth (@supabase/auth-js) para
// e-mail ja cadastrado. Checagem por codigo, nao por texto de mensagem —
// mais estavel entre versoes do SDK.
function isDuplicateEmailError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === "email_exists" || code === "user_already_exists";
}

export async function GET() {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  const [admins, tenantDomains] = await Promise.all([
    listAdminUsers(),
    listTenantDomains(),
  ]);

  return NextResponse.json({ ok: true, admins, tenantDomains });
}

export async function POST(request: Request) {
  const currentAdmin = await requireSuperAdmin();

  if (!currentAdmin) {
    return forbiddenResponse;
  }

  let payload: CreateAdminPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Payload invalido." }, { status: 400 });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim() || null;
  const role = payload.role;
  const password = String(payload.password || "");
  const hasPassword = password.length > 0;
  const requestedTenantDomains = Array.isArray(payload.tenantDomains)
    ? payload.tenantDomains.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "E-mail invalido." }, { status: 400 });
  }

  if (!isValidRole(role)) {
    return NextResponse.json(
      { ok: false, error: "Papel invalido. Use super_admin ou admin." },
      { status: 400 },
    );
  }

  // Senha preenchida = criar usuario novo no Supabase Auth (policy de senha
  // forte se aplica). Senha vazia = vincular um usuario que ja existe no
  // Supabase Auth a admin_users — nesse caminho nao ha senha para validar,
  // a conta ja tem a sua propria.
  if (hasPassword) {
    const passwordCheck = checkPasswordPolicy(password, { email, name: name || undefined });

    if (!passwordCheck.ok) {
      return NextResponse.json({ ok: false, error: passwordCheck.reason }, { status: 400 });
    }
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nao configurado." }, { status: 503 });
  }

  // So aceita tenant_domain que de fato existe em app_settings — evita
  // conceder acesso a um dominio inexistente/digitado errado.
  const validTenantDomains = await listTenantDomains();
  const tenantDomains = requestedTenantDomains.filter((domain) =>
    validTenantDomains.includes(domain),
  );

  let authUserId: string;
  let linked = false;

  if (hasPassword) {
    // Caso A (e-mail novo) ou Caso D (e-mail ja existe no Auth, com senha
    // preenchida por engano).
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError) {
      if (isDuplicateEmailError(createUserError)) {
        // Caso D: mensagem clara e sem ambiguidade, sem tentar adivinhar —
        // pede que o operador reenvie sem senha para vincular a conta
        // existente.
        return NextResponse.json(
          {
            ok: false,
            error:
              "Este e-mail ja existe no Supabase Auth. Para vincula-lo, envie o formulario sem senha.",
          },
          { status: 409 },
        );
      }

      logServerError("admin_create_auth_user_error", createUserError, { email });
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel criar o usuario no Supabase Auth." },
        { status: 500 },
      );
    }

    if (!createdUser?.user) {
      logServerError("admin_create_auth_user_error", undefined, { email });
      return NextResponse.json(
        { ok: false, error: "Nao foi possivel criar o usuario no Supabase Auth." },
        { status: 500 },
      );
    }

    authUserId = createdUser.user.id;
  } else {
    // Caso B (vincular usuario existente) ou Caso C (e-mail nao existe no
    // Auth e nenhuma senha foi informada para cria-lo).
    const existingAuthUser = await findAuthUserByEmail(email);

    if (!existingAuthUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Informe uma senha para criar um novo usuario ou use um e-mail ja existente no Supabase Auth.",
        },
        { status: 400 },
      );
    }

    authUserId = existingAuthUser.id;
    linked = true;
  }

  // Comum aos dois caminhos: nunca duplicar admin_users para o mesmo
  // auth_user_id. No caminho de vinculo isso e o Caso B real (usuario Auth
  // ja tinha linha em admin_users); no caminho de criacao nova e apenas uma
  // checagem defensiva, ja que o auth_user_id acabou de ser gerado agora.
  const existingAdminUser = await getAdminUserByAuthId(authUserId);

  if (existingAdminUser) {
    return NextResponse.json(
      {
        ok: false,
        error: "Este e-mail ja e administrador. Edite as permissoes na tabela abaixo.",
      },
      { status: 409 },
    );
  }

  const { data: adminUserRow, error: adminUserError } = await supabase
    .from("admin_users")
    .insert({ auth_user_id: authUserId, email, name, role, active: true })
    .select("id, auth_user_id, email, name, role, active, created_at")
    .single();

  if (adminUserError || !adminUserRow) {
    logServerError("admin_create_admin_user_error", adminUserError, {
      email,
      authUserId,
      linked,
    });

    if (!linked) {
      // So faz sentido reverter a conta Auth quando ela acabou de ser criada
      // por esta requisicao — nunca apagar uma conta Auth que ja existia
      // antes (caminho de vinculo), mesmo que o insert em admin_users falhe.
      const { error: cleanupError } = await supabase.auth.admin.deleteUser(authUserId);

      if (cleanupError) {
        logServerError("admin_create_cleanup_error", cleanupError, { authUserId });
      }
    } else {
      // Usuario Auth existente, mas o vinculo em admin_users falhou — fica
      // registrado para diagnostico manual; nao ha conta orfa para limpar
      // porque a conta Auth ja existia antes desta requisicao.
      logServerError("admin_link_admin_user_error", adminUserError, { email, authUserId });
    }

    return NextResponse.json(
      { ok: false, error: "Nao foi possivel registrar o administrador." },
      { status: 500 },
    );
  }

  let tenantAccessWarning: string | undefined;

  if (role === "admin" && tenantDomains.length > 0) {
    const accessRows = tenantDomains.map((tenantDomain) => ({
      admin_user_id: adminUserRow.id,
      tenant_domain: tenantDomain,
      active: true,
    }));

    const { error: accessError } = await supabase.from("admin_tenant_access").insert(accessRows);

    if (accessError) {
      logServerError("admin_create_tenant_access_error", accessError, {
        adminUserId: adminUserRow.id,
      });
      tenantAccessWarning = `${
        linked ? "Administrador vinculado" : "Administrador criado"
      }, mas nao foi possivel salvar o acesso aos tenants selecionados. Ajuste na tela de administradores.`;
    }
  }

  logServerInfo(linked ? "admin_linked" : "admin_created", {
    email,
    role,
    adminUserId: adminUserRow.id,
  });

  return NextResponse.json({
    ok: true,
    linked,
    admin: {
      id: adminUserRow.id,
      authUserId: adminUserRow.auth_user_id,
      email: adminUserRow.email,
      name: adminUserRow.name,
      role: adminUserRow.role,
      active: adminUserRow.active,
      createdAt: adminUserRow.created_at,
      tenantAccess:
        role === "admin"
          ? tenantDomains.map((tenantDomain) => ({ tenantDomain, active: true }))
          : [],
    },
    warning: tenantAccessWarning,
  });
}
