// Everything the game needs before it can start. Resources.js loads this list.
// Files come from tools/optimize-assets.mjs, which builds them from tools/assets.manifest.json.

const models = [
    // Built in Blender
    'player', 'title_sign',
    // Enemies, rigged and animated, from Sketchfab (CC-BY)
    'mob_humanoid', 'mob_chicken', 'mob_hope', 'mob_drone',
    // Wrecks and walls, scanned and game-ready from Sketchfab (CC-BY) and Poly Haven
    'car_crashed', 'sedan_a', 'sedan_b', 'truck_rusty', 'van_delivery', 'car_pirozhok', 'car_destroyed', 'van_crushed',
    'covered_car', 'container_rusted', 'tyre_heap', 'concrete_road_barrier',
    // Junk for the piles
    'barrier_trash', 'gas_can', 'old_tyre', 'Barrel_01', 'Barrel_02', 'barrel_03', 'barrel_stove',
    'small_lpg_tank', 'wooden_military_crate', 'old_military_crate', 'ammo_box',
    'cement_bag', 'trashbag', 'Television_01', 'exterior_aircon_unit', 'portable_generator', 'water_manhole_cover',
    'can_rusted', 'cardboard_box_01', 'plastic_jerrycan', 'wooden_crate_02', 'rusted_wheel_rim_02', 'ladder_sectioned_01',
    // Dumped workshop gear, a pile type of its own
    'old_military_compressor', 'old_drill_press', 'worn_metal_rack', 'tool_cart', 'industrial_storage_cart', 'hand_truck',
    'metal_trash_can', 'concrete_road_barrier_02', 'utility_box_02',
    // The rest of the prop options
    'metal_jerrycan', 'modular_industrial_pipes_01', 'modular_chainlink_fence', 'steel_frame_shelves_01',
    'wooden_barrels_01', 'propane_torch', 'dumpster', 'trash_container',
    // The Stash and the power line around the yard
    'stash_house', 'modular_electricity_poles',
    // Turret and flak: a head that turns on a base that stays, cut from one download each
    'turret_head', 'turret_base', 'flak_head', 'flak_gun', 'flak_base',
    // The title: a gantry over the North gate (the sign itself is title_sign), cranes and a water tower behind
    'gantry_portica', 'gantry_crane', 'tower_crane', 'water_tower',
    // Yard fittings
    'security_light', 'portable_searchlight'
]

// Poly Haven sets and the maps the game reads from each. A map nobody reads is not downloaded.
const textures = {
    gravelly_sand: ['color', 'normal', 'arm'],
    tarred_gravel: ['color', 'normal', 'arm'],
    rusty_metal_02: ['color', 'normal', 'arm'],
    rusty_metal_sheet: ['color', 'normal', 'arm'],
    rusty_painted_metal: ['color', 'normal', 'arm'],
    metal_grate_rusty: ['color', 'normal', 'arm'],
    // Ground.js splats these in with color and normal only
    cracked_red_ground: ['color', 'normal'],
    bitumen: ['color', 'normal'],
    // applyRust.js reads only the color
    rust_coarse_01: ['color']
}

const sounds = [
    'shot_1.wav', 'shot_3.ogg',
    'reload_rack.mp3', 'reload_shell.mp3',
    'explosion.ogg',
    'metal_1.ogg', 'metal_2.ogg', 'metal_3.ogg', 'metal_4.ogg', 'metal_5.ogg', 'metal_6.ogg',
    'metal_bong.wav', 'metal_clink.wav',
    'flesh_1.ogg', 'flesh_2.ogg', 'flesh_3.ogg', 'flesh_4.ogg',
    'step_1.ogg', 'step_2.ogg', 'slide.ogg', 'gravel.ogg'
]

export default [
    { name: 'sky', type: 'hdr', path: 'textures/sky.hdr' },

    ...models.map((name) => ({ name, type: 'gltfModel', path: `models/${name}.glb` })),

    // One item per map: bitumen_color, bitumen_normal. Only color holds sRGB data.
    ...Object.entries(textures).flatMap(([id, maps]) => maps.map((map) =>
        ({ name: `${id}_${map}`, type: 'texture', path: `textures/${id}/${map}.webp`, srgb: map === 'color' }))),

    // Named after the file without its extension: shot_1, metal_bong
    ...sounds.map((file) => ({ name: file.split('.')[0], type: 'audio', path: `sounds/${file}` }))
]
