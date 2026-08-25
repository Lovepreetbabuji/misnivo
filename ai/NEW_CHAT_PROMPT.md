# Naye chat ki pehli baat — ye copy karke paste kar do

> Ye file sirf isliye hai taaki naya chat shuru karte waqt ye prompt dhoondhna
> na pade. Neeche wala poora hissa copy karo aur naye chat me sabse pehla
> message bana kar bhej do.

---

Ye Misnivo project hai. Main coder nahi hoon, isliye Hinglish me aur aasan
bhasha me baat karo — dhaancha `claude.md` me likha hai.

Kaam shuru karne se pehle ye teen file padho, isi order me:

1. `ai/HANDOFF.md` — sabse upar `TURN:` line hai. Agar `TURN: GEMINI` likha ho
   to ruk jao aur mujhe batao.
2. `PROJECT_CONTEXT.md` — project kya hai (section 1-11), aur abhi haalat kya
   hai (section 12).
3. `ai/bugs_found.md` — kya theek ho chuka, kya bacha hai.

Padhne ke baad mujhe teen line me batao:
- abhi baari kiski hai
- live build kaun sa hai
- kya kaam bacha hua hai

Phir ruk jaana — main bataunga kya karna hai.

Do cheezein jo bhoolni nahi hain:
- Live site tab tak nahi badalti jab tak push na ho AUR teeno stamp na badle
  (css `?v=`, js `?v=`, `sw.js` ka `VER`).
- Browser test me `headless:false` hi chalega. App Check enforced hai, automatic
  browser ko token milta hi nahi — 403 aayega, aur wo app ka bug nahi hai.
