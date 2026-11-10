-- Rol d'administrador i bloqueig de comptes (TG-177, HU41, ADR-0028).
-- L'API llegeix les dues columnes a cada petició autenticada: un canvi val a l'instant, sense
-- esperar que l'usuari renovi el JWT. Per fer administrador algú:
--   update public.perfils set rol = 'admin' where email = '<correu>';

alter table public.perfils
  add column rol text not null default 'usuari' check (rol in ('usuari', 'admin')),
  add column bloquejat boolean not null default false,
  add column data_bloqueig timestamptz,
  add constraint perfils_data_bloqueig_check check (bloquejat = (data_bloqueig is not null));
