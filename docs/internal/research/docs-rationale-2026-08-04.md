# Docs rationale — Andrew interview, 2026-08-04

**Status: LIVING DOCUMENT — interview in progress (series 1 and 2 answered, series 3 pending).**
Do not treat unanswered sections as final. This file is the deliverable of the docs-rationale interview conversation and the input record for `MME-0118` (docs correctness repair) and `MME-0095` (docs IA and voice rewrite). Nothing in `docs/public/` was modified in that conversation.

Method: every public docs page stating WHAT or HOW without WHY was turned into a question. Andrew answered in his own words; his answers are recorded verbatim below (French/Franglais preserved — they are the source, not a transcription). Where Andrew could not justify a decision, that is recorded as a finding, not papered over.

---

## 1. Decisions validated by Andrew (actionable now)

| # | Decision | Owner rationale (short) | Impacts |
|---|---|---|---|
| D1 | **Markdown as durable source: the WHY is now on record** | Agents' native language + non-proprietary + files-on-your-disk ownership (Obsidian principle) + the Momentarise harness needs it + humans deserve beautiful reading of their own files without an IDE or a proprietary app | `document-model.md`, `index.md`, README — first paragraphs rewritten from this |
| D2 | **Rich mode is the default view; Source is the always-reachable real file** | "la vue par défaut c'est la rich, c'est juste que pour des devs ou en cas de bug, on doit pouvoir utiliser le fichier quand même" | Contradicts `index.md` ("source mode is first-class, not a fallback"). Reframe: Source is not the primary surface, it is the *guarantee* — you can always reach the real file. |
| D3 | **Preservation split into three rules; only two are non-negotiable** | Non-destruction of unknown syntax: keep. Byte-stability of untouched ranges: keep (it is the condition for human-reviewable agent diffs — the accept/reject wedge). Zero-normalization inside the edited range: NOT required. | `preservation.md` rewrite; `VISION.md` "byte-exact / stricter than Obsidian" must be bounded or removed |
| D4 | **Save-state taxonomy stays but will be simplified later** | The complexity is accidental (build-time difficulty), not doctrine. The honest core survives: "si tu vois que c'est sauvegardé alors que ça ne l'est pas c'est chiant" — same family as the no-false-done rule | `save-truthfulness.md` keeps the truth rule, drops the implied doctrine tone; simplification is future work |
| D5 | **Policy layer: protect-by-default for devs AND non-devs, host-configurable** | A poisoned agent context (.env, RIB, ID documents) is the concrete feared incident; defaults are deliberately broad; hosts can relax/re-vocabulary them | `policy.md` gains the incident-shaped WHY |
| D6 | **Extension registries: open by design; hybrid typing wanted** | Registries so hosts extend without forking, agents register at runtime, and adding a built-in is never a breaking change. NEW: type the MME-shipped command IDs (autocomplete + typo safety) while keeping open strings for `host:*` | Docs WHY in `extensions.md`; hybrid typing → new backlog item (see §6) |
| D7 | **AI boundary is architectural and public — option (a)** | Agency lives above, in Momentarise (proprietary harness); the editor stays the assistive-writing brick. Andrew validated saying this publicly rather than hiding it | `ai-privacy.md` states the boundary as a choice, not a limitation |
| D8 | **React/Next.js becomes the primary documented path; vanilla demoted but repaired** | "je préfère React… vanilla c'était pour la démo pendant le dev". Architecture rule unchanged: core packages never import React | Changes MME-0118 (vanilla quickstart must *work* but is no longer the flagship) and MME-0095 (nav order). PRD "vanilla remains the primary path" is superseded for docs; core independence stays |
| D9 | **"MME" is fine publicly — it is just the contraction** | Vault `00-positioning.md` ("MME n'est pas une entité publique") is outdated on this point and should be updated; harness may even be renamed at prod launch, OpenClaw-style | Removes the naming blocker on all of `docs/public/`; vault positioning file needs an edit (outside this repo) |
| D10 | **Alpha status: single source, single visible location** | Version generated from `package.json` + dist-tag; one status banner (homepage + Compatibility page); all other mentions become links. Repeated disclaimers read as anxiety | Already an MME-0118 acceptance criterion; ratified by Andrew |
| D11 | **Honest contributor stance, said once, with posture** | "the honest version… but it will not be as a 'I need help please' everywhere." AI-assisted build is stated plainly; contributions from experienced devs are explicitly welcome; the framework itself is the skills proof | `CONTRIBUTING.md` + one FAQ entry rewritten; kill the defensive "vibe coding" FAQ tone |
| D12 | **Personal story goes in a dedicated launch post, not concept pages** | The "finish something for others to finally finish something" story + wanting to be known — real, brand-consistent (BRAND-DNA §10), but blog material (MME-0097), not `concepts/*` | MME-0097 launch-post slot |
| D13 | **MPL-2.0 core / Apache-2.0 examples: conscious, keep it, write the WHY** | "examples may be modified, we don't care, but for the framework it is very interesting when someone contributes back" — file-level copyleft keeps improvements flowing back while allowing closed-product embedding | One paragraph in README §License + `compatibility-promise.md` |
| D14 | **ESM-only: originally accidental, now ratified as deliberate** | Andrew prefers the modern format; maintaining dual builds solo is real cost. "None is planned" may stand now that it is a decision | `compatibility-promise.md` keeps the line; tone can soften from hostile to explanatory |
| D15 | **Link-paste-over-selection** | Pasting a URL over selected text wraps it as a Markdown link (Claude Code composer behavior) | Added to `BACKLOG.md` §"Link Insertion On Paste Over A Selection" (2026-08-03) |
| D16 | **Lightweight files (.txt/.json/.csv/.yaml/.toml) and SVG: real product intent, currently buried** | Non-devs (and Andrew) need beautiful reading of adjacent files without an IDE/Excel; SVG because agents produce SVG assets. This is a sellable "one editor for the whole working folder" story, today hidden mid-page in `import-export.md` | `import-export.md` restructure in MME-0095 |

