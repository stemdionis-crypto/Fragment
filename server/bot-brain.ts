import type {ChatMessage,ControlView,Lang,TrialKind,Value} from '../shared/protocol';
import {decodeClue,isCipher} from '../shared/trial-rules';
import {describeClue,understandClue} from './bot-lines';

interface Memory { seen:number; value?:Value; choices:Value[]; }
export interface BotThought { value?:Value; withdraw:boolean; lines:string[]; }

// A companion receives only its options, the public rule and visible chat.
// No generated target or another player's private inventory enters this module.
export class CompanionBrain {
  private controls=new Map<string,Memory>();
  reject(controlId:string){const memory=this.controls.get(controlId);if(memory){memory.value=undefined;memory.choices=[];}}
  think(control:Pick<ControlView,'id'|'label'|'options'>,kind:TrialKind,messages:ChatMessage[],sourceName:string,lang:Lang):BotThought {
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
      else clue=understandClue(text,control.options);
      if(clue!==null){
        const answer=decodeClue(kind,clue,control.options);
        if(memory.value!==answer){
          withdraw=memory.value!==undefined;memory.value=answer;memory.choices=[];
          lines.length=0;
          lines.push(tr(`Понял подсказку для моего пульта: ${describeClue(clue,lang)}.`,`I understood my input clue: ${describeClue(clue,lang)}.`));
          if(isCipher(kind))lines.push(tr(`Применил правило. На моём пульте: ${describeClue(answer,lang)}.`,`Applied the rule. My control is set to ${describeClue(answer,lang)}.`));
          else lines.push(tr('Выставил ответ. Я уверен.','Set my answer. I am ready.'));
        }
        continue;
      }
      if(/^(не то|не так|неправильно|нет|wrong|not that|no)(?: |$)/.test(normalized)){
        memory.value=undefined;memory.choices=[];withdraw=true;
        lines.length=0;lines.push(tr(`${sourceName}, снимаю готовность. Какое свойство я понял неверно?`,`${sourceName}, I withdrew my answer. Which property did I misunderstand?`));continue;
      }
      if(/не знаю|не понял|помоги|повтори|объясни|help|repeat|explain|don't know/i.test(text))continue;
      if(text.length<4 || /^(ок|ладно|хорошо|понял|спасибо|okay|thanks)$/i.test(normalized))continue;
      const choices=control.options.filter(value=>understandClue(text,[value])===value);
      if(memory.value!==undefined && !choices.length)continue;
      memory.choices=choices.slice(0,2);
      if(choices.length>1){memory.value=undefined;withdraw=true;}
      lines.length=0;
      if(choices.length>1){
        lines.push(tr(`${sourceName}, вижу два варианта. Ответь «А» или «Б».`,`${sourceName}, I see two possibilities. Reply “A” or “B”.`));
        lines.push(`А: ${describeClue(choices[0],lang)}. Б: ${describeClue(choices[1],lang)}.`);
      } else if(memory.value===undefined) {
        lines.push(tr(`${sourceName}, не связал «${text.slice(0,40)}» с моими картинками.`,`${sourceName}, I could not match “${text.slice(0,40)}” to my pictures.`));
        lines.push(typeof control.options[0]==='number'
          ?tr('С чем связано количество: части тела, дни или предметы?','What does the quantity count: body parts, days or objects?')
          :tr('Подскажи действие или форму: что делает предмет, где его используют?','Give me its use or shape: what does it do, where is it used?'));
      }
    }
    return {value:memory.value,withdraw,lines:lines.map(line=>line.slice(0,140))};
  }
}
