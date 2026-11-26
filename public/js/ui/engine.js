/* The dashed "ADAPTIVE ENGINE · why this is happening:" box (MP4: shown whenever hmm. changes its behaviour;
   label renamed after usability testing). The chameleon sits in it: the adaptation, made visible. */
export const engineBox = (body, { id = "", cham = true } = {}) => `
  <aside class="engine" ${id ? `id="${id}"` : ""}>
    ${cham ? `<span class="engine__cham" data-chameleon="30"></span>` : ""}
    <div><span class="engine__label">Adaptive engine · why this is happening:</span> <span class="engine__body">${body}</span></div>
  </aside>`;
