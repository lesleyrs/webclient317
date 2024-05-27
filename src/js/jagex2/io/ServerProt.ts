export default class ServerProt {
    // TODO: remove removed packets
    // interfaces
    static readonly IF_OPENSIDEOVERLAY: number = 71;
    static readonly IF_OPENMAINMODAL: number = 97;
    static readonly IF_OPENSIDEMODAL: number = 142; // TODO: different name? using as IF_STOPANIM
    static readonly IF_OPENCHATMODAL: number = 164;
    static readonly IF_OPENMAINOVERLAY: number = 208;
    static readonly IF_CLOSE: number = 219; // NXT has "static readonly IF_CLOSESUB"
    static readonly IF_OPENMAINSIDEMODAL: number = 248;

    // updating interfaces
    static readonly IF_SETMODEL: number = 8; // NXT naming
    static readonly IF_SETPOSITION: number = 70; // NXT naming
    static readonly IF_SETNPCHEAD: number = 75; // NXT naming
    static readonly IF_SETSCROLLPOS: number = 79;
    static readonly IF_SHOWSIDE: number = 106;
    static readonly IF_SETCOLOUR: number = 122; // NXT naming
    static readonly IF_SETTEXT: number = 126; // NXT naming
    static readonly IF_SETHIDE: number = 171; // NXT naming
    static readonly IF_SETPLAYERHEAD: number = 185; // NXT naming
    static readonly IF_SETANIM: number = 200; // NXT naming
    static readonly IF_SETOBJECT: number = 246; // NXT naming
    static readonly IF_SETANGLE: number = 230;

    // tutorial area
    static readonly TUTORIAL_FLASHSIDE: number = 24;
    static readonly TUTORIAL_OPENCHAT: number = 218;

    // inventory
    static readonly UPDATE_INV_PARTIAL: number = 34; // NXT naming
    static readonly UPDATE_INV_FULL: number = 53; // NXT naming
    static readonly UPDATE_INV_STOP_TRANSMIT: number = 72; // NXT naming

    // camera control
    static readonly CAM_SHAKE: number = 35; // NXT naming
    static readonly CAM_RESET: number = 107; // NXT naming
    static readonly CAM_MOVETO: number = 166; // NXT naming
    static readonly CAM_LOOKAT: number = 177; // NXT naming

    // entity updates
    static readonly NPC_INFO: number = 65; // NXT naming
    static readonly PLAYER_INFO: number = 81; // NXT naming

    // social
    static readonly UPDATE_FRIENDLIST: number = 50; // NXT naming
    // TODO: private is called public?
    static readonly MESSAGE_PRIVATE: number = 196; // NXT naming // TODO: ALL FUNCS
    static readonly CHAT_FILTER_SETTINGS: number = 206; // NXT naming
    static readonly UPDATE_IGNORELIST: number = 214; // NXT naming
    static readonly FRIENDLIST_LOADED: number = 221; // TODO: friendlist_loaded?
    static readonly MESSAGE_GAME: number = 253; // NXT naming

    // misc
    static readonly RESET_ANIMS: number = 1; // NXT naming
    static readonly P_COUNTDIALOG: number = 27; // named after runescript command + client resume_p_countdialog packet
    static readonly SET_MULTIWAY: number = 61;
    static readonly UNSET_MAP_FLAG: number = 78; // NXT has "SET_MAP_FLAG" but we cannot control the position
    static readonly MINIMAP_TOGGLE: number = 99;
    static readonly LOGOUT: number = 109; // NXT naming
    static readonly UPDATE_RUNENERGY: number = 110; // NXT naming
    static readonly UPDATE_REBOOT_TIMER: number = 114; // NXT naming
    static readonly UPDATE_STAT: number = 134; // NXT naming
    static readonly LAST_LOGIN_INFO: number = 176; // NXT naming
    static readonly P_NAMEDIALOG: number = 187;
    static readonly UPDATE_RUNWEIGHT: number = 240; // NXT naming
    static readonly UPDATE_UID192: number = 249; // NXT naming (not 100% certain if "uid192" means local player)
    static readonly HINT_ARROW: number = 254; // NXT naming

    // maps
    static readonly REBUILD_NORMAL: number = 73; // NXT naming
    static readonly REBUILD_INSTANCE: number = 241;

    // vars
    static readonly VARP_SMALL: number = 36; // NXT naming
    static readonly RESET_CLIENT_VARCACHE: number = 68; // NXT naming
    static readonly VARP_LARGE: number = 87; // NXT naming
    static readonly SET_PLAYER_OP: number = 104;

    // audio
    static readonly MIDI_SONG: number = 74; // NXT naming
    static readonly MIDI_JINGLE: number = 121; // NXT naming
    static readonly SYNTH_SOUND: number = 174; // NXT naming

    // zones
    static readonly UPDATE_ZONE_PARTIAL_ENCLOSED: number = 60; // NXT naming
    static readonly UPDATE_ZONE_FULL_FOLLOWS: number = 64; // NXT naming
    static readonly UPDATE_ZONE_PARTIAL_FOLLOWS: number = 85; // NXT naming

    // zone protocol
    static readonly MAP_ANIM: number = 4; // NXT naming
    static readonly OBJ_ADD: number = 44; // NXT naming
    static readonly OBJ_COUNT: number = 84; // NXT naming
    static readonly LOC_DEL: number = 101; // NXT naming
    static readonly MAP_SOUND: number = 105;
    static readonly MAP_PROJANIM: number = 117; // NXT naming
    static readonly LOC_MERGE: number = 147; // based on runescript command p_locmerge
    static readonly LOC_ADD: number = 151;
    static readonly OBJ_DEL: number = 156; // NXT naming
    static readonly LOC_CHANGE: number = 160;
    static readonly OBJ_REVEAL: number = 215; // NXT naming
}