## 2. Decisions still open (Andrew asked for recommendations / series 3)

- **O1 — CodeMirror/ProseMirror**: Andrew has no personal rationale ("je ne suis pas très aware de ce que sont ces trucs et les alternatives") and asked for a recommendation. Claude's recommendation (pending Andrew's ratification): keep both — CodeMirror 6 is what Obsidian uses for source editing; ProseMirror is the engine under the Notion-class editors and under BlockNote/Tiptap. Declare ProseMirror no longer a "spike" (MME-0101 shipped it) and fix `roadmap.md` accordingly (already an MME-0118 criterion).
- **O2 — Localization**: `MmeStrings` contract + `defaultMmeStrings` (English) exist in `md-surface`; hosts inject translations; free/open, not a paid feature. But it is essentially undocumented publicly (two passing mentions) and no French dictionary ships. Andrew has a FR/EN ICP. Series 3 question: which languages ship as reference dictionaries, who owns them, do docs stay EN-only.
- **O3 — Docs in Payload CMS**: Andrew's declared first use case (Q12) is "the docs themselves, managed in Payload." Today the docs site is Next.js 16 + React 19 consuming MME packages, canonical content is plain `.md` in the repo, and no Payload integration exists anywhere ("No Payload CMS adapter ships today" is a public claim). Tension to resolve in series 3: the public promise "canonical content remains plain Markdown in the repo" vs "docs managed in Payload".
- **O4 — Performance budgets, CLI audience, roadmap order, AX two-angle split**: series 3.

## 3. Answers verbatim

Andrew's words, unedited. French/Franglais preserved.

### Série 1 (2026-08-04)

**Q1 — pourquoi le Markdown comme source durable ?**

