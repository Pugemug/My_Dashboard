/**
 * Unit Tests für Akzeptanzkriterien Berechnungslogik.
 * Importiert direkt aus src/calc/akzeptanz.calc.js — kein Copy-Paste.
 */

import { describe, it, expect } from 'vitest';
import { wordCount, calcAkQuality, sortStagesByBrpEtappen } from '../../src/calc/akzeptanz.calc.js';

describe('wordCount', () => {
  it('zählt Wörter korrekt', () => {
    expect(wordCount('Als Nutzer möchte ich etwas tun')).toBe(6);
  });

  it('zählt genau 3 Wörter', () => {
    expect(wordCount('Drei Wörter hier')).toBe(3);
  });

  it('zählt genau 4 Wörter', () => {
    expect(wordCount('Vier Wörter sind hier')).toBe(4);
  });

  it('gibt 0 zurück bei null', () => {
    expect(wordCount(null)).toBe(0);
  });

  it('gibt 0 zurück bei leerem String', () => {
    expect(wordCount('')).toBe(0);
  });

  it('gibt 0 zurück bei nur Whitespace', () => {
    expect(wordCount('   ')).toBe(0);
  });

  it('behandelt mehrfache Leerzeichen korrekt', () => {
    expect(wordCount('Wort1   Wort2  Wort3')).toBe(3);
  });
});

describe('calcAkQuality', () => {
  const epics = [
    { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: 'Als Nutzer möchte ich' },        // 4 Wörter → qualifiziert
    { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: 'Drei Wörter hier' },             // 3 Wörter → nicht qualifiziert
    { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: null },                            // null → nicht qualifiziert
    { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: 'Fünf Wörter sind hier drin' },   // 5 Wörter → qualifiziert
    { Stage: 'Eta2', Squad: 'A', Akzeptanzkriterien: 'Als Nutzer möchte ich etwas' },  // 5 Wörter → qualifiziert
  ];

  it('berechnet Prozentsatz korrekt (2 von 4 = 50,00)', () => {
    expect(calcAkQuality(epics, 'Eta1', 'A')).toBe(50);
  });

  it('gibt 100 zurück wenn alle qualifizieren', () => {
    expect(calcAkQuality(epics, 'Eta2', 'A')).toBe(100);
  });

  it('gibt null zurück wenn N=0 (kein Epic in Stage+Squad)', () => {
    expect(calcAkQuality(epics, 'Eta1', 'B')).toBeNull();
    expect(calcAkQuality(epics, 'EtaUnbekannt', 'A')).toBeNull();
  });

  it('gibt 0 zurück wenn kein Epic qualifiziert (N>0, n=0)', () => {
    const onlyBad = [
      { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: 'Drei Wörter hier' },
      { Stage: 'Eta1', Squad: 'A', Akzeptanzkriterien: null },
    ];
    expect(calcAkQuality(onlyBad, 'Eta1', 'A')).toBe(0);
  });

  it('rundet auf 2 Dezimalstellen', () => {
    // 1 von 3 = 33.3333... → 33.33
    const threeEpics = [
      { Stage: 'S', Squad: 'X', Akzeptanzkriterien: 'Vier Wörter sind hier' },
      { Stage: 'S', Squad: 'X', Akzeptanzkriterien: 'Drei Wörter nur' },
      { Stage: 'S', Squad: 'X', Akzeptanzkriterien: 'Kurz' },
    ];
    expect(calcAkQuality(threeEpics, 'S', 'X')).toBe(33.33);
  });
});

describe('sortStagesByBrpEtappen', () => {
  const toDate = s => s ? new Date(s) : null;

  it('sortiert chronologisch nach Startdatum', () => {
    const stages  = ['Eta2', 'Eta1', 'Eta3'];
    const brpRows = [
      { Etappe: 'Eta1', Startdatum: '2025-01-01' },
      { Etappe: 'Eta2', Startdatum: '2025-04-01' },
      { Etappe: 'Eta3', Startdatum: '2025-07-01' },
    ];
    expect(sortStagesByBrpEtappen(stages, brpRows, toDate)).toEqual(['Eta1', 'Eta2', 'Eta3']);
  });

  it('stellt unbekannte Stages alphabetisch ans Ende', () => {
    const stages  = ['Eta2', 'Eta1', 'Unbekannt', 'AndereStage'];
    const brpRows = [
      { Etappe: 'Eta1', Startdatum: '2025-01-01' },
      { Etappe: 'Eta2', Startdatum: '2025-04-01' },
    ];
    expect(sortStagesByBrpEtappen(stages, brpRows, toDate)).toEqual(['Eta1', 'Eta2', 'AndereStage', 'Unbekannt']);
  });

  it('gibt alphabetische Reihenfolge zurück wenn brpRows leer', () => {
    const stages = ['Eta2', 'Eta1', 'Eta3'];
    expect(sortStagesByBrpEtappen(stages, [], toDate)).toEqual(['Eta1', 'Eta2', 'Eta3']);
  });

  it('gibt leeres Array zurück wenn stages leer', () => {
    const brpRows = [{ Etappe: 'Eta1', Startdatum: '2025-01-01' }];
    expect(sortStagesByBrpEtappen([], brpRows, toDate)).toEqual([]);
  });
});
