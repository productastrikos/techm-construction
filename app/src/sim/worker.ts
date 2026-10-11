/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { SimCore } from './core';

// The simulator runs off the main thread so What-If runs and telemetry never block the UI.
Comlink.expose(new SimCore());
