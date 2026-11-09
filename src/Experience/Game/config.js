// Every balance number in the game. Tweak here first.
export default
{
    GRID: 36,          // the map is GRID x GRID cells
    CELL: 2.2,         // meters per cell
    START_SCRAP: 120,
    PREP_TIME: 180,    // seconds of top-down preparation between rounds
    COUNTDOWN: 5,      // seconds of warning after READY, or at the end of prep
    NIGHTFALL: 100,    // seconds from a round's start to full night, see Environment

    // Enemies per round = base + perRound * round, see Rounds.composition. They arrive in packs from
    // one gate, all of them within firstSpawn + window seconds. The fight itself has no time limit.
    SPAWN:
    {
        raider: { base: 20, perRound: 6 },
        scuttler: { base: 0, perRound: 5, from: 1 },
        brute: { base: 0, perRound: 1, from: 3 },
        drone: { base: -2, perRound: 4, from: 2 },
        packMin: 2,
        packMax: 3,
        firstSpawn: 2,
        window: 56
    },

    BUILD_RANGE: 16,   // how far away things can be placed in first or third person
    STASH_CELLS: 4,    // the Stash's square, cells a side: its house is near life size, any smaller and her head hits the door frame
    STASH_HP: 1500,
    STASH_STEAL: 2,    // scrap a raider steals per hit on the Stash
    STASH_PATCH: 0.1,  // share of the Stash's health patched up after each round
    ROUND_BONUS: { base: 40, perRound: 15 }, // scrap for clearing a round: base + perRound * round
    MOUSE_SENS: 0.0022,

    // What the player owns at the start. Everything placed returns here when a round ends.
    START_INVENTORY: { wreck: 6, container: 2, turret: 2, flak: 1, spikes: 2, tar: 2, mine: 2 },

    // Enemies get tougher every round: multiplier = 1 + perRound * (round - 1)
    SCALING: { hp: 0.15, damage: 0.10, speed: 0.03, speedMax: 1.35 },

    // Path cost of breaking through a wall, per 100 wall hp.
    // Higher means enemies prefer walking around, lower means they smash through.
    WALL_COST_NORMAL: 25,
    WALL_COST_BRUTE: 3,
    TURRET_MAX_COVER: 1, // ground turrets can fire over at most this many walls or junk piles

    PLAYER:
    {
        walk: 2.6,       // while aiming
        jog: 5.6,
        sprint: 8.6,
        back: 0.7,       // share of the speed left when moving backwards
        crouchSlide: 7.5, // a slide (C) starts at least this fast
        slideDrag: 5,    // m/s lost per second while sliding
        jump: 7.5,
        gravity: 24,
        radius: 0.4,
        eye: 1.55,
        maxHp: 100,
        respawn: 6,
        deathLoss: 0.2   // share of the scrap lost when she goes down
    },

    // cells: footprint along the anchor's long axis, R turns it a quarter clockwise
    STRUCTURES:
    {
        wreck: { name: 'Car wreck', cost: 15, hp: 400, blocks: true, height: 1.4, cells: 2, desc: 'Cheap wall, two cells long' },
        container: { name: 'Container', cost: 45, hp: 1400, blocks: true, height: 2.6, cells: 3, desc: 'Heavy wall, three cells long' },
        turret: { name: 'Junk turret', cost: 45, hp: 180, blocks: true, height: 1.8, cells: 1, desc: 'Ground only', range: 15, fireRate: 0.4, damage: 11 },
        flak: { name: 'Flak cannon', cost: 55, hp: 160, blocks: true, height: 1.6, cells: 1, desc: 'Air only', range: 22, fireRate: 0.3, damage: 10, air: true },
        spikes: { name: 'Spike trap', cost: 20, hp: 120, blocks: false, height: 0.4, cells: 1, desc: 'Wears out', damage: 18, rate: 0.5, wear: 8 },
        tar: { name: 'Tar pit', cost: 15, hp: 100, blocks: false, height: 0.15, cells: 1, desc: 'Slows by 55%', slow: 0.45, wear: 4 },
        mine: { name: 'Scrap mine', cost: 25, hp: 1, blocks: false, height: 0.3, cells: 1, desc: 'Explodes once', damage: 110, radius: 4 }
    },
    BUILD_ORDER: ['wreck', 'container', 'turret', 'flak', 'spikes', 'tar', 'mine'],
    // Repairing on the prep map costs this share of the item's price, times the share of health it lost
    REPAIR_SHARE: 0.8,

    // Workshop: U on the prep map, E within WORKSHOP_REACH of the Stash in the fight (the fight waits).
    // cost[n] is the price of level n + 1. step is what one level adds, see Upgrades.bonus.
    WORKSHOP_REACH: 5,
    UPGRADES:
    [
        { id: 'dmg', name: 'Hot loads', desc: '20% more shotgun damage', step: 0.2, cost: [60, 100, 150, 220, 300] },
        { id: 'rate', name: 'Greased pump', desc: '12% faster fire rate', step: 0.12, cost: [70, 120, 180, 260] },
        { id: 'mag', name: 'Extended tube', desc: '2 more shells per reload', step: 2, cost: [50, 90, 140] },
        { id: 'hp', name: 'Scrap plating', desc: '25 more max health', step: 25, cost: [60, 100, 150, 220] },
        { id: 'armor', name: 'Kevlar lining', desc: '10% less damage taken', step: 0.1, cost: [80, 130, 190, 260] },
        { id: 'speed', name: 'Running boots', desc: '8% faster on foot', step: 0.08, cost: [50, 90, 140] },
        { id: 'turret', name: 'Turret calibration', desc: '15% more turret and flak damage', step: 0.15, cost: [90, 150, 220, 300] }
    ],
    CONSUMABLES:
    {
        // Priced by the health it gives back: a full 100 is 40 scrap, a scratch costs little. Cheaper per health
        // than a medkit, which is the price of carrying it out into the yard.
        heal: { name: 'Patch up', desc: 'Back to full health now', costPerHp: 0.4 },
        medkit: { name: 'Medkit', desc: 'Carry up to 3, H heals 50 over 5 s', cost: 35, max: 3, heal: 50, time: 5 }
    },

    // aggroChance is the share of this enemy type that breaks off to chase the player within aggro range.
    // model and clips say which file and which of its animations play. Heights are in meters.
    // clipSpeed: m/s the walk clip covers at the file's scale, measured from its planted foot. Keeps feet from skating.
    // The raider's is set above what its clip covers (5.8): the clip is a short jog, and matched its legs would blur.
    ENEMIES:
    {
        raider:
        {
            name: 'Raider', model: 'mob_humanoid', clipSpeed: 13, height: 1.9, hp: 60, speed: 3.4, damage: 9, attackRate: 1.0, range: 1.3, radius: 0.45, scrap: 5,
            hatesTurrets: true, steals: true, aggroChance: 0.4, aggro: 8,
            clips: { idle: 'IDLE', walk: 'RUN', attack: null, hit: null, death: null }
        },
        scuttler:
        {
            name: 'Scuttler', model: 'mob_chicken', clipSpeed: 1.19, height: 1.15, hp: 32, speed: 6.0, damage: 7, attackRate: 0.7, range: 1.2, radius: 0.4, scrap: 3,
            aggroChance: 1, aggro: 16,
            clips: { idle: 'idle', walk: 'walk', attack: 'attack', hit: null, death: null }
        },
        brute:
        {
            name: 'Brute', model: 'mob_hope', clipSpeed: 4.6, height: 2.9, hp: 320, speed: 2.0, damage: 40, attackRate: 1.8, range: 1.9, radius: 1.2, scrap: 20,
            wallBreaker: true, aggroChance: 0.3, aggro: 6,
            clips: { idle: 'Robot_idleM', walk: 'Robot_marchM', attack: null, hit: null, death: null }
        },
        drone:
        {
            name: 'Scrap drone', model: 'mob_drone', height: 1.0, hp: 40, speed: 5.0, damage: 5, attackRate: 1.0, range: 7, radius: 0.6, scrap: 5,
            flying: true, flyHeight: 6, aggroChance: 0.5, aggro: 10,
            clips: { idle: 'Idle', walk: 'Fly Forward', attack: 'Idle', hit: 'Take Damage Light', death: 'Power Off' }
        }
    },

    WEAPONS:
    {
        shotgun: { name: 'Scrap shotgun', pellets: 9, spread: 0.055, damage: 10, range: 45, fireRate: 0.7, mag: 6, reload: 1.8 }
    }
}
