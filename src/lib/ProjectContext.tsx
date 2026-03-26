'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const ProjectContext = createContext<string | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_profiles')
        .select('project_id')
        .eq('user_id', user.id)
        .single();
      if (data) setProjectId(data.project_id);
    };
    fetch();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetch());
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
