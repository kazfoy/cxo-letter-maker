'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUserPlan } from './useUserPlan';
import { devLog } from '@/lib/logger';

interface SharedTemplate {
    id: string;
    name: string;
    sender_info: {
        company_name?: string;
        department?: string;
        name?: string;
        service_description?: string;
    };
    template_config: Record<string, unknown>;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export function useTeamTemplates() {
    const { isTeamPlan, teamId } = useUserPlan();
    const [templates, setTemplates] = useState<SharedTemplate[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchTemplates = useCallback(async () => {
        if (!isTeamPlan || !teamId) return;

        setLoading(true);
        try {
            const res = await fetch('/api/teams/templates');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            devLog.warn('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    }, [isTeamPlan, teamId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    return { templates, loading, refetch: fetchTemplates, isTeamPlan };
}
