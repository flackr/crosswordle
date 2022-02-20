const STRINGS = {
  "help1": `The goal is to guess the two crossing words in as few guesses
      as possible. Each guess must be composed of valid words. After each
      guess you'll get a clue, e.g.`,
  "help2": "For compactness, this will be summarized as:",
  "help3": `Green indicates the letter is in the correct location. Yellow indicates a
      correct letter in the wrong location. Each yellow tile corresponds to one
      of that letter. For example, in this case the answer has only one S so
      only the first S turned yellow.`,
  "help4": "From the above clue, you can infer:",
  "help5": "Hint: The two words are related.",
  "help-clue1": "There is a C at the start of the horizontal word.",
  "help-clue2": "There is an O in at least one of the words. Note that there was only one O in your guess, even though it is displayed twice in the summary.",
  "help-clue3": "There is exactly one S in one of the words.",
  "help-clue4": "There is no W or R in the answer.",
  "help-clue5": "There is a D in at least one of the words.",
  "settings": "Settings",
  "skip-filled": "Skip filled positions",
  "clue-remaining": "Keyboard clues for remaining letters",
  "hard-mode": "Hard mode",
  "hard-mode-next-game": "Hard mode will take effect on your next game. It cannot be turned on mid-game.",
  "create-custom": "Create your own crosswordle:",
  "credit": `
      Created by Robert Flack, source available at <a href="https://github.com/flackr/crosswordle">github</a>.
      Inspired by the popular <a href="https://www.powerlanguage.co.uk/wordle/">Wordle</a> game.
      Dictionary file from aspell6 package. See <a href="third_party/aspell6-en/Copyright">Copyright</a> for details.`,
  "victory": "Victory!",
  "victory-message": `You got it in <span id="guesses"></span> guesses`,
  "click-share": `Click <button id="share">Share</button> to copy a summary of your game.`,
  "copied-clipboard": "Copied results to clipboard!",
  "incomplete": "Incomplete word",
  "horizontal-word-letter-must-be": "Horizontal word letter {} must be {}",
  "vertical-word-letter-must-be": "Vertical word letter {} must be {}",
  "unrecognized-word": "Word not in dictionary: {}",
  "two-words-required": "Must enter exactly two words separated by a space.",
  "min-letters": "You must have {} {}'s.",
  "custom-crosswordle": "Custom Crosswordle",
  "enter": "Enter",
  "erase": "Erase",
  "language": "Language",
  "automatic": "Automatic",
  "english": "English",
  "french": "French",
};

