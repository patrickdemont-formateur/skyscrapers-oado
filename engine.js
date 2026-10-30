/* ==========================================================================
   Skyscrapers – moteur de calcul (V1)
   Ce fichier unique sert à trois endroits :
     - le navigateur (balise <script>, objet global SKS),
     - Google Apps Script (copie nommée Engine.gs, identique octet pour octet),
     - les tests Node (tests/run-tests.js).
   Règles : voir « Fiche de règles v1 » et « Skyscrapers_jeux_de_reference.xlsx ».
   ========================================================================== */
var SKS = (function () {
  'use strict';

  // Barème (constant dans cette version, repris du cahier des charges et d'Excel)
  var DEFAULTS = {
    fondations: 5000,   // € forfait
    coutSeconde: 150,   // € par seconde de construction
    coutBrique: 300,    // € par brique utilisée
    gainCm: 500,        // € par cm d'élévation
    coefH: 11.8,        // cm par unité « hauteur »
    coefL: 2.3,         // cm par unité « largeur »
    coefE: 0.8,         // cm par unité « épaisseur »
    tempsMin: 1,        // secondes
    tempsMax: 300,      // secondes (5 minutes)
    briquesMax: 100,
    equipesMin: 2,
    equipesMax: 4
  };

  function params(over) {
    var p = {}, k;
    for (k in DEFAULTS) p[k] = DEFAULTS[k];
    if (over) for (k in over) if (over[k] !== undefined && over[k] !== null && !isNaN(Number(over[k]))) p[k] = Number(over[k]);
    return p;
  }

  function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  function entier(v) {
    if (v === '' || v === null || v === undefined) return NaN;
    var n = Number(v);
    return (isFinite(n) && Math.floor(n) === n) ? n : NaN;
  }

  /* ---------- Contrôle de saisie ----------
     input : { minutes, secondes, briques, h, l, e }
     retour : { ok, errors:[{champ,message}], warnings:[message] } */
  function valider(input, over) {
    var p = params(over), errors = [], warnings = [];
    var m = entier(input.minutes), s = entier(input.secondes), b = entier(input.briques);
    var h = entier(input.h), l = entier(input.l), e = entier(input.e);

    if (isNaN(m) || m < 0 || m > 5) errors.push({ champ: 'minutes', message: 'Minutes : entier de 0 à 5.' });
    if (isNaN(s) || s < 0 || s > 59) errors.push({ champ: 'secondes', message: 'Secondes : entier de 0 à 59.' });
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s <= 59) {
      var t = m * 60 + s;
      if (t < p.tempsMin || t > p.tempsMax) {
        errors.push({ champ: 'temps', message: 'Le temps doit être compris entre ' + p.tempsMin + ' s et ' + Math.floor(p.tempsMax / 60) + ' min 00 s.' });
      }
    }
    if (isNaN(b)) errors.push({ champ: 'briques', message: 'Briques : nombre entier attendu.' });
    else if (b < 1) errors.push({ champ: 'briques', message: 'Il faut au moins 1 brique.' });
    else if (b > p.briquesMax) errors.push({ champ: 'briques', message: p.briquesMax + ' briques maximum.' });

    [['h', h, 'Hauteur'], ['l', l, 'Largeur'], ['e', e, 'Épaisseur']].forEach(function (u) {
      if (isNaN(u[1]) || u[1] < 0 || u[1] > 100) errors.push({ champ: u[0], message: u[2] + ' : entier de 0 à 100.' });
    });

    if (!errors.length && (h + l + e) > b) {
      warnings.push('Le total des unités d\u2019élévation (' + (h + l + e) + ') dépasse le nombre de briques (' + b + ').');
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /* ---------- Calcul d'une construction (théorique, avant statut) ---------- */
  function calculer(input, over) {
    var p = params(over);
    var tempsS = Number(input.minutes) * 60 + Number(input.secondes);
    var elevation = Number(input.h) * p.coefH + Number(input.l) * p.coefL + Number(input.e) * p.coefE;
    var gain = elevation * p.gainCm;
    var coutTemps = tempsS * p.coutSeconde;
    var coutBriques = Number(input.briques) * p.coutBrique;
    var couts = p.fondations + coutTemps + coutBriques;
    return {
      tempsS: tempsS,
      elevationCm: r2(elevation),
      gain: r2(gain),
      fondations: r2(p.fondations),
      coutTemps: r2(coutTemps),
      coutBriques: r2(coutBriques),
      couts: r2(couts),
      net: r2(gain - couts)
    };
  }

  /* Résultat retenu selon le statut : un ouvrage non conforme vaut 0 € */
  function resultatRetenu(calc, statut) {
    return statut === 'non conforme' ? 0 : calc.net;
  }

  /* Bilan C1 + C2 : secondaire, absent si l'une des deux manque.
     (C3 repart de zéro : aucun report.) */
  function bilanC1C2(c1, c2) {
    if (c1 === null || c1 === undefined || c2 === null || c2 === undefined) return null;
    return r2(Number(c1) + Number(c2));
  }

  function somme(valeurs) {
    var t = 0;
    (valeurs || []).forEach(function (v) { if (v !== null && v !== undefined && !isNaN(v)) t += Number(v); });
    return r2(t);
  }

  /* ---------- Challenge collectif ----------
     resultatsC3 : résultats retenus de TOUTES les équipes actives (non conforme = 0).
     Comme dans Excel : remporté si l'écart est strictement positif. */
  function challenge(resultatsC3, montant) {
    var s = somme(resultatsC3), ecart = r2(s - Number(montant));
    return { somme: s, montant: Number(montant), ecart: ecart, remporte: ecart > 0 };
  }

  /* Suggestion de départ (règle simple) : 10 000 € par équipe, 15 000 € maximum. */
  function suggestionChallenge(nbEquipes) {
    return { parEquipe: 10000, total: 10000 * nbEquipes, maxParEquipe: 15000, maxTotal: 15000 * nbEquipes };
  }

  /* ---------- Moyenne historique : par équipe et par construction, conformes uniquement ----------
     lignes : [{ construction: 1|2|3, net, conforme }] */
  function moyennesHistoriques(lignes) {
    var out = { 1: null, 2: null, 3: null };
    [1, 2, 3].forEach(function (k) {
      var v = (lignes || []).filter(function (x) { return Number(x.construction) === k && x.conforme; }).map(function (x) { return Number(x.net); });
      out[k] = v.length ? r2(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
    });
    return out;
  }

  /* ---------- Code d'atelier : SKS + quantième (3 chiffres) + _ + année (2 chiffres) ----------
     Un 2e atelier le même jour reçoit une lettre : SKS303_26, SKS303_26B, SKS303_26C… */
  function jourDeLAnnee(annee, mois, jour) {
    var d = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
    if (bissextile) d[1] = 29;
    var n = jour;
    for (var i = 0; i < mois - 1; i++) n += d[i];
    return n;
  }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function codeSeance(annee, mois, jour, existants) {
    var base = 'SKS' + pad(jourDeLAnnee(annee, mois, jour), 3) + '_' + pad(annee % 100, 2);
    var pris = existants || [];
    if (pris.indexOf(base) === -1) return base;
    for (var c = 66; c <= 90; c++) {            // B … Z
      var cand = base + String.fromCharCode(c);
      if (pris.indexOf(cand) === -1) return cand;
    }
    return null;
  }
  function codeValide(code) { return /^SKS\d{3}_\d{2}[A-Z]?$/.test(String(code || '')); }

  /* ---------- Formats d'affichage (français) ---------- */
  function milliers(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  function euro(n, avecPlus) {
    var v = r2(Number(n)), neg = v < 0, a = Math.abs(v);
    var txt = (a % 1 === 0) ? milliers(a) : milliers(Math.floor(a)) + ',' + pad(Math.round((a - Math.floor(a)) * 100), 2);
    return (neg ? '\u2212' : (avecPlus && v > 0 ? '+' : '')) + txt + '\u00a0\u20ac';
  }
  function temps(minutes, secondes) { return Number(minutes) + ':' + pad(Number(secondes), 2); }

  return {
    DEFAULTS: DEFAULTS, params: params, valider: valider, calculer: calculer, resultatRetenu: resultatRetenu,
    bilanC1C2: bilanC1C2, somme: somme, challenge: challenge, suggestionChallenge: suggestionChallenge,
    moyennesHistoriques: moyennesHistoriques, jourDeLAnnee: jourDeLAnnee, codeSeance: codeSeance, codeValide: codeValide,
    euro: euro, temps: temps, r2: r2
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = SKS; }
