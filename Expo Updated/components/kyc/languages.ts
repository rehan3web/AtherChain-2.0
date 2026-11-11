import ISO6391 from 'iso-639-1';

// Representative regions, not claims that a language belongs to one country.
const REGIONS = 'aa:ET ab:GE ae:IR af:ZA ak:GH am:ET an:ES ar:EG as:IN av:RU ay:BO az:AZ ba:RU be:BY bg:BG bi:VU bm:ML bn:BD bo:CN br:FR bs:BA ca:ES ce:RU ch:GU co:FR cr:CA cs:CZ cu:RU cv:RU cy:GB da:DK de:DE dv:MV dz:BT ee:GH el:GR en:GB es:ES et:EE eu:ES fa:IR ff:SN fi:FI fj:FJ fo:FO fr:FR fy:NL ga:IE gd:GB gl:ES gn:PY gu:IN gv:IM ha:NG he:IL hi:IN ho:PG hr:HR ht:HT hu:HU hy:AM hz:NA id:ID ig:NG ii:CN ik:US is:IS it:IT iu:CA ja:JP jv:ID ka:GE kg:CD ki:KE kj:NA kk:KZ kl:GL km:KH kn:IN ko:KR kr:NG ks:IN ku:TR kv:RU kw:GB ky:KG la:VA lb:LU lg:UG li:NL ln:CD lo:LA lt:LT lu:CD lv:LV mg:MG mh:MH mi:NZ mk:MK ml:IN mn:MN mr:IN ms:MY mt:MT my:MM na:NR nb:NO nd:ZW ne:NP ng:NA nl:NL nn:NO no:NO nr:ZA nv:US ny:MW oc:FR oj:CA om:ET or:IN os:GE pa:IN pl:PL ps:AF pt:PT qu:PE rm:CH rn:BI ro:RO ru:RU rw:RW sa:IN sc:IT sd:PK se:NO sg:CF si:LK sk:SK sl:SI sm:WS sn:ZW so:SO sq:AL sr:RS ss:ZA st:ZA su:ID sv:SE sw:TZ ta:IN te:IN tg:TJ th:TH ti:ET tk:TM tl:PH tn:ZA to:TO tr:TR ts:ZA tt:RU tw:GH ty:PF ug:CN uk:UA ur:PK uz:UZ ve:ZA vi:VN wa:BE wo:SN xh:ZA yi:UA yo:NG za:CN zh:CN zu:ZA';
const regions: Record<string, string> = Object.fromEntries(REGIONS.split(' ').map(pair => pair.split(':')));
export type Language = { code: string; name: string; nativeName: string; flag: string; region?: string };
export const LANGUAGES: Language[] = ISO6391.getAllCodes().map(code => {
  const region = regions[code];
  return {
    code, name: ISO6391.getName(code), nativeName: ISO6391.getNativeName(code), region,
    flag: region ? [...region].map(letter => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join('') : '',
  };
}).sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function searchLanguages(query: string): Language[] {
  const needle = query.trim().toLocaleLowerCase();
  return LANGUAGES.filter(item => `${item.name} ${item.nativeName} ${item.code}`.toLocaleLowerCase().includes(needle));
}