const FIRST_PUZZLE = new Date(2022,0,30,0,0,0,0);
const ENCODED = ["sctfe ogoqv","ywax suzd","lgjm bmcmc","zyxv obhrf","qjkgo mndf","ylvsb sljfe","vphue nwxclt","qdexj olvsx","rpzve phqjgr","qghbtj srfbt","lhyr iux","hwzve clovbhr","hwkic onogr","wpcvov fmrgv","lhtstj pzrs","ewhue fsoqr","hdejo mnotgv","whexi dixfe","vpfu vgad","rphjov qoach","hwzf vuxgfw","wyeys ilovxhy","dhbso ccqege","hojjo npmfgn","lhfrc apzkmrj","ehioop omfu","zye gpmqzf","vphulw ozkbgt","dwkgo nymrm","hyejnn oeerhr","ehghll mdveh","hwnj bfcb","rhvthp mbfac","lxjxe mszxge","uojcb enjege","uljmbd noeg","lwfiv miy","oru uvaix","swn cpwhdy","kyeg jgdd","kczrh undpe","zwm uvaaje","qlgii scmsgr","kyeg pnqoeg","uleji kcshg","yhtrh ccjvr","ipoa pzsmho","fhrgo kcmd","lye hpwsz","ylucs eiwfw","lhtstj rvqx","iyegbd poqg","zhcrh ocqe","ihc qymsm","qpz pzbpd","fyc dlocxf","ylui xbsqw","vwcic ksrfc","iwfo dxwm","uljbko roege","lhtstj pzper","rcu uzqnqf","hhfsup dvqdh","zpgi bcsce","oljj zbs","vyr vfms","glyic zwxage","hwcikn cfglfj","icgrk isjvjr","lxevnb beb","ipoa bogvbc","spii itpzf","vwoi vuqdw","ulurb kilfe","spcvhp oje","eluudn poqf","hhnic clovr","lhtstj rvqx","zwm uzqnw","swn vifcvx","epbsh bhgjrr","hcrgdi mdsrmr","ofgbkp muwrhn","icgrk biaf","zpgi jgzje","hcrgdi majnmb","qrcsmp aeeo","lwfv wuqdq","ywgshr ljgg","qfjbkn aef","hhxv zsdjsg","voavo cibfw","lcghov zvvrlt","ulurb cctfw","fpcxdi iakf","zhcrh wizrg","hcrgdi gdpctz","epbsh ocsf","dwxc kaajp","vhzf oxxd","qfajl upjde","hyhrh ocsf","epbsh bhgjrr","iwzu wxnl","whhi kunmbu","lwglhp mjog","yljjb pcvq","cpti qanqp","vhzgi mnodg","iyegbd poqg","dhhie nwbncp","hlayo ksrfc","wwy pygqh","kpbic iiqkb","ywgshr zdcshr","ylucs uhm","dpyuhp pzper","zpgi xanjbf","epbsh upwknn","scgl bqz","icgrk bhgjrr","hcrgdi adar","ehghll poreh","xloikn xdff","lye qymsm","vphvov zvvrlt","hcrgdi vvxlfa","dyhvtj gdpctz","dwdiv nscwg","iyexb uqwpdc","zlvcb swcd","dwzfon mhpwh","lhtstj cmdge","lfegh zwxage","kyy uvxmq","hcrgdi lovfr","ihgi zsdjsg","zpgi banjfe","gjuj bciaf","ipoa bogvbc","icgrk ziwrwh","hcrgdi avcazm","uleji bibkfr","wdjki oszxe","ewxi bmwsi","lxjyg limzgt","zlarh oceqr","spcvhp qjcg","ehecb dwoqf","ehvxb xnsfw","qfjbkn vokf","ycfg axnaf","lfegh dnvrmr","dwzfon eoxth","ryul wuqdq","qfajl upjd","lwfv jukd","voavo fcewg","khgrk azbkwh","lrpklj muwrhn","zlvcb swcd","hcrgdi gdpctz","ryevs biwf","qruvdi iakf","eoagi oimf","gdano xhz","lkvrcp zjxgr","ywax kunlfr","dwzfon vmkdh","hcrgdi devfr","uljbko dzbne","lxagh uljtg","ylui nbisf","rwcr uumd","ulurb psox","lrpklj ovpwg","hcrgdi loy","zwm tim","vhzf axnaf","shn qymsm","vhzvs zcwkbk","lhtstj ljgg","kyeg pnqoeg","lhfsi eiqeg","qlgii scmsgr","qiu avxwb","zbugmp zvvrlt","wyxv abhdvf","eyfg xfccf","ipoaov ldtgv","vwzh wuqdq","pchslv gjhk","hhnic nwbncp","hcrgdi vvxlfa","ywcve upjd","wyxv bqhwff","uljcv gxabvh","ogtkjp qougr","wljri bichg","dhyicl qjcgr","zwm cyms","ewxi jur","ryul ubsoek","ylui nbisf","ycfg ylcevr","ywti qulef","iyexb biwf","dpyuhp igfe","dhyicl rvqcg","shn uznq","upbsks njwg","twzge nqohgr","fyex aqqeqg","tzcrbp qou","hlayo gxsfi","lxul nxroqf","rwq uybs","hhnic clovrr","ywax qulef","syorh nyqegb","uleji hwmi","ipoa vgml","vhzgi fsoxrl","icgrk lhcd","lfegh uzvrbt","ewxi bmwsi","kyeg pnqoeg","zhcrh uzvrbt","wdjki slvy","lhtstj rvqxhr","ulurb wizrg","rwcr baqq","swn vifcvx","hwz mykwd","ywcve upjde","xlrrk undpe","rwage khff","hhxv zsdjsg","kwksi dnvyrl","kyeg wxnzd","lhtstj zddls","icgrk bhgjrr","qiu avxwb","lhfrc axdqjp","lhfrc nyqegb","gjuj kunlfr","dyhvtj gdpctz"];
