import { Column, Dozen, JamesBondZone, Parity, RangeBand, RouletteColour } from "./types";

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type NumberMeta = {
  number: number;
  colour: RouletteColour;
  parity: Parity;
  rangeBand: RangeBand;
  dozen: Dozen;
  column: Column;
  jamesBondZone: JamesBondZone;
};

export const EUROPEAN_ROULETTE_TABLE: NumberMeta[] = Array.from({ length: 37 }, (_, number) => ({
  number,
  colour: getColour(number),
  parity: getParity(number),
  rangeBand: getRangeBand(number),
  dozen: getDozen(number),
  column: getColumn(number),
  jamesBondZone: getJamesBondZone(number),
}));

export function getColour(number: number): RouletteColour {
  if (number === 0) return "green";
  return RED_NUMBERS.has(number) ? "red" : "black";
}

export function getParity(number: number): Parity {
  if (number === 0) return "zero";
  return number % 2 === 0 ? "even" : "odd";
}

export function getRangeBand(number: number): RangeBand {
  if (number === 0) return "zero";
  return number <= 18 ? "low" : "high";
}

export function getDozen(number: number): Dozen {
  if (number === 0) return 0;
  if (number <= 12) return 1;
  if (number <= 24) return 2;
  return 3;
}

export function getColumn(number: number): Column {
  if (number === 0) return 0;
  const mod = number % 3;
  if (mod === 1) return 1;
  if (mod === 2) return 2;
  return 3;
}

export function getJamesBondZone(number: number): JamesBondZone {
  if (number === 0) return "zero";
  if (number >= 13 && number <= 18) return "mid";
  if (number >= 19) return "high";
  return "uncovered";
}

export function getNumberMeta(number: number): NumberMeta {
  const found = EUROPEAN_ROULETTE_TABLE[number];
  if (!found) {
    throw new Error(`Invalid roulette number: ${number}`);
  }
  return found;
}
