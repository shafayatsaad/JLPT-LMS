-- A review trigger is shared across several tables. Keep each table's field
-- checks inside its own branch so PostgreSQL never resolves fields that do not
-- exist on the current trigger record (for example, questions.version).
begin;

create or replace function private.protect_review_decisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status::text is distinct from new.status::text
    and old.status::text in ('needs_review', 'draft')
    and new.status::text in ('approved', 'eligible_for_exam', 'rejected', 'validated', 'draft')
    and (select private.has_any_role(array['reviewer'::public.app_role, 'admin'::public.app_role]))
  then
    case tg_table_name
      when 'questions' then
        if row(new.content_key, new.revision, new.level, new.test_section_code, new.score_category_code,
          new.item_type_code, new.difficulty_estimate, new.stimulus_group_id, new.prompt, new.options, new.authored_by)
          is distinct from
          row(old.content_key, old.revision, old.level, old.test_section_code, old.score_category_code,
          old.item_type_code, old.difficulty_estimate, old.stimulus_group_id, old.prompt, old.options, old.authored_by)
        then raise exception 'Review decisions cannot edit authored question fields';
        end if;
      when 'passage_groups' then
        if row(new.content_key, new.revision, new.level, new.group_type, new.content, new.authored_by)
          is distinct from row(old.content_key, old.revision, old.level, old.group_type, old.content, old.authored_by)
        then raise exception 'Review decisions cannot edit authored passage fields';
        end if;
      when 'exam_blueprints' then
        if row(new.level, new.version, new.created_by)
          is distinct from row(old.level, old.version, old.created_by)
        then raise exception 'Review decisions cannot edit blueprint fields';
        end if;
      when 'exam_forms' then
        if row(new.blueprint_id, new.level, new.form_code, new.version, new.assembly_seed, new.manifest,
          new.is_frozen, new.created_by, new.access_tier, new.published_at)
          is distinct from row(old.blueprint_id, old.level, old.form_code, old.version, old.assembly_seed,
          old.manifest, old.is_frozen, old.created_by, old.access_tier, old.published_at)
        then raise exception 'Validation decisions cannot edit exam form fields';
        end if;
      when 'content_assets' then
        if row(new.storage_path, new.media_type, new.checksum_sha256, new.duration_seconds, new.created_at)
          is distinct from row(old.storage_path, old.media_type, old.checksum_sha256, old.duration_seconds, old.created_at)
        then raise exception 'Asset review decisions cannot edit asset metadata';
        end if;
    end case;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_review_decisions() from public, anon, authenticated;

commit;
