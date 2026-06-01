import { useCallback, useEffect, useState } from 'react';
import type { ManagedProject } from '../../domain/projects';
import { deleteProject, listProjects, saveProject } from '../../services/native';

export function useProjects() {
  const [projects, setProjects] = useState<ManagedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await listProjects());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsert = useCallback(async (project: ManagedProject) => {
    setProjects(await saveProject(project));
  }, []);

  const remove = useCallback(async (projectId: string) => {
    setProjects(await deleteProject(projectId));
  }, []);

  return { projects, loading, error, upsert, remove, reload };
}
