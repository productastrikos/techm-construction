// Dictionary parts owned by the main session (procurement, cost, hse, portfolio, docs, reports, admin).
// Registered once in dict.ts so the shared file does not need touching for every feature.
import type { Part } from '../dict';
import { procurement } from './procurement';
import { cost } from './cost';
import { hse } from './hse';
import { portfolio } from './portfolio';
import { docs } from './docs';
import { reports } from './reports';
import { admin } from './admin';

export const mine: Part[] = [procurement, cost, hse, portfolio, docs, reports, admin];
