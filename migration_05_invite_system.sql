-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 05: Invite System
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Project invites table
CREATE TABLE IF NOT EXISTS project_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
  token       UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by  UUID        REFERENCES auth.users(id),
  used_by     UUID        REFERENCES auth.users(id),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: create_invite
--    Called by an authenticated user who belongs to a project.
--    Returns the invite token UUID.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_invite(p_project_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token        UUID;
  v_user_project UUID;
BEGIN
  -- Verify the caller belongs to the requested project
  SELECT project_id INTO v_user_project
  FROM user_profiles
  WHERE user_id = auth.uid();

  IF v_user_project IS DISTINCT FROM p_project_id THEN
    RAISE EXCEPTION 'Unauthorized: caller does not belong to this project';
  END IF;

  INSERT INTO project_invites (project_id, created_by)
  VALUES (p_project_id, auth.uid())
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: redeem_invite
--    Called by an authenticated user holding an invite token.
--    Returns: 'ok' | 'invalid' | 'already_assigned'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_invite(p_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite         project_invites%ROWTYPE;
  v_existing_proj  UUID;
BEGIN
  -- Find a valid, unused, non-expired invite
  SELECT * INTO v_invite
  FROM project_invites
  WHERE token    = p_token
    AND used_at  IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  -- Check existing project assignment
  SELECT project_id INTO v_existing_proj
  FROM user_profiles
  WHERE user_id = auth.uid();

  IF v_existing_proj IS NOT NULL
     AND v_existing_proj IS DISTINCT FROM v_invite.project_id THEN
    RETURN 'already_assigned';
  END IF;

  -- Assign or update project
  INSERT INTO user_profiles (user_id, project_id)
  VALUES (auth.uid(), v_invite.project_id)
  ON CONFLICT (user_id) DO UPDATE
    SET project_id = EXCLUDED.project_id;

  -- Mark invite as used (single-use)
  UPDATE project_invites
  SET used_by = auth.uid(),
      used_at = now()
  WHERE id = v_invite.id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_invite(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS for project_invites
--    Authenticated users can only read invites for their own project.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project invites"
  ON project_invites
  FOR SELECT
  TO authenticated
  USING (
    project_id = (
      SELECT project_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Inserts and updates are handled exclusively through the RPCs above.
