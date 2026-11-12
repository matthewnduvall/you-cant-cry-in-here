'use client';

// ============================================================================
// VIEW: 01 / CONFIGURATION (view id 'configuration'; replaces Onboarding and the Routines, Equipment and
// Goals menu pages). One tab per topic, each showing the same content as the page it replaced:
// BODY METRICS · GOALS (GoalsView) · EQUIPMENT (GymsView) · ROUTINES (ROUTINE + EXERCISE SET PREFERENCES).
// Routines themselves (default, saved, shared, friends') are only reached from a blank session's LOAD ROUTINE.
// New athletes land here after signing up; NEXT → steps through the tabs and DONE → goes Home.
// ============================================================================

import React from 'react';
import { TabBar, Button } from '../Controls';
import { BodyMetricsSection, RoutinePreferencesSection, SetPreferencesSection } from './SettingsView';
import { GoalsView } from './GoalsView';
import { GymsView } from './GymsView';

export const CONFIGURATION_TABS = [
  { id: 'body', label: 'BODY METRICS' },
  { id: 'goals', label: 'GOALS' },
  { id: 'equipment', label: 'EQUIPMENT' },
  { id: 'routines', label: 'ROUTINES' }
];

export function ConfigurationView({
  colors,
  tab,
  setTab,
  setCurrentView,
  bodyMetricsProps,
  goalsProps,
  equipmentProps,
  routinePreferencesProps,
  setPreferencesProps
}) {
  const tabIndex = Math.max(
    0,
    CONFIGURATION_TABS.findIndex(t => t.id === tab)
  );
  const activeTab = CONFIGURATION_TABS[tabIndex].id;
  const isLastTab = tabIndex === CONFIGURATION_TABS.length - 1;

  return (
    <div style={{ paddingBottom: '24px' }}>
      <div style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
        <TabBar ariaLabel="Configuration" tabs={CONFIGURATION_TABS} value={activeTab} onChange={setTab} />
      </div>

      {/* The answers on each tab (number boxes, dropdowns, selected pills, ON) are red: .cr-config in KINETIC_CSS */}
      <div className="cr-config">
      {activeTab === 'body' && (
        <div style={{ paddingTop: '16px' }}>
          <BodyMetricsSection colors={colors} {...bodyMetricsProps} />
        </div>
      )}
      {activeTab === 'goals' && <GoalsView colors={colors} {...goalsProps} />}
      {activeTab === 'equipment' && (
        <GymsView colors={colors} setCurrentView={setCurrentView} {...equipmentProps} />
      )}
      {activeTab === 'routines' && (
        <div style={{ paddingTop: '16px' }}>
          <RoutinePreferencesSection colors={colors} {...routinePreferencesProps} />
          <SetPreferencesSection colors={colors} {...setPreferencesProps} />
        </div>
      )}

      </div>

      {/* NEXT / DONE is white: the red is on the answers above */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <Button
          variant="primary-row"
          style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          onClick={() => (isLastTab ? setCurrentView('home') : setTab(CONFIGURATION_TABS[tabIndex + 1].id))}
        >
          <span>{isLastTab ? 'DONE' : `NEXT: ${CONFIGURATION_TABS[tabIndex + 1].label}`}</span>
          <span>→</span>
        </Button>
      </div>
    </div>
  );
}

export default ConfigurationView;
