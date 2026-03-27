'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const ProjectContext = createContext<string | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async (userId: string) => {
      const { data } = await supabase
        .from('user_profiles')
        .select('project_id')
        .eq('user_id', userId)
        .single();
      if (data?.project_id) setProjectId(data.project_id);
    };

    // Use session from the callback directly — avoids getUser() network call and auth lock contention.
    // INITIAL_SESSION fires on mount; TOKEN_REFRESHED fires when an expired token is refreshed.
    // Both carry session.user.id so we never need a separate getUser() round-trip.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        fetchProject(session.user.id);
      } else {
        setProjectId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <ProjectContext.Provider value={projectId}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectId() {
  return useContext(ProjectContext);
}
