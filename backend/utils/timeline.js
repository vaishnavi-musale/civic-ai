const TIMELINE_STEP_DEFINITIONS = [
  { id: 1, label: 'Issue Reported', icon: '📋', description: 'Your complaint has been received' },
  { id: 2, label: 'Assigned to Officer', icon: '👨‍💼', description: 'Issue assigned to municipal officer' },
  { id: 3, label: 'Worker Dispatched', icon: '🚛', description: 'Field team on the way' },
  { id: 4, label: 'Work in Progress', icon: '🔧', description: 'Repair/cleanup underway' },
  { id: 5, label: 'Verification Pending', icon: '🔍', description: 'Awaiting citizen verification' },
  { id: 6, label: 'Completed', icon: '✅', description: 'Issue resolved and verified' },
];

const STATUS_TO_ACTIVE_STEP = {
  pending: 1,
  'in-progress': 4,
  verification: 5,
  resolved: 6,
};

const ACTIVE_STEP_TO_STATUS = {
  1: 'pending',
  2: 'pending',
  3: 'in-progress',
  4: 'in-progress',
  5: 'verification',
  6: 'resolved',
};

const getStepTimestamp = (existingStep, now, field) => existingStep?.[field] || now;

const buildTimelineSteps = (status = 'pending', existingSteps = [], completedAt = null) => {
  const now = new Date().toISOString();
  const activeStep = STATUS_TO_ACTIVE_STEP[status] || 1;
  const existingMap = new Map((Array.isArray(existingSteps) ? existingSteps : []).map((step) => [Number(step.id), step]));

  return TIMELINE_STEP_DEFINITIONS.map((definition) => {
    const existing = existingMap.get(definition.id);
    const isResolved = status === 'resolved';
    const state = isResolved || definition.id < activeStep ? 'completed' : definition.id === activeStep ? 'current' : 'pending';

    return {
      ...definition,
      state,
      completed_at: state === 'completed' ? getStepTimestamp(existing, completedAt || now, 'completed_at') : null,
      started_at: state === 'current' ? getStepTimestamp(existing, now, 'started_at') : existing?.started_at || null,
      updated_at: state !== 'pending' ? now : existing?.updated_at || null,
    };
  });
};

const advanceTimelineToStep = (stepId, existingSteps = [], mode = 'current') => {
  const now = new Date().toISOString();
  const targetStep = Math.min(6, Math.max(1, Number(stepId) || 1));
  const existingMap = new Map((Array.isArray(existingSteps) ? existingSteps : []).map((step) => [Number(step.id), step]));
  const status = mode === 'completed' && targetStep === 6 ? 'resolved' : ACTIVE_STEP_TO_STATUS[targetStep] || 'pending';

  const steps = TIMELINE_STEP_DEFINITIONS.map((definition) => {
    const existing = existingMap.get(definition.id);
    const state = definition.id < targetStep || (mode === 'completed' && definition.id === targetStep)
      ? 'completed'
      : definition.id === targetStep
        ? 'current'
        : 'pending';

    return {
      ...definition,
      state,
      completed_at: state === 'completed' ? existing?.completed_at || now : null,
      started_at: state === 'current' ? existing?.started_at || now : existing?.started_at || null,
      updated_at: state !== 'pending' ? now : existing?.updated_at || null,
    };
  });

  return { status, steps };
};

module.exports = {
  TIMELINE_STEP_DEFINITIONS,
  buildTimelineSteps,
  advanceTimelineToStep,
};
