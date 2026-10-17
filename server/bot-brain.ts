import type {ChatMessage,ControlView,Lang,TrialKind,Value} from '../shared/protocol';
import {decodeClue,isCipher} from '../shared/trial-rules';
import {describeFor,understandFor} from './bot-lines';
import {isDial,readWave,waveValue,bitsValue,readWiresParts} from '../shared/dials';
import {readBarsParts} from '../shared/lexicon';

interface Memory { seen:number; value?:Value; choices:Value[]; height?:number; density?:number; bars?:(0|1|undefined)[]; row?:number; col?:number; }
const pick=<T>(arr:readonly T[])=>arr[Math.floor(Math.random()*arr.length)];
export interface BotThought { value?:Value; withdraw:boolean; lines:string[]; }

// A companion receives only its options, the public rule and visible chat.
// No generated target or another player's private inventory enters this module.
export class CompanionBrain {
  private controls=new Map<string,Memory>();
  reject(controlId:string){const memory=this.controls.get(controlId);if(memory){memory.value=undefined;memory.choices=[];memory.height=undefined;memory.density=undefined;memory.bars=undefined;memory.row=undefined;memory.col=undefined;}}
  think(control:Pick<ControlView,'id'|'label'|'options'|'scale'>,kind:TrialKind,messages:ChatMessage[],sourceName:string,lang:Lang):BotThought {
    const memory=this.controls.get(control.id) ?? {seen:0,choices:[]};
    this.controls.set(control.id,memory);
    let withdraw=false;const lines:string[]=[];
    const tr=(ru:string,en:string)=>lang==='ru'?ru:en;
    for(const message of messages.filter(m=>m.id>memory.seen)){
      memory.seen=message.id;
      const text=message.text.trim();
      const normalized=text.toLowerCase().replace(/[.,!?«»]/g,' ').trim();
      let clue:Value|null=null;
      if(memory.choices.length && /^(а|a|первый вариант|первое описание)$/.test(normalized))clue=memory.choices[0];
      else if(memory.choices.length>1 && /^(б|b|второй вариант|второе описание)$/.test(normalized))clue=memory.choices[1];
      else if(memory.choices.length===1 && /^(да|верно|именно|ага|yes|correct|exactly)$/.test(normalized))clue=memory.choices[0];
      else clue=understandFor(kind,text,control.options,control.scale);
      // A wave can arrive in two halves: height in one message, spacing in another
      if(clue===null && kind==='wave'){
        const w=readWave(text);
        if(w.height!==undefined)memory.height=w.height;
        if(w.density!==undefined)memory.density=w.density;
        if(memory.height!==undefined && memory.density!==undefined)clue=waveValue(memory.height,memory.density);
        else if(w.height!==undefined || w.density!==undefined){
          lines.length=0;
          lines.push(w.height!==undefined?tr(`${sourceName}, высоту понял. А горбы как пила или растянутые?`,`${sourceName}, got the height. Packed like a saw or stretched?`):tr(`${sourceName}, горбы понял. А высокая или низкая?`,`${sourceName}, got the humps. Tall or low?`));
          continue;
        }
      }
      // A socket can arrive in two halves too: "у двери", then "ближе к полу"
      if(clue===null && kind==='wires'){
        const w=readWiresParts(text);
        if(w.row!==undefined)memory.row=w.row;
        if(w.col!==undefined)memory.col=w.col;
        if(memory.row!==undefined && memory.col!==undefined)clue=memory.row*3+memory.col;
        else if(w.row!==undefined || w.col!==undefined){
          lines.length=0;
          lines.push(w.row!==undefined?tr(`${sourceName}, ряд понял. А у двери, посередине или у окна?`,`${sourceName}, got the row. By the door, middle or window?`):tr(`${sourceName}, понял сторону. А ближе к потолку или к полу?`,`${sourceName}, got the side. Nearer the ceiling or the floor?`));
          continue;
        }
      }
      // Three bars can also arrive bit by bit: "у двери лежит", then "остальные торчат"
      if(clue===null && kind==='equalizer'){
        const before=memory.bars ?? [undefined,undefined,undefined];
        const bars=readBarsParts(text,before);
        if(bars.some((b,i)=>b!==before[i])){
          memory.bars=bars;
          if(bars.every(b=>b!==undefined))clue=bitsValue(bars as number[]);
          else{
            const names=lang==='ru'?['бас','голос','писк']:['the bass','the voice','the treble'];
            const missing=names.filter((_,i)=>bars[i]===undefined).join(lang==='ru'?' и ':' and ');
            lines.length=0;
            lines.push(tr(`${sourceName}, понял часть. А ${missing}: торчит или лежит?`,`${sourceName}, got part of it. And ${missing}: sticking out or lying flat?`));
            continue;
          }
        }
      }
      if(clue!==null){
        const answer=decodeClue(kind,clue,control.options);
        if(memory.value!==answer){
          withdraw=memory.value!==undefined;memory.value=answer;memory.choices=[];
          lines.length=0;
          const said=describeFor(kind,clue,lang,control.scale);
          if(isCipher(kind)){
            lines.push(tr(`Ага, мне пришло ${said}.`,`Okay, my input is ${said}.`));
            lines.push(tr(`По правилу выходит ${describeFor(kind,answer,lang)}. Ставлю.`,`By the rule that makes ${describeFor(kind,answer,lang)}. Setting it.`));
          }else lines.push(pick(lang==='ru'
            ?[`Понял, ${said}. Ставлю.`,`Ага, ${said}. Готово.`,`Есть: ${said}. Жму «уверен».`]
            :[`Got it, ${said}. Setting it.`,`Okay, ${said}. Done.`]));
        }
        continue;
      }
      if(/^(не то|не так|неправильно|нет|wrong|not that|no)(?: |$)/.test(normalized)){
        memory.value=undefined;memory.choices=[];withdraw=true;
        lines.length=0;lines.push(pick(lang==='ru'?[`${sourceName}, ок, снял. Что я не так понял?`,`Блин. ${sourceName}, а что не так?`]:[`${sourceName}, okay, undone. What did I get wrong?`]));continue;
      }
      if(/не знаю|не понял|помоги|повтори|объясни|help|repeat|explain|don't know/i.test(text))continue;
      if(text.length<4 || /^(ок|ладно|хорошо|понял|спасибо|okay|thanks)$/i.test(normalized))continue;
      const choices=isDial(kind)?[]:control.options.filter(value=>understandFor(kind,text,[value])===value);
      if(memory.value!==undefined && !choices.length)continue;
      memory.choices=choices.slice(0,2);
      if(choices.length>1){memory.value=undefined;withdraw=true;}
      lines.length=0;
      if(choices.length>1){
        lines.push(tr(`${sourceName}, тут два варианта, не пойму какой. Скажи «А» или «Б».`,`${sourceName}, could be two things. Say “A” or “B”.`));
        lines.push(`А: ${describeFor(kind,choices[0],lang)}. Б: ${describeFor(kind,choices[1],lang)}.`);
      } else if(memory.value===undefined) {
        lines.push(pick(lang==='ru'?[`${sourceName}, хм, «${text.slice(0,30)}»… не понял.`,`${sourceName}, не догнал. Можно по-другому?`]:[`${sourceName}, hm, not getting it.`,`${sourceName}, say it another way?`]));
        lines.push(kind==='wave'?tr('Высокая или низкая? И горбы как пила или растянутые?','Tall or low? Packed like a saw or stretched?')
          :kind==='antenna'?tr('Куда смотрит: на потолок, пол, окно или дверь?','Where does it point: ceiling, floor, window or door?')
          :kind==='cassette'?tr('Сколько клеток закрашено? Сравни с чем-нибудь: лапы, пальцы, колёса.','How many frames are filled? Compare: paws, fingers, wheels.')
          :kind==='equalizer'?tr('Какие полоски торчат: бас, голос, писк?','Which bars stick out: bass, voice, treble?')
          :kind==='morse'?tr('Простучи мне по порядку: тук или тууук?','Tap it to me in order: beep or beeeep?')
          :kind==='scale'?tr('Стрелка на какой картинке? Или между какими?','Which picture is the pointer on? Or between which?')
          :kind==='wires'?tr('Ближе к потолку или к полу? У двери, посередине или у окна?','Nearer the ceiling or the floor? By the door, middle or window?')
          :kind==='lamp'?tr('На что похож цвет? Только без названия.','What is that colour like? No names.')
          :typeof control.options[0]==='number'?tr('Это сколько чего? Лап, пальцев, дней?','A count of what? Legs, fingers, days?')
          :tr('Что эта штука делает? Где её видел?','What does it do? Where would I see it?'));
      }
    }
    return {value:memory.value,withdraw,lines:lines.map(line=>line.slice(0,140))};
  }
}
