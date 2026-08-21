-- Allow hex swatches on types and tags (the picker stores #rrggbb).
-- Named values from the first seed stay readable until rewritten below.

alter table client_types drop constraint if exists client_types_color_ok;
alter table tags drop constraint if exists tags_color_ok;

alter table client_types
  add constraint client_types_color_ok
  check (color ~ '^[a-z]+$' or color ~ '^#[0-9a-fA-F]{6}$');

alter table tags
  add constraint tags_color_ok
  check (color ~ '^[a-z]+$' or color ~ '^#[0-9a-fA-F]{6}$');

update client_types set color = case color
  when 'slate' then '#64748b'
  when 'sky' then '#0ea5e9'
  when 'indigo' then '#6366f1'
  when 'violet' then '#8b5cf6'
  when 'emerald' then '#10b981'
  when 'teal' then '#14b8a6'
  when 'amber' then '#d97706'
  when 'orange' then '#ea580c'
  when 'rose' then '#e11d48'
  when 'zinc' then '#52525b'
  else color
end
where color !~ '^#';

update tags set color = case color
  when 'slate' then '#64748b'
  when 'sky' then '#0ea5e9'
  when 'indigo' then '#6366f1'
  when 'violet' then '#8b5cf6'
  when 'emerald' then '#10b981'
  when 'teal' then '#14b8a6'
  when 'amber' then '#d97706'
  when 'orange' then '#ea580c'
  when 'rose' then '#e11d48'
  when 'zinc' then '#52525b'
  else color
end
where color !~ '^#';

alter table client_types alter column color set default '#64748b';
alter table tags alter column color set default '#64748b';