> Ben md langage naturel des agents, format non propriétaire, utilité pour momentarise, mon harness agentique fait pour les knowledge workers, les créateurs (artistiques ou de contenu), les infopreneurs etc qui leur permettra d'aller très loin même seuls pour la partie workspace notamment, etc etc, je le dis dans les docs internes non ? et regarde dans le repo de momentarise, pte que c'est dit aussi là bas, et dans d'autres docs de mon vault. en gros l'accès doit être facilité pour les humains aussi, pcq c'est eux qui les lisent à la fin — pour ceux qu'ils lisent du moins, et ça peut être chiant de lire des trucs moche dans un ide ou de lire avec par exemple textedit ou ce genre d'app qui n'a aucun formatage, pas les notion etc car format propriétaire, etc etc. parfois on est bloqué dans une plateforme alors que là ce serait nos fichiers sur nos ordis, les même principes qu'obsidian un peu, mais avec en plus la partie dev qui veulent intégrer ça, les non dev qui veulent l'utiliser, etc etc. aussi obsidian est très cool, mais je voulais ajouter un agent IA dedans en plugin, mais c'était trop limité etce tc, et je ne voulais pas utiliser uniquement les lecteurs preview natifs des editeurs de code, même un non dev devrait pouvoir le lire, un dev aussi d'ailleurs ça doit le souler à un certain moment, d'où ma volonté de construire mon propre lecteur/editeur de md stv, mon framework, et le rendre accessible à tous contribuerai à les aider (dev et non dev) pcq j'adore aider, et à ma volonté de me faire connaitre, je ne sais pas comment cette dernière volonté peut être dit proprement. aussi, le fait que je n'ai jamais fini un projet pour moi malgré les dizaines que j'ai commencé, il fallait donc que je manipule mon cerveau, finir un truc pour les autres, et continuer pour moi après lol. ça aussi ça fera un peu gnagna non ? hahaha aussi rappeler les principes d'ax, d'ux et de dx, ax sous deux angles, utilisation des fichier, et construction avec ce framework. aussi si open source en plsu d'aider etc j'ai besoin d'aide de dev qui ont de l'xp pcq vibe codé je suis sur qu'il y a énormément d'erreurs qui font que ça ne peut pas être mis en prod. aussi une autre raison c'est que par exemple j'utilise des ide mais pas beau à lire, et aussi pour les sites que je construis (pte en expliquant mon positionnement, regarde dans AI agency, notamment 12 month chepaquoi), pour les blogs ce serait pas mal simple d'autant plus que les gens sont habitués aux slash editors maintenant. et pte justifier monc hoix de prendre payload cms et code custom plutot que wp, notamment le controle total pcq je prefere faire construire par l'ia que dépendre d'outils tiers ajd, c'est pourquoi je construis ça, mon propre outil de prospection et de call etc etc, jsp... je raconte ma vie ? ahhaha

**Q2 — pourquoi le mode Source obligatoire ?**

> en fait la vue par défaut etc c'et la rich, c'est juste que pour des devs ou en cas de bug, on doit pouvoir utiliser le fichier quand même ce serait con sinon. et les gens qui veulent pas l'afficher dans leur app ne l'affichent pas mdr. c'est pas dit et construit comme ça ?

**Q3 — pourquoi octet-exact plutôt que sémantiquement équivalent ?**

> ah bonne question jsp trop, c'et plutot les agents qui ont tourné ça comme ça, tu en penses quoi honnêtement ? ça complique les choses et ça ne sert à r ou ça peut être utile ? le but est de ne pas modifier le markdown avec des turcs propriétaire etc mais juste de l'afficher et de l'édioter joliment en tant qu'humains et parfois en collaboration avec les agents non ?

Follow-up (série 2): « mais c'est pas prévu qu'on accepte les wikilinks, les callouts, le mermaid, le latex etc ? on suit ta reco pour la Q3. »

**Q4 — pourquoi la taxonomie d'états de sauvegarde ?**

> ah non pas vrmt, c'est juste que pendant la construction ct compliqué de gérer les save automatiques, ça en vrai les gens pourront pte m'aider lol. et ouais genre si tu vois que c'est sauvegardé alos que ça ne l'est pas c'est un peu chiant quoi, et en vrai plus tard on va corriger ça et simplifier lol.

**Q5 — pourquoi une couche Policy dans un framework d'éditeur ?**

> Ben par exemple par principe, si un agent lit un .env (fichier qui contient des credentials/codes/url confidentiels), il doit être considéré comme corrompu, et si par exemple tu est en train d'interroger l'agent sur qqch, il peut te ressortir ça à n'importe quel moment, ou pire, si un memebre de ton organisation voit ça ou un dossier Perso qui contient rib pièce d'identité etc, c'est pas possible de laisser ça passer, esp si tu comprends. et les personnes qui utilisent le framework pourront régler ça en principe, ce n'est pas le cas dans le code ? pcq pte qu'l auront un autre vocabulaire, d'autres restrictions, pte qu'ils l'utiliseront pour eux-même et qu'il s'en foutent que leur .env soient envoyé à un agent (c'est le cas pour moi aussi, même si je prends de plus en plus l'habitude de ne pas le faire), pte qu'ils ne mettront jamais des rib et pièces d'identité dans leurs apps etc, j'ai juste prévu large un peu comme ça les dev et non devs sont protégés par nature.

**Q6 — pourquoi des préférences verrouillables « avec raison » ?**

> jsp pq j'ai mis raison mdr, normalement ça doit être libre, et non je n'ai pas prévu les questions que tu poses, pte pour l'agent ça peut être utile, aussi pour l'agent qui va mettre ça en place, ah oui pour certaines question pte que l'ax est un point à mettre en valeur.

