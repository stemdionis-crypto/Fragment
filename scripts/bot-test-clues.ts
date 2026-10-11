import type { Room, Player } from '../server/room';
import { linesFor } from '../server/bot-lines';
import { HAND_TRIALS } from '../shared/trial-rules';

// Test input: emit meaningful chat from the actual holder of each clue.
// The expected answers belong to the fixture; companions still see only chat.
export function giveTestClues(room: Room, human: Player) {
  const trial = room.trial!;
  const emit = (player: Player, line: string) => (room as unknown as {say(p:Player,text:string,heard:boolean):void}).say(player,line,false);
  if (HAND_TRIALS.includes(trial.kind)) {
    for (const control of trial.controls.filter(c => room.players.find(p=>p.id===c.ownerId)?.companion)) {
      for (const line of linesFor({knows:[{controlId:control.id,value:control.target}],mine:{}},room.publicState(),'ru')) emit(human,'Ответ: '+line);
    }
  } else {
    for (const player of room.players) for (const line of linesFor({knows:trial.knows[player.id] ?? [],mine:{}},room.publicState(),'ru')) emit(player,line);
  }
}
