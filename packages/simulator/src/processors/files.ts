/* import { Conductor } from '../core/conductor.js';
import { hookUpConductors } from './message.js';

export function downloadFile(name: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createRecord('a');
  a.style.display = 'none';
  a.href = url;
  // the filename you want
  a.download = name;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
}

export function fileToPlayground(json): PlaygroundContext {
  const conductors = json.conductors.map((c) => new Conductor(c));
  hookUpConductors(conductors);
  return {
    ...json,
    conductors,
  };
}
 */