**Q7 — pourquoi des registres ouverts plutôt que des unions fermées ?**

> ça c'est pour autoriser la personnalisation non ? de cette manière les gens sont plus libre non ? et ptn bonne question en fait je n'y ai pas pensé en discutant avec les agents, ça faudra m'aider à comprendre mdr. et 'noublie pas que je suis un non technique donc les truc technique haha..

Follow-up (série 2): « Q7 en hybride j'aime bien !! »

**Q8 — pourquoi l'IA reste assistive ?**

> Ben c'est surtout pour l'aide à l'écriture et l'autocompletion, pas pour workspace agentique (et ça c'est aussi en partie pcq je ne veux pas que ça mange sur le territoire de mon harness agentique qui lui sera propriétaire. et poui les agents doivent pouvoir l'utiliser, le trouver sur internet et l'installer/construire avec lui dans des apps plus ou moins compliquées. intuitivement je dirai plutot ça mais à revoir "un choix d'architecture définitif (l'agence vit au-dessus, dans Momentarise, jamais dans l'éditeur)".

**Q9 — pourquoi vanilla comme chemin principal ?**

> ça je ne sais pas, pq vanilla ? je prefere react moi, vanilla c'était pas juste pour la demo sur ordi pdt le dev ça ? les précisions sur react normalement voulaient dire que rien n'est hardcodé dans l'app et dans la doc du site, pcq ça doit être fait par mon framework de A à Z, et non fait par autre chose, et avec payload cms un editeur md, ce serait cool et en plus publiable, en production, propre, et personnalisable, avec des exemple types docs et artices d'antrhopic, openai, https://aiengineeringfromscratch.com/, etc etc

Follow-up (série 2): « Ben ouais faut corriger ce truc de vanilla !! c'est sur nextjs et react je les utiliserai perso même si ça doit être ouvert à tous ! » — and Q16: « je valide. »

**Q10 — nommage MME en public ?**

> Ben mme c'est juste un contraction lol, ça veut dire momentarise markdown editor, faut juste faire attention, et au contraire, on peut appeler mme, ce serait plus simple. je pense que das positionning faut changer ça, les deux c'est la même, juste mme = momentarise marketc c'est tout. d'ailleurs pte même que le harness ne s'appellera même pas momentarise, et je ferai comme openclaw et changerai de nom en prod mdr.

**Annexe série 1:**

> aussi hors sujet mais je dois mettre dans la doc et dans le site que c'est en alpha et maj le statut à chaque fois non ?
> D'ailleurs à ajouter en backlog, quand je sélectionne un texte et que je colle un lien ça fait comme l'éditeur/le composer de claude code sur dekstop app (pte sur web pas encore essayé), le texte devient en surbrillance, et devient en fait un bouton vers le lient collé.

### Série 2 (2026-08-04)

**Q11 — Rich par défaut ou Source de premier rang ?**

> I want it to be rich by default. as we said.

**Q12 — cas d'usage n°1 ?**

> The first use case I need is the doc we are talking about. because it has to be in payload CMS. And all the docs has to be managed there. And moreover, for the SEO and AEO pages, we have to manage this with our framework too. i don't knwo if the website is Payload and CMS Ready lol. and the webiste etc is in nextjs isn't it ?

**Q13 — dire publiquement que tu cherches de l'aide ?**

> the honnest version, because they will see this in the backoffice lol, and I'm not here to build framework for them. And moreover, even for the ai services, I am not here to be vibe code with ai is perfect because build a framework from scratch is not just a vibecoded dashboard... I will use that framework in my content to demonstrate my skills and for the product itself, but it will not be as a "I need help please" everywhere.

**Q14 — frontière harness publique ?**

> a

**Q15 — histoire personnelle dans les docs ?**

> dedicated launch post.

**Q17 — pourquoi MPL-2.0 / Apache-2.0 ?**

> it was my conscious choice proposed by an AI haha, because the examples may be modified, maybe change the police, or the color, we don't care, but for all it is very interesting when someone contribute to the improvment of this framework lol.
> And i call it a framework, is it a framework ? what is really mme ?

**Q18 — ESM-only ?**

> i think that it is not a conscious choici, but i prefere to use the modern import format lol, when is it not interesting to use the modern one ? when to use the previous/ancient format ? I am not a dev so ther are some things that I'm still learning lol.

**Q19 — CodeMirror / ProseMirror ?**

> your reco ? i am not very aware of what are these and the alternatives.

**Q20 — pourquoi .txt/.csv/.json/.yaml/.toml et SVG ?**

> it is because sometimes i read json files etc etc, and the txt default app are not very beautiful, as md. so we can maybe later include them as files type that are easy to read and to use with our framework, for exemple if a non dev had to open md un txt, and the same for json, because he/she has not an IDE installed, it will be very difficult to them to read complicated json and code files, and for instance, i don't have excel, so when i try to open a csv file, it opens directly in the ide... etc etc. and the svg it is as the html lol, sometimes we will ask to do a svg asset to an ai agent, even if rare, and maybe later to modify simply the svg directly from the editor will be very great.

**Annexe série 2 (localization):**

> Question : the localization is not managed by the framework ? for exemple if i have a french and english icp for my product (as the mme founder and a dev that want to use mme or as a non technical using mme as his blog manager ou editor) ? it is as the i18n ? or another paid feature ?

### Série 3 — pending

---

## 4. Findings: decisions that were inherited or accidental (a result in itself)

These are the places where the docs assert doctrine that no human decided. MME-0095's voice rule ("we chose X because Y") must not fabricate a Y here; either the ratified decision above supplies one, or the sentence should say what is actually true.

1. **"Byte-exact / stricter than Obsidian" (VISION.md)** — agent-authored framing; Andrew: "c'est plutôt les agents qui ont tourné ça comme ça." Ratified replacement: rules 1–2 of D3 stay non-negotiable, rule 3 (zero normalization inside the edited range) is explicitly not required.
2. **Save-state taxonomy as doctrine** — accidental complexity from build difficulties (D4). The truth *rule* is Andrew's; the six-target *taxonomy* is not. Docs should present the rule, not the taxonomy, as the identity.
3. **Preference lock "reason" field** — "jsp pq j'ai mis raison mdr." Candidate rationale (Andrew's own guess, not asserted): useful for agents and for the agent that configures the host. Docs should not present it as a designed feature until that's decided.
4. **Five preference layers** — never justified; do not write a rationale for the number. Describe the mechanism, not a philosophy.
5. **"Vanilla remains the primary path" (PRD)** — nobody decided it; reversed by D8.
6. **ESM-only "none is planned"** — accidental, since ratified (D14).
7. **CodeMirror/ProseMirror choice** — no owner rationale; recommendation pending ratification (O1).
8. **Vault positioning rule "MME n'est pas une entité publique"** — superseded by D9; the vault file is now the outdated document, not the repo.

## 5. Per-page rewrite proposals (Andrew's voice — drafts for MME-0095)

House style: `concepts/theming.md`. Short declarative sentences, one stated value per section, "we chose X because Y" with Y from §1/§3 above. These are direction paragraphs, not final copy.

### `index.md` / README opening
- Lead with D1 in plain words: *Your documents stay real `.md` files on your disk. Markdown is the one format that humans, git, GitHub, and AI agents all read natively — and nobody owns it. MME exists so you get a modern editor (rich editing, slash commands, AI assist) without trading your files for a proprietary database.*
- The Obsidian sentence is allowed and honest: *the ownership principles of Obsidian, packaged as a framework you can build into your own product.*
- Default-path reorder (D8): React/Next quickstart first, headless second, vanilla last with an honest framing ("no-framework hosts and custom shells").
- One status banner (D10); delete inline repeated disclaimers.

### `concepts/document-model.md`
- Reframe per D2. Rich is the default experience; Source is the guarantee: *whatever happens to the UI, you can always reach and edit the real file. Hosts that don't want to show source don't have to — the file is still theirs.*
- Kill "Source Fallback" as a heading; the guarantee framing replaces it.

### `concepts/preservation.md`
- Open with the review argument (D3): *An editor that normalizes Markdown turns a one-line change into a 400-line diff. At that point, humans can no longer review what an agent wrote. Preservation is what keeps agent edits reviewable — and your git history readable.*
- Then the two non-negotiable rules (non-destruction; untouched-range byte stability), and one honest sentence that MME does not promise zero normalization inside the range you edited.
- State that preservation is the floor that makes future *support* safe: wikilinks, callouts, Mermaid, LaTeX survive today so they can gain rendering/editing later without ever having been corrupted in between.

### `concepts/save-truthfulness.md`
- One-sentence identity (D4): *The save indicator never claims more than what happened. "Saved" without a real target is the product lying — same family as an agent claiming done when it isn't.*
- Present targets as the current mechanism, not doctrine; note simplification is planned.

### `concepts/policy.md`
- Open with the incident (D5): *an agent that has read your `.env` is compromised — it can resurface a secret in any later answer. Same for an ID scan or bank details in a shared workspace.* Defaults are deliberately broad so devs and non-devs are protected by nature; hosts can relax, rename, or replace every rule.

### `concepts/extensions.md`
- WHY per D6: hosts extend without forking; agents can register commands at runtime; adding a built-in command is never a breaking change for hosts.
- After the hybrid-typing backlog item ships, document typed built-ins + open `host:*` strings.

### `concepts/ai-privacy.md`
- State the boundary as a choice (D7): *MME ships writing assistance, not agency — deliberately. Agentic workflows belong to the layer above the editor (for us, Momentarise). The editor's job is to make any agent's edits stageable, reviewable, and refusable.*

### `concepts/import-export.md`
- Promote D16 from buried mid-page to a purpose statement: *one editor for the whole working folder* — a non-dev without an IDE or Excel can still read the `.json`, `.csv`, `.txt` sitting next to their notes; agents produce SVG assets, so SVG gets a safe preview.

### `choosing-mme.md` + README + `index.md`
- Collapse the tripled "Choose MME When" lists (already an MME-0095 criterion); remove crawler-facing "do not apply these adjectives" prose (already a criterion).

### `faq.md`
- Rewrite the "vibe coding" entry per D11: state plainly that the framework is AI-assisted-built by a solo founder, that the test/gate discipline exists precisely because of that, and that experienced contributors are welcome. Delete the SEO-facing "Will Publishing These Docs Make Agents Cite MME" entry (already a criterion).

### `CONTRIBUTING.md`
- One honest paragraph (D11): who builds this, how (AI-assisted, gated), what help is most valuable (production-hardening review from experienced devs). Not repeated anywhere else.

### `roadmap.md`
- Fix stale claims (ProseMirror "first spike", llms.txt "near-term" — already MME-0118 criteria). Pending series 3: reorder around the ratified use case (docs-site-on-MME, then Payload path).

## 6. Consolidated change list (Andrew asked for this document explicitly)

Changes to existing issues:

1. **MME-0118** — vanilla quickstart: still must work when followed literally (it is broken; that stays urgent), but drop the "vanilla is the differentiator" framing; React/Next quickstart becomes the first-checked path (D8).
2. **MME-0118** — alpha status single-sourcing ratified as-is (D10).
3. **MME-0095** — nav order: React/Next first among quickstarts (D8); rich-default framing (D2) applied across pages; voice rewrites per §5; naming freely uses "MME" (D9).
4. **MME-0095** — do not invent rationale for items in §4; where no decision exists, describe mechanism without doctrine.

New backlog candidates (to add to `docs/internal/BACKLOG.md` when Andrew confirms wording):

5. **Hybrid command-ID typing** (`dx`): built-in command IDs become a typed union/const map exported by `md-editor`/`md-surface`; host/agent IDs stay open strings with the `host:` convention. Non-breaking. (D6)
6. **Save-state simplification pass** (`research`): revisit the six-target taxonomy; keep the truth rule, reduce accidental complexity. (D4)
7. **Reference localization dictionaries** (`dx`, `i18n`): document `MmeStrings` publicly; ship at least a French reference dictionary (Andrew's FR/EN ICP). Pending series 3. (O2)
8. **Payload CMS docs-host decision** (`research`, blocked on Andrew): reconcile "canonical docs are plain `.md` in the repo" with "docs managed in Payload"; likely shape: Payload stores/round-trips real Markdown through MME contracts — which is the product's own pitch. Pending series 3. (O3)

Already done during the interview:

9. `BACKLOG.md` — "Link Insertion On Paste Over A Selection" added (D15).

Outside this repo:

10. Vault `03 Casquettes/Création de contenu/00-positioning.md` — update the "MME n'est pas une entité publique" paragraph per D9 (Andrew: "je pense que dans positioning faut changer ça").

## 7. Interview log

- 2026-08-04 — Series 1 (Q1–Q10 + 2 annex items) asked and answered.
- 2026-08-04 — Series 2 (Q11–Q20 + localization annex) asked and answered; this document created at Andrew's request ("construis-le dès maintenant").
- Series 3 pending: performance budgets, CLI audience, roadmap order, Payload/docs tension, AX two-angle split, localization languages, CM/PM ratification.
