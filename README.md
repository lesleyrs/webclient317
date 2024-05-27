```
186- no sound, no input tracking
194- no sound
234- OnDemand, OnDemandProvider, OnDemandRequest, FileStream classes added, LocSpawned removed (only LocTemporary now)
245- MouseTracking class added
249- Stats and VarbitType classes added
257- PixFontFull and SoundFilter classes added, InputTracking class removed
270- PixFontFull replaces PixFont completely

check TODOs, missing ondemand, mousetracking, stats, pixfontfull (replacing pixfont) classes, deleted ts entrypoints, some renaming needed
didn't always move code into or out of methods as I'd have to compare which are authentic between danes and rs-deob
317 cache is actually 319 (317 needs more files)
tested on blakescape/emulous with RSA enabled and websockify 43595 localhost:43594

emulous: quest tab iface not updating, no login appearance iface, stackables ::runes broken, NOTE the crash during death animation happens on a deob too
structures north of fally show up (wrong), watchtower on upper floor no ground, torches offset watchtower tele, varrock east upper floor doesn't show
drawparentinterface/drawinterface, rune icons on spellbook
add taggable string funcs + why are typing tags in chat offsetting it? EG @gre@
dropped items positions wrong, add player team+transmog
instanced buildscene, npc dialogue check, check special attacks combat tab, cacheloads?, T1 and T2 errors for info?, check to unload new vars
could add a loadmodel() like viewer.ts (not authentic but if not adding ondemand)
```

<div align="center">

<h1>2004Scape Client2 - May 18, 2004</h1>

[Website](https://2004scape.org) | [Discord](https://discord.2004scape.org) | [Rune-Server](https://www.rune-server.ee/runescape-development/rs2-server/projects/701698-lost-city-225-emulation.html)

**status: completely ported**

**The client code was source ported to TypeScript by us.**  
**Jagex has never had any source code leaks.**
</div>

## Site Index

### Client

Try out the client hosted on Github! It is 100% source ported and available to use.
Create your account on the 2004scape website.

| World           | High Detail                                                                    | Low Detail                                                                    | Members |
|-----------------|--------------------------------------------------------------------------------|-------------------------------------------------------------------------------|---------|
| 1 (Central USA) | [Play Now!](https://2004scape.github.io/Client2/?world=1&detail=high&method=0) | [Play Now!](https://2004scape.github.io/Client2/?world=1&detail=low&method=0) | No      |
| 2 (Central USA) | [Play Now!](https://2004scape.github.io/Client2/?world=2&detail=high&method=0) | [Play Now!](https://2004scape.github.io/Client2/?world=2&detail=low&method=0) | Yes     |
| 3 (Germany)     | [Play Now!](https://2004scape.github.io/Client2/?world=3&detail=high&method=0) | [Play Now!](https://2004scape.github.io/Client2/?world=3&detail=low&method=0) | Yes     |
| 4 (Germany)     | [Play Now!](https://2004scape.github.io/Client2/?world=4&detail=high&method=0) | [Play Now!](https://2004scape.github.io/Client2/?world=4&detail=low&method=0) | No      |

### <a href="https://2004scape.github.io/Client2/playground" target="_blank">Playground</a> - An Interactive Model Viewer
### <a href="https://2004scape.github.io/Client2/items" target="_blank">Items Viewer</a> - View All the Items
### <a href="https://2004scape.github.io/Client2/mesanim" target="_blank">Message Animation Viewer</a> - A Chat Message Animation Editor
### <a href="https://2004scape.github.io/Client2/sounds" target="_blank">Sounds Viewer</a> - Sounds Viewer & Listener
### <a href="https://2004scape.github.io/Client2/viewer" target="_blank">Viewer</a> - A Cache Viewer (WIP)
### <a href="https://2004scape.github.io/Client2/interface-editor" target="_blank">Interface Editor</a> - An Interface Editor (WIP)

---

## Commands

`::debug` Shows performance metrics (FPS, frame times and more).

`::chat` Changes between 3 different chat font eras.

`::fps` Set a targeted FPS (ex. `::fps 30`)

A developer can utilize the debug command for development purposes.
![debugging](https://github.com/2004scape/Client2/assets/76214316/9cec6fb5-7a79-4d81-97ed-a96a5fecd85a)

---

## First Time Installation

```shell
npm install
npm run prepare
npm run build:dev
```

If you are on a Mac:
```shell
chmod ug+x .husky/*
chmod ug+x .git/hooks/*
```

## Local

Local development should be done with: `npm run dev`

The client will automatically launch connecting to World 1.
Local world is hosted on World 0.
You have the ability to connect to live servers from the local client by changing the param.

http://localhost:8080/?world=0&detail=high&method=0 (TypeScript)

This is not to be confused with the Java TeaVM client which is hosted here if the local server is running:

http://localhost/client?world=0&detail=high&method=0 (Java)

## Web Worker server and WebRTC peer to peer connections

A web worker server will start when loading world 999. This works as a no install, offline, singleplayer version of the server. You will need to self host in order to load saves.

How to use:
1. Run `npm run build` and then `npm run bundle` in the server, this copies all required files to `../Client2/public`. Start client with `npm run prod`.
2. A save dialog will open on logout, you should save to `/public/data/players`.
3. Optional: To host on github uncomment the lines starting with `!/public` in the [.gitignore](.gitignore).

Combined with WebRTC connections you'll be able to host servers using just your browser by manually exchanging a message for each peer. Players that want to join will have to be on world 998 which won't start a web worker server.

Clicking `New user` on login screen or additionally `::peer` ingame for hosts will open a prompt and write either an offer (host) or answer (peer) to clipboard automatically. This message can contain your public IP. Pass the offer to the peer, peer returns the answer and you'll be connected! Closing the prompt will reset the process and allows for any amount of peers.
