import { useApp } from './store';
import { useOverlay } from './overlay';
import { useScenario } from '../features/whatif/scenarioStore';
import { useWorkOrders } from '../features/assets/woStore';
import { useTwin } from '../features/twin/twinStore';
import { useHse } from '../features/hse/hseStore';
import { useProc } from '../features/procurement/model';
import { resetTypedSop } from '../features/hse/CctvWall';

/** everything the presenter changes during a run, back to the opening state (used by the header clock reset and the presenter panel) */
export function resetDemo() {
  useApp.getState().resetClock();
  useScenario.getState().clear();
  useScenario.setState({ saved: [] });
  useOverlay.getState().clear();
  useWorkOrders.getState().reset();
  useHse.getState().reset();
  useProc.setState({ hz: 'open', tab: 'tower', selected: null, stage: null, scan: null });
  useTwin.getState().patch({ viewT: null, initialised: false, playing4d: false, aiScanning: false });
  useApp.getState().select(null);
  resetTypedSop();
  window.dispatchEvent(new CustomEvent('mz:reset'));
}
