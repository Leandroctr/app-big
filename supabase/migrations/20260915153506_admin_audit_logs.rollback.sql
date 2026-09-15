-- Emergency rollback for 20260915153506_admin_audit_logs.sql.
-- Audit evidence is intentionally protected: export and obtain explicit approval
-- before removing a non-empty audit table.

begin;

do $$
begin
  if to_regclass('public.admin_audit_logs') is not null
     and exists (select 1 from public.admin_audit_logs limit 1) then
    raise exception
      'refusing to drop non-empty public.admin_audit_logs; preserve/export audit evidence first';
  end if;
end
$$;

drop table if exists public.admin_audit_logs;

commit;
