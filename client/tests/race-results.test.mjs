import test from 'node:test';
import assert from 'node:assert/strict';
import { raceTeams,formatRaceTime } from '../src/race-results.js';

test('team results sum every contribution and sort arrivals before unfinished players',()=>{
  const players=[
    {id:'a',team:0,finishPosition:null,racePoints:0,bestHeight:120},
    {id:'b',team:1,finishPosition:1,racePoints:10,bestHeight:187},
    {id:'c',team:0,finishPosition:3,racePoints:8,bestHeight:187},
    {id:'d',team:0,finishPosition:2,racePoints:9,bestHeight:187},
  ];
  const teams=raceTeams({players});
  assert.deepEqual(teams.map(t=>t.points),[17,10]);
  assert.deepEqual(teams[0].players.map(p=>p.id),['d','c','a']);
  assert.equal(teams[0].arrived,2);
  assert.equal(players[0].id,'a');
});

test('race clock preserves hundredths and carries minutes correctly',()=>{
  assert.equal(formatRaceTime(125.35),'2:05,35');
  assert.equal(formatRaceTime(59.999),'1:00,00');
  assert.equal(formatRaceTime(360),'6:00,00');
});
