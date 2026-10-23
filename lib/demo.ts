import type {Player} from "./fantasy";
// Fictional sample players, teams and round points — never label as CricHeroes results.
export const PLAYERS:Player[]=[
  ["p01","Aarav Sethi","Northside CC","WK",48],
  ["p02","Rohan Kapoor","Capital Strikers","WK",26],
  ["p03","Ishaan Gill","Northside CC","BAT",71],
  ["p04","Kabir Malhotra","West End XI","BAT",54],
  ["p05","Dev Mehra","Capital Strikers","BAT",34],
  ["p06","Arjun Dhillon","Northside CC","BAT",62],
  ["p07","Neil Shah","West End XI","BAT",22],
  ["p08","Vivaan Batra","Capital Strikers","AR",83],
  ["p09","Samar Sidhu","West End XI","AR",55],
  ["p10","Aryan Joshi","Northside CC","AR",31],
  ["p11","Harsh Anand","West End XI","BOWL",68],
  ["p12","Yash Oberoi","Capital Strikers","BOWL",47],
  ["p13","Karan Rai","Northside CC","BOWL",57],
  ["p14","Aman Bhalla","West End XI","BOWL",41],
  ["p15","Tanish Arora","Capital Strikers","BOWL",25],
  ["p16","Pranav Sen","West End XI","WK",36],
  ["p17","Sahil Grewal","Capital Strikers","BAT",42],
  ["p18","Kunal Puri","Northside CC","BAT",59],
  ["p19","Reyansh Sood","West End XI","AR",44],
  ["p20","Manav Khanna","Northside CC","BOWL",51]
].map(row=>({id:row[0] as string,name:row[1] as string,team:row[2] as string,role:row[3] as Player["role"],points:row[4] as number}));
export const START_SQUAD=PLAYERS.slice(0,15).map(p=>p.id);
export const START_BENCH=["p02","p07","p10","p15"];
