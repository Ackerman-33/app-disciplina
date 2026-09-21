// SVG propios, trazo fino y esquinas filosas. Usan currentColor: el color lo pone el CSS.
const svg = (inner, extra = '') =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" aria-hidden="true" focusable="false" ${extra}>${inner}</svg>`;

export const ICONS = {
  // Cumplido: tilde grueso, trazo recto.
  done: svg('<polyline points="4,13 9.5,18.5 20,5.5" stroke-width="3"/>'),
  // No cumplido: cruz fina y filosa.
  failed: svg('<line x1="5" y1="5" x2="19" y2="19" stroke-width="1.4"/><line x1="19" y1="5" x2="5" y2="19" stroke-width="1.4"/>'),
  // Cambió: flecha semicircular fina.
  changed: svg('<path d="M5 16 A7 7 0 0 1 19 16" stroke-width="1.5"/><polyline points="15.6,13.2 19,16.6 22,13" stroke-width="1.5"/>'),
  // Navegación: flechas angulosas con tope.
  prev: svg('<polyline points="17,4 8,12 17,20" stroke-width="2"/><line x1="5" y1="4" x2="5" y2="20" stroke-width="2"/>'),
  next: svg('<polyline points="7,4 16,12 7,20" stroke-width="2"/><line x1="19" y1="4" x2="19" y2="20" stroke-width="2"/>'),
};
