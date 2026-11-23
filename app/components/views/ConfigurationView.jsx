'use client';

// ============================================================================
// VIEW: 01 / CONFIGURATION (view id 'configuration'; replaces Onboarding and the Routines, Equipment and
// Goals menu pages). One tab per topic, each showing the same content as the page it replaced:
// BODY METRICS · GOALS (GoalsView) · EQUIPMENT (GymsView) · TRAINING (EXERCISE SET PREFERENCES + FATIGUE).
// Programs (choosing one, its training days, Crying's variety and routine preferences) live on the Programs page.
// New athletes land here after signing up; NEXT → steps through the tabs and DONE → goes Home.
// ============================================================================

import React from 'react';
import { AttachedTabStrip, Button } from '../Controls';
import { BodyMetricsSection, SetPreferencesSection } from './SettingsView';
import { GoalsView } from './GoalsView';
import { GymsView } from './GymsView';
import { IOSListSection } from '../Primitives';
import { UI } from '../../styles/kineticTokens';

// FATIGUE: the reps of reserve each earlier working set of an exercise uses up (settings.fatiguePerSet, every program).
// Working sets are planned at one weight and the RIR shown falls by it; each set's 1RM adds it back, so honest, falling
// RIRs don't read as lost strength. Set by hand for now; the app can learn each lifter's rate from History later.
const FATIGUE_OPTIONS = [0, 0.25, 0.5, 0.75, 1];
function FatigueSection({ colors, value = 0.5, onChange }) {
  const current = Number.isFinite(Number(value)) ? Number(value) : 0.5;
  const example = [0, 1, 2].map(k => 2 - current * k).map(v => (Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, ''))).join(', ');
  return (
    <IOSListSection header="FATIGUE" colors={colors}>
      <div style={{ padding: '12px 16px' }}>
        <div style={UI.capsLabel}>RIR USED UP BY EACH WORKING SET</div>
        <div role="group" aria-label="Fatigue per working set" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px', marginTop: '8px' }}>
          {FATIGUE_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className="kinetic-btn"
              aria-pressed={current === opt}
              onClick={() => onChange?.(opt)}
              style={{ ...UI.pillBtn(current === opt), minHeight: '44px', padding: '6px 2px', letterSpacing: 0 }}
            >
              {opt}
            </button>
          ))}
        </div>
        <div style={{ ...UI.sentence, color: '#BDBDBD', marginTop: '10px' }}>
          Each working set leaves you a little closer to failure at the same weight. At {current} a set, three working sets
          are planned at one weight and read RIR {example}. Your 1RM adds the fatigue back, so slowing down over an
          exercise doesn&apos;t count as getting weaker. Most lifters sit between 0.25 and 1; higher reps and big lifts
          fatigue more.
        </div>
      </div>
    </IOSListSection>
  );
}

export const CONFIGURATION_TABS = [
  { id: 'body', label: 'BODY METRICS' },
  { id: 'goals', label: 'GOALS' },
  { id: 'equipment', label: 'EQUIPMENT' },
  // id stays 'routines' (saved tab choice); the tab is called TRAINING (choosing a program moved to the Programs page)
  { id: 'routines', label: 'TRAINING' }
];

export function ConfigurationView({
  colors,
  tab,
  setTab,
  setCurrentView,
  bodyMetricsProps,
  goalsProps,
  equipmentProps,
  setPreferencesProps,
  programProps,
  // ATHLETE mode: no TRAINING tab (set preferences, fatigue)
  athleteMode = false,
  // Called when NEXT / DONE leaves a tab (e.g. leaving BODY METRICS confirms the bodyweight and height)
  onStepDone
}) {
  const tabs = athleteMode ? CONFIGURATION_TABS.filter(t => t.id !== 'routines') : CONFIGURATION_TABS;
  const tabIndex = Math.max(
    0,
    tabs.findIndex(t => t.id === tab)
  );
  const activeTab = tabs[tabIndex].id;
  const isLastTab = tabIndex === tabs.length - 1;

  return (
    <div style={{ paddingBottom: '24px' }}>
      <div style={{ padding: '12px var(--dp-spacing-gutter) 0' }}>
        <AttachedTabStrip rounded ariaLabel="Configuration" tabs={tabs} value={activeTab} onChange={setTab} fontSize="11px" letterSpacing="0.04em" />
      </div>

      {/* Selections on each tab (pressed pills and rows, ON) are white: .cr-config in KINETIC_CSS */}
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
          <SetPreferencesSection colors={colors} {...setPreferencesProps} />
          <FatigueSection colors={colors} value={programProps?.fatiguePerSet} onChange={programProps?.setFatiguePerSet} />
        </div>
      )}

      </div>

      {/* NEXT / DONE is white: the red is on the answers above. STEP n OF 4 says where you are in the setup. */}
      <div style={{ padding: '0 var(--dp-spacing-gutter)' }}>
        <div style={{ ...UI.capsLabel, padding: '0 4px', marginBottom: '6px' }}>
          STEP {tabIndex + 1} OF {tabs.length}
        </div>
        <Button
          variant="primary-row"
          style={{ backgroundColor: '#FFFFFF', color: '#000000' }}
          onClick={() => {
            onStepDone?.(activeTab);
            if (isLastTab) {
              setCurrentView('home');
              return;
            }
            setTab(tabs[tabIndex + 1].id);
            // The next step starts at its top
            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        >
          <span>{isLastTab ? 'DONE' : `NEXT: ${tabs[tabIndex + 1].label}`}</span>
          <span>→</span>
        </Button>
      </div>
    </div>
  );
}

export default ConfigurationView;
