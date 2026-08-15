(function(){
  "use strict";

  /* ---------------- Helpers ---------------- */
  function round2(n){ n = Number(n)||0; return Math.round((n + Number.EPSILON) * 100) / 100; }
  function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }
  function esc(str){
    return String(str===undefined||str===null?'':str).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function getNested(obj, path){
    return path.split('.').reduce(function(o,k){ return (o===undefined||o===null)?o:o[k]; }, obj);
  }
  function setNested(obj, path, value){
    var keys = path.split('.');
    var o = obj;
    for (var i=0; i<keys.length-1; i++){ o = o[keys[i]]; }
    o[keys[keys.length-1]] = value;
  }
  function fmtEUR(n){
    return new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(round2(n));
  }
  function fmtQty(n){
    return new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(Number(n)||0);
  }
  function fmtPct(n){
    return new Intl.NumberFormat('fr-FR', {maximumFractionDigits:2}).format(Number(n)||0) + ' %';
  }
  function fmtDateFR(iso){
    if(!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
  }
  function addMonthsISO(iso, months){
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    d.setMonth(d.getMonth() + (Number(months)||0));
    return d.toISOString().slice(0,10);
  }

  /* ---------------- Data ---------------- */
  var blankState = {
    docType: 'DEVIS',
    numero: '',
    dateEmission: todayISO(),
    validiteMois: 3,
    emetteur: { nom:'', nomCourt:'', contact:'', adresse:'', tel:'', email:'', siret:'', tvaIntra:'', apeCode:'' },
    destinataire: { nom:'', adresse:'' },
    reference: '',
    objet: '',
    lignes: [ { designation:'', quantite:1, unite:'heures', prixUnitaireHT:0 } ],
    fraisGestionPct: 20,
    fraisGestionLabel: 'Frais de gestion',
    tvaPct: 20,
    conditionsReglement: '',
    afficherCoordBancaires: true,
    coordBancaires: { titulaire:'', domiciliation:'', codeBanque:'', codeGuichet:'', numeroCompte:'', cleRib:'', iban:'', bic:'' },
    notes: ''
  };

  var exampleState = {
    docType: 'DEVIS',
    numero: '2026-ESPCI-ME-003',
    dateEmission: '2026-07-31',
    validiteMois: 3,
    emetteur: {
      nom: 'Microscopie Electronique ESPCI',
      nomCourt: 'ESPCI',
      contact: 'Bruno Bresson / Delphine Rigot',
      adresse: `06 rue Jean Calvin\n75005 PARIS`,
      tel: '06 71 79 33 79',
      email: `bruno.bresson@espci.fr\ndelphine.rigot@espci.fr`,
      siret: '200 000 685 000 12',
      tvaIntra: 'FR31 200 000 685',
      apeCode: '8542Z'
    },
    destinataire: { nom: 'Faircraft', adresse: '' },
    reference: '2026-ESPCI-ME-003',
    objet: `Heure de travail au MEB ESPCI — 1er novembre 2025 au 10 mai 2026`,
    lignes: [
      { designation: `Nombre d'heures MEB Magellan`, quantite: 25.75, unite: 'heures', prixUnitaireHT: 106.40 }
    ],
    fraisGestionPct: 20,
    fraisGestionLabel: 'Frais de gestion ESPCI',
    tvaPct: 20,
    conditionsReglement: `Règlement à effectuer sous 30 jours fin de mois civil à compter de la date de réception de la facture, par virement bancaire sur le compte indiqué ci-dessous, ou par chèque libellé à l'ordre du Trésor Public et adressé à la Direction Régionale des Finances Publiques, secteur public local, service AEL, bureau 326, 94 rue Réaumur, 75002 Paris.`,
    afficherCoordBancaires: true,
    coordBancaires: {
      titulaire: 'Direction Régionale des Finances Publiques',
      domiciliation: 'BDF Paris',
      codeBanque: '30001',
      codeGuichet: '00064',
      numeroCompte: 'R7510000000',
      cleRib: '61',
      iban: 'FR71 3000 1000 64C7 5100 0000 061',
      bic: 'BDFEFRPPCCT'
    },
    notes: ''
  };

  var state = deepClone(exampleState);

  /* ---------------- Calculations ---------------- */
  function computeTotals(s){
    var lines = (s.lignes||[]).map(function(l){
      var qty = Number(l.quantite)||0;
      var pu = Number(l.prixUnitaireHT)||0;
      return Object.assign({}, l, { montant: round2(qty*pu) });
    });
    var totalHT = round2(lines.reduce(function(sum,l){ return sum + l.montant; }, 0));
    var frais = round2(totalHT * (Number(s.fraisGestionPct)||0) / 100);
    var totalHTFrais = round2(totalHT + frais);
    var tva = round2(totalHTFrais * (Number(s.tvaPct)||0) / 100);
    var totalTTC = round2(totalHTFrais + tva);
    return { lines:lines, totalHT:totalHT, frais:frais, totalHTFrais:totalHTFrais, tva:tva, totalTTC:totalTTC };
  }

  function validityText(s){
    if (s.docType === 'FACTURE'){
      return `Facture émise le ${fmtDateFR(s.dateEmission)}.`;
    }
    var months = Number(s.validiteMois)||0;
    if (months > 0){
      var expiry = addMonthsISO(s.dateEmission, months);
      return `Ce devis est valable ${months} mois à compter du ${fmtDateFR(s.dateEmission)}, soit jusqu'au ${fmtDateFR(expiry)}.`;
    }
    return `Ce devis est valable jusqu'à nouvel ordre.`;
  }

  function footerLine(em){
    var parts = [];
    var name = em.nomCourt || em.nom;
    if (name) parts.push(esc(name));
    if (em.siret) parts.push('SIRET ' + esc(em.siret));
    if (em.tvaIntra) parts.push('TVA Intracommunautaire ' + esc(em.tvaIntra));
    if (em.apeCode) parts.push('Code APE ' + esc(em.apeCode));
    return parts.join(' — ');
  }

  function linesRowsHTML(totals){
    if (!totals.lines.length){
      return `<tr><td colspan="5" class="empty-row">Aucune ligne de prestation.</td></tr>`;
    }
    return totals.lines.map(function(l){
      return `<tr>
        <td>${esc(l.designation || '—')}</td>
        <td class="num">${fmtQty(l.quantite)}</td>
        <td>${esc(l.unite || '')}</td>
        <td class="num">${fmtEUR(l.prixUnitaireHT)}</td>
        <td class="num strong">${fmtEUR(l.montant)}</td>
      </tr>`;
    }).join('');
  }

  function bankBlockHTML(cb){
    var rows = '';
    if (cb.titulaire) rows += `<div class="bank-wide"><span>Titulaire</span><strong>${esc(cb.titulaire)}</strong></div>`;
    if (cb.domiciliation) rows += `<div><span>Domiciliation</span><strong>${esc(cb.domiciliation)}</strong></div>`;
    if (cb.codeBanque) rows += `<div><span>Code banque</span><strong>${esc(cb.codeBanque)}</strong></div>`;
    if (cb.codeGuichet) rows += `<div><span>Code guichet</span><strong>${esc(cb.codeGuichet)}</strong></div>`;
    if (cb.numeroCompte) rows += `<div><span>N° de compte</span><strong>${esc(cb.numeroCompte)}</strong></div>`;
    if (cb.cleRib) rows += `<div><span>Clé RIB</span><strong>${esc(cb.cleRib)}</strong></div>`;
    if (cb.iban) rows += `<div class="bank-wide"><span>IBAN</span><strong>${esc(cb.iban)}</strong></div>`;
    if (cb.bic) rows += `<div><span>BIC</span><strong>${esc(cb.bic)}</strong></div>`;
    if (!rows) return '';
    return `<section class="doc-bank"><h3>Coordonnées bancaires</h3><div class="bank-grid">${rows}</div></section>`;
  }

  /* ---------------- Rendering: preview ---------------- */
  function renderPreview(){
    var totals = computeTotals(state);
    var label = state.docType === 'FACTURE' ? 'Facture' : 'Devis';
    var paper = document.getElementById('paper');

    paper.innerHTML = `
      <header class="doc-head">
        <div>
          <p class="doc-eyebrow">${esc(state.emetteur.nomCourt || state.emetteur.nom || 'Votre structure')}</p>
          <h1 class="doc-title">${esc(label.toUpperCase())}</h1>
        </div>
        <div class="doc-meta">
          <div><span>Date</span><strong>${fmtDateFR(state.dateEmission)}</strong></div>
          <div><span>${esc(label)} n°</span><strong>${esc(state.numero || '—')}</strong></div>
          <div><span>Destinataire</span><strong>${esc(state.destinataire.nom || '—')}</strong></div>
        </div>
      </header>

      <section class="doc-parties">
        <div class="party">
          <h3>Émetteur</h3>
          <p class="party-name">${esc(state.emetteur.nom || '—')}</p>
          ${state.emetteur.contact ? `<p>${esc(state.emetteur.contact)}</p>` : ''}
          ${state.emetteur.adresse ? `<p>${esc(state.emetteur.adresse)}</p>` : ''}
          ${state.emetteur.tel ? `<p>Tél : ${esc(state.emetteur.tel)}</p>` : ''}
          ${state.emetteur.email ? `<p>${esc(state.emetteur.email)}</p>` : ''}
        </div>
        <div class="party party-ref">
          <div class="ref-box">
            <p class="ref-label">Référence à rappeler${state.docType==='FACTURE' ? ' sur le règlement' : ' sur la facture'}</p>
            <p class="ref-value">${esc(state.reference || state.numero || '—')}</p>
            <p class="ref-note">${esc(validityText(state))}</p>
          </div>
          ${state.destinataire.adresse ? `<p class="dest-address">${esc(state.destinataire.adresse)}</p>` : ''}
        </div>
      </section>

      ${state.objet ? `
      <section class="doc-object">
        <span>Objet</span>
        <p>${esc(state.objet)}</p>
      </section>` : ''}

      <table class="lines-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="num">Qté</th>
            <th>Unité</th>
            <th class="num">PU HT</th>
            <th class="num">Montant HT</th>
          </tr>
        </thead>
        <tbody>${linesRowsHTML(totals)}</tbody>
      </table>

      <section class="totals">
        <div class="totals-row"><span>Total HT</span><strong>${fmtEUR(totals.totalHT)}</strong></div>
        <div class="totals-row"><span>${esc(state.fraisGestionLabel || 'Frais de gestion')} (${fmtPct(state.fraisGestionPct)})</span><strong>${fmtEUR(totals.frais)}</strong></div>
        <div class="totals-row subtotal"><span>Total HT + frais de gestion</span><strong>${fmtEUR(totals.totalHTFrais)}</strong></div>
        <div class="totals-row"><span>TVA (${fmtPct(state.tvaPct)})</span><strong>${fmtEUR(totals.tva)}</strong></div>
        <div class="totals-row grand-total"><span>Total TTC</span><strong>${fmtEUR(totals.totalTTC)}</strong></div>
      </section>

      ${state.conditionsReglement ? `
      <section class="doc-terms">
        <h3>Conditions de règlement</h3>
        <p>${esc(state.conditionsReglement)}</p>
      </section>` : ''}

      ${state.notes ? `
      <section class="doc-terms">
        <h3>Mentions complémentaires</h3>
        <p>${esc(state.notes)}</p>
      </section>` : ''}

      ${state.afficherCoordBancaires ? bankBlockHTML(state.coordBancaires) : ''}

      <footer class="doc-footer">${footerLine(state.emetteur)}</footer>
    `;

    updateRecap(totals);
  }

  function updateRecap(t){
    var set = function(id, val){ var el = document.getElementById(id); if (el) el.textContent = val; };
    set('recapHT', fmtEUR(t.totalHT));
    set('recapFrais', fmtEUR(t.frais));
    set('recapHTFrais', fmtEUR(t.totalHTFrais));
    set('recapTVA', fmtEUR(t.tva));
    set('recapTTC', fmtEUR(t.totalTTC));
  }

  /* ---------------- Rendering: line items editor ---------------- */
  function lineCardHTML(l, i){
    return `
      <div class="line-card" data-index="${i}">
        <div class="line-card-top">
          <input type="text" data-field="designation" placeholder="Désignation de la prestation" value="${esc(l.designation)}">
          <button type="button" class="btn-remove-line" data-index="${i}" title="Supprimer la ligne">✕</button>
        </div>
        <div class="line-card-grid">
          <label class="mini-field"><span>Quantité</span><input type="number" step="0.01" data-field="quantite" value="${l.quantite}"></label>
          <label class="mini-field"><span>Unité</span><input type="text" id="uniteInputFake" data-field="unite" value="${esc(l.unite)}"></label>
          <label class="mini-field"><span>PU HT (€)</span><input type="number" step="0.01" data-field="prixUnitaireHT" value="${l.prixUnitaireHT}"></label>
        </div>
        <div class="line-card-foot">
          <span>Montant HT</span>
          <strong id="line-amount-${i}">${fmtEUR(round2((Number(l.quantite)||0)*(Number(l.prixUnitaireHT)||0)))}</strong>
        </div>
      </div>`;
  }

  function renderLinesEditor(){
    var container = document.getElementById('linesEditor');
    if (!state.lignes.length){
      container.innerHTML = `<p class="empty-hint">Aucune ligne. Cliquez sur « + Ajouter une ligne ».</p>`;
      return;
    }
    container.innerHTML = state.lignes.map(lineCardHTML).join('');
  }

  /* ---------------- Form <-> state binding ---------------- */
  function setFormValuesFromState(){
    document.querySelectorAll('#formPanel [data-path]').forEach(function(el){
      var val = getNested(state, el.dataset.path);
      if (el.type === 'checkbox'){ el.checked = !!val; }
      else { el.value = (val===undefined||val===null) ? '' : val; }
    });
  }

  function bindStaticInputs(){
    document.querySelectorAll('#formPanel [data-path]').forEach(function(el){
      el.addEventListener('input', function(){
        var val;
        if (el.type === 'checkbox'){ val = el.checked; }
        else if (el.dataset.type === 'number'){
          val = el.value === '' ? 0 : parseFloat(String(el.value).replace(',', '.'));
          if (isNaN(val)) val = 0;
        } else {
          val = el.value;
        }
        setNested(state, el.dataset.path, val);
        renderPreview();
      });
    });
  }

  function bindLinesEditor(){
    var container = document.getElementById('linesEditor');

    container.addEventListener('input', function(e){
      var card = e.target.closest('.line-card');
      if (!card) return;
      var idx = Number(card.dataset.index);
      var field = e.target.dataset.field;
      if (!field) return;
      var val = e.target.value;
      if (field === 'quantite' || field === 'prixUnitaireHT'){
        val = val === '' ? 0 : parseFloat(String(val).replace(',', '.'));
        if (isNaN(val)) val = 0;
      }
      state.lignes[idx][field] = val;
      var amt = round2((Number(state.lignes[idx].quantite)||0) * (Number(state.lignes[idx].prixUnitaireHT)||0));
      var amtEl = document.getElementById('line-amount-' + idx);
      if (amtEl) amtEl.textContent = fmtEUR(amt);
      renderPreview();
    });

    container.addEventListener('click', function(e){
      var btn = e.target.closest('.btn-remove-line');
      if (!btn) return;
      var idx = Number(btn.dataset.index);
      state.lignes.splice(idx, 1);
      renderLinesEditor();
      renderPreview();
    });

    document.getElementById('btnAddLine').addEventListener('click', function(){
      state.lignes.push({ designation:'', quantite:1, unite:'heures', prixUnitaireHT:0 });
      renderLinesEditor();
      renderPreview();
      var cards = container.querySelectorAll('.line-card');
      var last = cards[cards.length - 1];
      if (last){
        var inp = last.querySelector('[data-field="designation"]');
        if (inp) inp.focus();
      }
    });
  }

  /* ---------------- Top-level actions ---------------- */
  function loadExample(){
    if (!confirm(`Charger les données d'exemple ? Cela remplacera le contenu actuel du formulaire.`)) return;
    state = deepClone(exampleState);
    setFormValuesFromState();
    renderLinesEditor();
    renderPreview();
  }

  function resetForm(){
    if (!confirm(`Vider tous les champs pour repartir d'un document vierge ?`)) return;
    state = deepClone(blankState);
    state.dateEmission = todayISO();
    setFormValuesFromState();
    renderLinesEditor();
    renderPreview();
  }

  function downloadPdf(){
    var original = document.title;
    var label = state.docType === 'FACTURE' ? 'Facture' : 'Devis';
    var safeNum = (state.numero || 'document').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
    document.title = `${label}_${safeNum}`;
    var restore = function(){ document.title = original; };
    window.addEventListener('afterprint', restore, { once:true });
    setTimeout(restore, 4000);
    setTimeout(function(){ window.print(); }, 60);
  }

  /* ---------------- Init ---------------- */
  function init(){
    setFormValuesFromState();
    renderLinesEditor();
    renderPreview();
    bindStaticInputs();
    bindLinesEditor();
    document.getElementById('btnExample').addEventListener('click', loadExample);
    document.getElementById('btnReset').addEventListener('click', resetForm);
    document.getElementById('btnPdf').addEventListener('click', downloadPdf);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
